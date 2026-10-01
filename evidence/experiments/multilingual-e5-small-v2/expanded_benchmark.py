#!/usr/bin/env python3
import hashlib
import json
import math
import os
import platform
import resource
import statistics
import sys
import time
from pathlib import Path

import numpy as np
import psutil
from huggingface_hub import snapshot_download

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
FIXTURE_PATH = HERE / "expanded-v2.json"
LEXICAL_PATH = HERE / "lexical-v2.json"
RESULT_PATH = HERE / "results-v2.json"

MODEL_ID = "intfloat/multilingual-e5-small"
MODEL_REVISION = "fd1525a9fd15316a2d503bf26ab031a61d056e98"
ALLOWED_SCOPES = {"public_discovery", "authorized_public"}
FORBIDDEN_MARKERS = [
    "access_token", "recovery_key", "admin_token", "bearer token",
    "private_inbox_message", "conversation_token"
]
ALLOW_PATTERNS = [
    "config.json", "model.safetensors", "tokenizer.json",
    "tokenizer_config.json", "special_tokens_map.json",
    "sentencepiece.bpe.model"
]

def pct(xs, p):
    if not xs:
        return None
    ys = sorted(xs)
    if len(ys) == 1:
        return ys[0]
    pos = (len(ys) - 1) * p
    lo, hi = math.floor(pos), math.ceil(pos)
    if lo == hi:
        return ys[lo]
    return ys[lo] + (ys[hi] - ys[lo]) * (pos - lo)

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def dir_bytes(path):
    return sum(p.stat().st_size for p in Path(path).rglob("*") if p.is_file())

def public_passage(r):
    s, i, v = r["source"], r["identity_claim"], r["validity"]
    fields = [
        s.get("title"), s.get("channel"), s.get("url"), s.get("version"),
        s.get("published_at"), s.get("observed_at"), r["content"].get("text"),
        i.get("provider"), i.get("model_name"), i.get("model_identifier"),
        i.get("model_family"), i.get("agent_framework"), i.get("interaction_origin"),
        r.get("evidence_level"), v.get("invalidation_reason")
    ]
    return " | ".join(str(x) for x in fields if x)

def metrics(cases, ranked):
    pos = neg = h1 = h3 = h5 = h10 = false_candidates = 0
    rr5 = 0.0
    cross_total = cross_h5 = 0
    by_kind = {}
    details = []
    for tc in cases:
        ids = ranked.get(tc["id"], [])
        rel = tc["relevant"]
        k = tc["kind"]
        by_kind.setdefault(k, {"positive":0,"no_evidence":0,"hit5":0,"false_candidate":0})
        if not rel:
            neg += 1
            by_kind[k]["no_evidence"] += 1
            if ids:
                false_candidates += 1
                by_kind[k]["false_candidate"] += 1
            details.append({"id":tc["id"],"kind":k,"top_ids":ids[:10],"best_rank":None})
            continue
        pos += 1
        by_kind[k]["positive"] += 1
        ranks = [ids.index(x)+1 for x in rel if x in ids]
        best = min(ranks) if ranks else math.inf
        h1 += int(best <= 1); h3 += int(best <= 3); h5 += int(best <= 5); h10 += int(best <= 10)
        if best <= 5:
            rr5 += 1.0 / best
            by_kind[k]["hit5"] += 1
        if k == "cross_lingual":
            cross_total += 1
            cross_h5 += int(best <= 5)
        details.append({"id":tc["id"],"kind":k,"top_ids":ids[:10],"best_rank":None if not math.isfinite(best) else best})
    return {
        "positive_cases":pos,
        "no_evidence_cases":neg,
        "recall_at_1":h1/pos if pos else None,
        "recall_at_3":h3/pos if pos else None,
        "recall_at_5":h5/pos if pos else None,
        "recall_at_10":h10/pos if pos else None,
        "mrr_at_5":rr5/pos if pos else None,
        "cross_lingual_recall_at_5":cross_h5/cross_total if cross_total else None,
        "no_evidence_false_candidate_rate":false_candidates/neg if neg else None,
        "by_kind":by_kind,
        "details":details,
    }

