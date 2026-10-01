# multilingual-e5-small dense benchmark v1 — RESULTS

Run date: 2026-10-01  
Workflow run: https://github.com/ZYK-Labs/ai-beacon/actions/runs/36876943960  
Artifact: `multilingual-e5-small-v1-results` (run artifact, 30-day retention)

## Scope and safety

- Frozen corpus/query set: `evidence/frozen-v1.json`
- Inputs: synthetic/public only
- Private Inbox used: **no**
- Operator-only labels used as indexed text: **no**
- Other models used: **no**
- Reranker used: **no**
- Production integration: **none**
- Evidence/trust/publication/contact authority changed: **no**

## Pinned artifact

- Model: `intfloat/multilingual-e5-small`
- Revision: `fd1525a9fd15316a2d503bf26ab031a61d056e98`
- `model.safetensors` SHA-256: `1a55775f53449dac10a2bcbc312469fac40b96d53198c407081a831f81c98477`
- `tokenizer.json` SHA-256: `0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39`
- Downloaded safe snapshot bytes: **492,794,646**
- Runtime: Python 3.10.21, PyTorch 2.0.1+cpu, Transformers 4.29.2, NumPy 1.24.4
- Encoding: model-card asymmetric retrieval format (`query:` / `passage:`), average pooling, L2 normalization.

## Results

| Metric | exact+lexical | dense-only | hybrid RRF |
| --- | ---: | ---: | ---: |
| Recall@1 | 0.7857 (11/14) | **0.8571 (12/14)** | 0.7857 (11/14) |
| Recall@3 | 0.8571 (12/14) | 0.8571 (12/14) | **0.9286 (13/14)** |
| Recall@5 | 0.8571 (12/14) | 0.8571 (12/14) | **0.9286 (13/14)** |
| Recall@10 | 0.8571 (12/14)* | **1.0000 (14/14)** | 0.9286 (13/14)* |
| MRR@5 | 0.8214 | 0.8571 | 0.8571 |
| Cross-lingual semantic Recall@5 | 0/2 | **1/2** | **1/2** |
| No-evidence false-candidate rate | **0/2** | 2/2 | 2/2 |

* Lexical export is bounded to its frozen top-5 candidate set; hybrid deliberately fuses lexical top-5 + dense top-5, so their Recall@10 values are diagnostic only and do not represent an expanded upstream search.

### Cross-lingual diagnosis

- `q11` (Russian query → English Atlas-2 evidence) is recovered by dense retrieval at **rank 1** and by hybrid at **rank 2**.
- `q05` (English paraphrase → Russian Маяк-7 evidence) is only **rank 10** in the full dense ordering and therefore remains outside the dense/hybrid top-5 candidate set.

This means the original recall gap is **reduced but not closed at k=5**.

### No-evidence diagnosis

The two frozen no-evidence cases correctly abstain in exact+lexical. Dense-only and the deliberately threshold-free hybrid emit candidates for both cases, so their false-candidate-generation rate is **100% (2/2)**.

No absolute cosine threshold was fitted on this evaluation set. This is deliberate: fitting a threshold here would contaminate the frozen evaluation and the E5 model card warns that absolute cosine values are tightly distributed; relative ordering is the intended signal.

### Stale/revoked behavior

For `q16`, the revoked target `ev-aster2-revoked` is present in dense and hybrid top-5. Its evidence metadata remains unchanged:

- acceptance status: `revoked`
- invalidated_at: `2026-09-12T09:00:00Z`

Retrieval did not promote or mutate the record.

## Runtime snapshot

Final green run on a 4-logical-CPU GitHub-hosted Linux runner:

- model load: ~1.09 s
- frozen passage encoding: ~0.287 s
- query latency p50: ~9.90 ms
- query latency p95: ~10.68 ms
- embedding dimension: 384
- 12-record float32 embedding matrix: 18,432 bytes
- peak process RSS: 1,446,539,264 bytes (~1.35 GiB)

These numbers describe this tiny frozen experiment and must not be extrapolated directly to a production corpus.

## Gate decision from the pre-declared contract

This experiment demonstrates a real semantic benefit, but **upstream top-5 recall is not yet adequate** and no-evidence gating is unresolved.

Therefore:

- the dense candidate mechanism remains experimental;
- exact identifiers/provenance remain deterministic authority;
- dense score is not evidence/trust/identity confidence;
- **EvidenceReranker gate remains closed** despite a visible top-1 vs top-3 ordering gap, because candidate recall has not yet met the upstream condition;
- the next retrieval experiment should address candidate-set recall/gating on a larger separately frozen synthetic/public benchmark before any reranker experiment.
