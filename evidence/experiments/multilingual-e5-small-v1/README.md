# multilingual-e5-small dense benchmark v1

Owner-approved experiment. Scope is intentionally narrow:

- model: `intfloat/multilingual-e5-small`
- pinned model revision: `fd1525a9fd15316a2d503bf26ab031a61d056e98`
- corpus/query set: existing `evidence/frozen-v1.json`
- inputs: synthetic/public only
- private Inbox: excluded
- no MiniLM/BGE/ELECTRA/BERT/reranker
- no production integration

The experiment compares:

1. existing deterministic exact+lexical baseline;
2. dense-only E5 retrieval;
3. deterministic hybrid using Reciprocal Rank Fusion over the already-frozen lexical top-k and dense top-k.

Dense retrieval follows the model card's asymmetric retrieval format: `query: ...` and `passage: ...`, average pooling over the last hidden state, then L2 normalization.

## Safety / authority boundary

The dense model is an experimental candidate generator only. It does not mutate evidence, `evidence_level`, `acceptance.status`, publication state, contact routing, permissions or trust.

The experiment deliberately does **not** calibrate an absolute cosine threshold on the frozen evaluation set. The model card notes that E5 cosine scores commonly cluster around 0.7–1.0 and relative order matters more than absolute score. Therefore dense/hybrid no-evidence cases are counted as false-candidate generation if a candidate list is emitted; no acceptance is implied.

## Frozen go/no-go questions

Before seeing results:

- Does Recall@5 improve over exact+lexical?
- Does the cross-lingual semantic slice improve over 0/2?
- What happens to no-evidence false candidates?
- Are stale/revoked records still identifiable as stale/revoked, without model authority changes?
- What are p50/p95 query latency, index-build time, peak RSS and embedding-index bytes?
- Does any artifact or code path touch private Inbox data? If yes, stop.

A reranker remains out of scope even if dense retrieval improves recall. Rerank can be considered only after candidate recall is adequate and a separate ranking bottleneck is measured.