def rrf_hybrid(cases, lexical_map, dense_map, dense_top1, threshold):
    out = {}
    for tc in cases:
        qid = tc["id"]
        lex = lexical_map.get(qid, [])
        dense_allowed = dense_top1[qid] >= threshold
        den = dense_map[qid][:10] if dense_allowed else []
        if not lex and not den:
            out[qid] = []
            continue
        union = list(dict.fromkeys(lex + den))
        lex_pos = {x:i+1 for i,x in enumerate(lex)}
        den_pos = {x:i+1 for i,x in enumerate(den)}
        fused = []
        for eid in union:
            score = 0.0
            if eid in lex_pos:
                score += 1.0/(60.0+lex_pos[eid])
            if eid in den_pos:
                score += 1.0/(60.0+den_pos[eid])
            fused.append((eid,score))
        fused.sort(key=lambda x:(-x[1],x[0]))
        out[qid] = [eid for eid,_ in fused[:10]]
    return out

def main():
    raw = FIXTURE_PATH.read_text(encoding="utf-8")
    low = raw.lower()
    for marker in FORBIDDEN_MARKERS:
        if marker in low:
            raise SystemExit(f"privacy guard failed: {marker}")

    fixture = json.loads(raw)
    records = fixture["corpus"]["records"]
    for r in records:
        if r["scope"] not in ALLOWED_SCOPES:
            raise SystemExit(f"disallowed scope: {r['scope']}")
        if r["source"]["version"] != r["validity"]["source_version"]:
            raise SystemExit(f"version mismatch: {r['evidence_id']}")
        if r["source"]["content_hash"] != r["validity"]["source_content_hash"]:
            raise SystemExit(f"hash mismatch: {r['evidence_id']}")

    lexical = json.loads(LEXICAL_PATH.read_text(encoding="utf-8"))
    lex_cal = {c["id"]:[x["evidence_id"] for x in c["result"]["candidates"]] for c in lexical["calibration"]}
    lex_eval = {c["id"]:[x["evidence_id"] for x in c["result"]["candidates"]] for c in lexical["evaluation"]}

    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    os.environ["TOKENIZERS_PARALLELISM"] = "false"

    t0 = time.perf_counter()
    snap = Path(snapshot_download(repo_id=MODEL_ID, revision=MODEL_REVISION, allow_patterns=ALLOW_PATTERNS))
    download_seconds = time.perf_counter()-t0
    model_file, tok_file = snap/"model.safetensors", snap/"tokenizer.json"
    if not model_file.exists() or not tok_file.exists():
        raise SystemExit("required safe artifact missing")

    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    import torch
    import torch.nn.functional as F
    import transformers
    from transformers import AutoModel, AutoTokenizer

    load0 = time.perf_counter()
    tokenizer = AutoTokenizer.from_pretrained(snap, local_files_only=True)
    model = AutoModel.from_pretrained(snap, local_files_only=True, use_safetensors=True, trust_remote_code=False)
    model.eval()
    load_seconds = time.perf_counter()-load0

    def pool(last_hidden, mask):
        masked = last_hidden.masked_fill(~mask[...,None].bool(),0.0)
        return masked.sum(dim=1)/mask.sum(dim=1)[...,None]

    def encode(texts,prefix,batch_size=8):
        chunks=[]
        with torch.no_grad():
            for i in range(0,len(texts),batch_size):
                batch=tokenizer([prefix+x for x in texts[i:i+batch_size]],max_length=512,padding=True,truncation=True,return_tensors="pt")
                out=model(**batch)
                emb=F.normalize(pool(out.last_hidden_state,batch["attention_mask"]),p=2,dim=1)
                chunks.append(emb.cpu())
        return torch.cat(chunks,dim=0)

    passages=[public_passage(r) for r in records]
    p0=time.perf_counter()
    p_emb=encode(passages,"passage: ")
    passage_seconds=time.perf_counter()-p0
    record_ids=[r["evidence_id"] for r in records]

    all_cases=fixture["calibration"]["cases"]+fixture["evaluation"]["cases"]
    _=encode([all_cases[0]["query"]],"query: ",1)
    latency=[]
    q_emb=[]
    for tc in all_cases:
        q0=time.perf_counter()
        emb=encode([tc["query"]],"query: ",1)
        latency.append((time.perf_counter()-q0)*1000)
        q_emb.append(emb[0])
    q_emb=torch.stack(q_emb)
    sim=q_emb@p_emb.T

    dense_all={}
    dense_top1={}
    dense_scores={}
    for idx,tc in enumerate(all_cases):
        order=torch.argsort(sim[idx],descending=True).tolist()
        ids=[record_ids[j] for j in order]
        dense_all[tc["id"]]=ids
        dense_top1[tc["id"]]=float(sim[idx,order[0]])
        dense_scores[tc["id"]]=[{"evidence_id":record_ids[j],"cosine":float(sim[idx,j])} for j in order[:10]]

    cal_cases=fixture["calibration"]["cases"]
    cal_noev=[tc for tc in cal_cases if not tc["relevant"]]
    max_noev=max(dense_top1[tc["id"]] for tc in cal_noev)
    threshold=float(np.nextafter(np.float32(max_noev),np.float32(np.inf)))

    def gated(cases):
        return {tc["id"]:(dense_all[tc["id"]][:10] if dense_top1[tc["id"]]>=threshold else []) for tc in cases}

    gated_cal=gated(cal_cases)
    gated_eval=gated(fixture["evaluation"]["cases"])
    hybrid_cal=rrf_hybrid(cal_cases,lex_cal,dense_all,dense_top1,threshold)
    hybrid_eval=rrf_hybrid(fixture["evaluation"]["cases"],lex_eval,dense_all,dense_top1,threshold)

    dense_cal={tc["id"]:dense_all[tc["id"]][:10] for tc in cal_cases}
    dense_eval={tc["id"]:dense_all[tc["id"]][:10] for tc in fixture["evaluation"]["cases"]}

    by_id={r["evidence_id"]:r for r in records}
    stale_ids=["ev-borealis-axiom8-revoked","ev-sever-mayak13-revoked","ev-atlas-loom1-revoked","ev-logos-axioma4-revoked"]
    stale_check={eid:{
        "status":by_id[eid]["acceptance"]["status"],
        "invalidated_at":by_id[eid]["validity"]["invalidated_at"]
    } for eid in stale_ids}

    result={
      "experiment":"multilingual-e5-small-expanded-v2",
      "scope":{"private_inbox_used":False,"other_models_used":False,"reranker_used":False,"production_integration":False,"authority_changed":False},
      "artifact":{
        "model_id":MODEL_ID,"revision":MODEL_REVISION,
        "model_safetensors_sha256":sha256_file(model_file),
        "tokenizer_json_sha256":sha256_file(tok_file),
        "snapshot_bytes":dir_bytes(snap),"download_seconds":download_seconds
      },
      "calibration":{
        "rule":fixture["policy"]["calibration_rule"],
        "no_evidence_cases":len(cal_noev),
        "max_no_evidence_top1_cosine":max_noev,
        "dense_gate_threshold":threshold,
        "forced_dense":metrics(cal_cases,dense_cal),
        "gated_dense":metrics(cal_cases,gated_cal),
        "gated_hybrid":metrics(cal_cases,hybrid_cal)
      },
      "evaluation":{
        "exact_lexical":metrics(fixture["evaluation"]["cases"],lex_eval),
        "forced_dense":metrics(fixture["evaluation"]["cases"],dense_eval),
        "gated_dense":metrics(fixture["evaluation"]["cases"],gated_eval),
        "gated_hybrid":metrics(fixture["evaluation"]["cases"],hybrid_eval)
      },
      "runtime":{
        "python":sys.version,"platform":platform.platform(),"torch":torch.__version__,"transformers":transformers.__version__,"numpy":np.__version__,
        "cpu_count":psutil.cpu_count(logical=True),"torch_num_threads":torch.get_num_threads(),
        "model_load_seconds":load_seconds,"passage_encode_seconds":passage_seconds,
        "query_latency_ms_p50":statistics.median(latency),"query_latency_ms_p95":pct(latency,0.95),
        "embedding_dimension":int(p_emb.shape[1]),"embedding_index_bytes_float32":int(p_emb.numel()*p_emb.element_size()),
        "peak_rss_bytes":int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024)
      },
      "stale_revoked_metadata":stale_check,
      "dense_top10_scores":dense_scores,
      "notes":[
        "Calibration threshold uses calibration no-evidence queries only; evaluation cases are untouched until scoring.",
        "Dense similarity never changes evidence acceptance/trust/identity.",
        "Private Inbox and operator-only acceptance labels are not embedded.",
        "No reranker is used."
      ]
    }
    RESULT_PATH.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(json.dumps(result,indent=2,ensure_ascii=False))

if __name__=="__main__":
    main()
