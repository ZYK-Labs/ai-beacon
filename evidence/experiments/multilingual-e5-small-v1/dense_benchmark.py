#!/usr/bin/env python3
import hashlib
import json
import math
import os
import platform
import resource
import statistics
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import psutil
from huggingface_hub import snapshot_download

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
FIXTURE_PATH = ROOT / "frozen-v1.json"
LEXICAL_EXPORT = HERE / "lexical-results.json"
RESULT_PATH = HERE / "results.json"

MODEL_ID = "intfloat/multilingual-e5-small"
MODEL_REVISION = "fd1525a9fd15316a2d503bf26ab031a61d056e98"
ALLOWED_SCOPES = {"public_discovery", "authorized_public"}
FORBIDDEN_MARKERS = [
    "access_token",
    "recovery_key",
    "admin_token",
    "bearer token",
    "private_inbox_message",
]
ALLOW_PATTERNS = [
    "config.json",
    "model.safetensors",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "sentencepiece.bpe.model",
]

def percentile(xs, p):
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

def sha256_file(path: Path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def dir_bytes(path: Path):
    return sum(p.stat().st_size for p in path.rglob("*") if p.is_file())

def public_passage(record):
    # Intentionally excludes acceptance.status / operator-only review labels.
    s = record["source"]
    i = record["identity_claim"]
    v = record["validity"]
    fields = [
        s.get("title"),
        s.get("channel"),
        s.get("url"),
        s.get("version"),
        s.get("published_at"),
        s.get("observed_at"),
        record["content"].get("text"),
        i.get("provider"),
        i.get("model_name"),
        i.get("model_identifier"),
        i.get("model_family"),
        i.get("agent_framework"),
        i.get("interaction_origin"),
        record.get("evidence_level"),
        v.get("invalidation_reason"),
    ]
    return " | ".join(str(x) for x in fields if x)

def evaluate(cases, ranked_by_case):
    positives = no_evidence = h1 = h3 = h5 = h10 = 0
    rr = 0.0
    false_no_evidence = 0
    cross_total = cross_hit5 = 0
    details = []
    for tc in cases:
        ids = ranked_by_case.get(tc["id"], [])
        rel = tc["relevant"]
        if not rel:
            no_evidence += 1
            if ids:
                false_no_evidence += 1
            details.append({"id": tc["id"], "kind": tc["kind"], "top_ids": ids[:5]})
            continue

        positives += 1
        ranks = [ids.index(x) + 1 for x in rel if x in ids]
        best = min(ranks) if ranks else math.inf
        if best <= 1:
            h1 += 1
        if best <= 3:
            h3 += 1
        if best <= 5:
            h5 += 1
        if math.isfinite(best):
            rr += 1.0 / best

        if tc["kind"] == "cross_lingual_semantic":
            cross_total += 1
            if best <= 5:
                cross_hit5 += 1
        details.append({"id": tc["id"], "kind": tc["kind"], "top_ids": ids[:5], "best_rank": None if not math.isfinite(best) else best})

    return {
        "positive_cases": positives,
        "no_evidence_cases": no_evidence,
        "recall_at_1": h1 / positives,
        "recall_at_3": h3 / positives,
        "recall_at_5": h5 / positives,
        "mrr_at_5": rr / positives,
        "cross_lingual_semantic_recall_at_5": (cross_hit5 / cross_total) if cross_total else None,
        "no_evidence_false_candidate_rate": (false_no_evidence / no_evidence) if no_evidence else None,
        "details": details,
    }

def main():
    raw = FIXTURE_PATH.read_text(encoding="utf-8")
    low = raw.lower()
    for marker in FORBIDDEN_MARKERS:
        if marker in low:
            raise SystemExit(f"privacy guard failed: forbidden marker {marker}")

    fixture = json.loads(raw)
    records = fixture["corpus"]["records"]
    cases = fixture["benchmark"]["cases"]
    for rec in records:
        if rec["scope"] not in ALLOWED_SCOPES:
            raise SystemExit(f"privacy guard failed: disallowed scope {rec['scope']} in {rec['evidence_id']}")

    if not LEXICAL_EXPORT.exists():
        raise SystemExit("missing lexical-results.json; run export_lexical.mjs first")
    lexical = json.loads(LEXICAL_EXPORT.read_text(encoding="utf-8"))

    lex_ranked = {
        c["id"]: [x["evidence_id"] for x in c["result"]["candidates"]]
        for c in lexical["cases"]
    }
    lex_metrics = evaluate(cases, lex_ranked)

    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    os.environ["TOKENIZERS_PARALLELISM"] = "false"

    t0 = time.perf_counter()
    snapshot_dir = Path(snapshot_download(
        repo_id=MODEL_ID,
        revision=MODEL_REVISION,
        allow_patterns=ALLOW_PATTERNS,
    ))
    download_seconds = time.perf_counter() - t0

    model_file = snapshot_dir / "model.safetensors"
    tokenizer_file = snapshot_dir / "tokenizer.json"
    if not model_file.exists():
        raise SystemExit("safe model artifact model.safetensors missing")
    if not tokenizer_file.exists():
        raise SystemExit("tokenizer.json missing")

    artifact = {
        "model_id": MODEL_ID,
        "revision": MODEL_REVISION,
        "model_safetensors_sha256": sha256_file(model_file),
        "tokenizer_json_sha256": sha256_file(tokenizer_file),
        "snapshot_bytes": dir_bytes(snapshot_dir),
        "download_seconds": download_seconds,
    }

    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    import torch
    import torch.nn.functional as F
    import transformers
    from transformers import AutoModel, AutoTokenizer

    load0 = time.perf_counter()
    tokenizer = AutoTokenizer.from_pretrained(snapshot_dir, local_files_only=True)
    model = AutoModel.from_pretrained(
        snapshot_dir,
        local_files_only=True,
        use_safetensors=True,
        trust_remote_code=False,
    )
    model.eval()
    load_seconds = time.perf_counter() - load0

    def average_pool(last_hidden_states, attention_mask):
        masked = last_hidden_states.masked_fill(~attention_mask[..., None].bool(), 0.0)
        return masked.sum(dim=1) / attention_mask.sum(dim=1)[..., None]

    def encode(texts, prefix, batch_size=8):
        all_embeddings = []
        with torch.no_grad():
            for i in range(0, len(texts), batch_size):
                chunk = [prefix + x for x in texts[i:i+batch_size]]
                batch = tokenizer(
                    chunk,
                    max_length=512,
                    padding=True,
                    truncation=True,
                    return_tensors="pt",
                )
                output = model(**batch)
                emb = average_pool(output.last_hidden_state, batch["attention_mask"])
                emb = F.normalize(emb, p=2, dim=1)
                all_embeddings.append(emb.cpu())
        return torch.cat(all_embeddings, dim=0)

    passages = [public_passage(r) for r in records]
    passage0 = time.perf_counter()
    passage_embeddings = encode(passages, "passage: ", batch_size=8)
    passage_encode_seconds = time.perf_counter() - passage0

    # Warm-up before latency sampling.
    _ = encode([cases[0]["query"]], "query: ", batch_size=1)

    per_query_ms = []
    query_embeddings = []
    for tc in cases:
        q0 = time.perf_counter()
        emb = encode([tc["query"]], "query: ", batch_size=1)
        per_query_ms.append((time.perf_counter() - q0) * 1000.0)
        query_embeddings.append(emb[0])
    query_embeddings = torch.stack(query_embeddings, dim=0)

    scores = query_embeddings @ passage_embeddings.T
    record_ids = [r["evidence_id"] for r in records]
    dense_ranked = {}
    dense_scores = {}
    for idx, tc in enumerate(cases):
        order = torch.argsort(scores[idx], descending=True).tolist()
        dense_ranked[tc["id"]] = [record_ids[j] for j in order[:5]]
        dense_scores[tc["id"]] = [
            {"evidence_id": record_ids[j], "cosine": float(scores[idx, j])}
            for j in order[:5]
        ]

    # Deterministic hybrid: reciprocal-rank fusion over frozen lexical top-5 + dense top-5.
    # Exact lexical hits get a fixed dominant bonus so exact identifiers/hashes remain authoritative.
    hybrid_ranked = {}
    for tc in cases:
        qid = tc["id"]
        lex_case = next(c for c in lexical["cases"] if c["id"] == qid)
        lex_candidates = lex_case["result"]["candidates"]
        lex_ids = [x["evidence_id"] for x in lex_candidates]
        den_ids = dense_ranked[qid]
        union = list(dict.fromkeys(lex_ids + den_ids))
        lex_pos = {x: i + 1 for i, x in enumerate(lex_ids)}
        den_pos = {x: i + 1 for i, x in enumerate(den_ids)}
        exact = {x["evidence_id"] for x in lex_candidates if x.get("exact")}
        fused = []
        for eid in union:
            score = 0.0
            if eid in lex_pos:
                score += 1.0 / (60.0 + lex_pos[eid])
            if eid in den_pos:
                score += 1.0 / (60.0 + den_pos[eid])
            if eid in exact:
                score += 1.0
            fused.append((eid, score))
        fused.sort(key=lambda x: (-x[1], x[0]))
        hybrid_ranked[qid] = [eid for eid, _ in fused[:5]]

    dense_metrics = evaluate(cases, dense_ranked)
    hybrid_metrics = evaluate(cases, hybrid_ranked)

    # Preserve stale/revoked metadata as immutable evidence metadata.
    q16_dense = dense_ranked.get("q16", [])
    q16_hybrid = hybrid_ranked.get("q16", [])
    rec_by_id = {r["evidence_id"]: r for r in records}
    stale_check = {
        "query_id": "q16",
        "target": "ev-aster2-revoked",
        "dense_top5_contains_target": "ev-aster2-revoked" in q16_dense,
        "hybrid_top5_contains_target": "ev-aster2-revoked" in q16_hybrid,
        "target_acceptance_status": rec_by_id["ev-aster2-revoked"]["acceptance"]["status"],
        "target_invalidated_at": rec_by_id["ev-aster2-revoked"]["validity"]["invalidated_at"],
    }

    result = {
        "experiment": "multilingual-e5-small-v1",
        "scope": {
            "fixture": "evidence/frozen-v1.json",
            "private_inbox_used": False,
            "other_models_used": False,
            "reranker_used": False,
            "acceptance_authority_changed": False,
        },
        "artifact": artifact,
        "runtime": {
            "python": sys.version,
            "platform": platform.platform(),
            "torch": torch.__version__,
            "transformers": transformers.__version__,
            "numpy": np.__version__,
            "cpu_count": psutil.cpu_count(logical=True),
            "torch_num_threads": torch.get_num_threads(),
            "model_load_seconds": load_seconds,
            "passage_encode_seconds": passage_encode_seconds,
            "query_latency_ms_p50": statistics.median(per_query_ms),
            "query_latency_ms_p95": percentile(per_query_ms, 0.95),
            "query_latency_ms_all": per_query_ms,
            "embedding_dimension": int(passage_embeddings.shape[1]),
            "embedding_index_bytes_float32": int(passage_embeddings.numel() * passage_embeddings.element_size()),
            "peak_rss_bytes": int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024),
        },
        "metrics": {
            "exact_lexical": lex_metrics,
            "dense_only_forced_topk": dense_metrics,
            "hybrid_rrf_forced_topk": hybrid_metrics,
        },
        "dense_top5_with_scores": dense_scores,
        "stale_revoked_check": stale_check,
        "notes": [
            "Dense/hybrid results are candidate-generation measurements only, not evidence acceptance.",
            "No absolute cosine threshold was fitted on this frozen evaluation set.",
            "A no-evidence query with emitted dense/hybrid candidates counts as a false-candidate generation event.",
            "Operator acceptance status was excluded from dense passage text and from the lexical searchable text in this experiment branch.",
        ],
    }
    RESULT_PATH.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
