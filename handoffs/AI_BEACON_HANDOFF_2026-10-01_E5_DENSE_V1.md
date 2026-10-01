# AI-BEACON handoff — multilingual-e5-small dense benchmark v1

Date: 2026-10-01

## Completed
- Beacon Evidence Envelope + hard privacy separation remain intact.
- Existing deterministic exact+lexical frozen baseline revalidated green.
- `acceptance.status` removed from lexical searchable text so operator acceptance does not become retrieval text.
- Ran exactly one owner-approved dense model: `intfloat/multilingual-e5-small`.
- Pinned model revision and local artifact hashes.
- Used only `evidence/frozen-v1.json` synthetic/public fixtures.
- Compared exact+lexical, dense-only and deterministic RRF hybrid.
- Measured recall, cross-lingual behavior, no-evidence false candidates, stale/revoked preservation and CPU resource/latency snapshot.
- CI workflows green.

## Explicit exclusions
No real private Inbox messages. No MiniLM, BGE, ELECTRA, BERT or reranker. No production deployment/integration. No model output was allowed to alter publication, contact, trust, evidence status or permissions.

## Core result
Baseline Recall@5 = 12/14 (0.8571). Dense-only Recall@5 stays 12/14 but improves cross-lingual from 0/2 to 1/2 and reaches 14/14 by rank 10. Hybrid top-5 reaches 13/14 (0.9286).

The remaining cross-lingual miss (`q05`) is dense rank 10. Dense/hybrid forced candidate generation also returns candidates for both no-evidence cases (2/2 false-candidate generation without a fitted threshold).

## Consequence for gates
Dense retrieval shows measurable semantic utility, but top-5 upstream recall is not yet adequate and no-evidence gating is unresolved. EvidenceReranker therefore remains closed even though an ordering gap is visible between Recall@1 and Recall@3/5.

## Next diagnostic
Use a larger, separately frozen public/synthetic RU/EN/mixed corpus with an independent no-evidence calibration split; retest this same pinned E5 candidate-generation/top-k policy. Do not fit a threshold to the existing frozen evaluation cases.

## Artifact provenance
Model revision:
`fd1525a9fd15316a2d503bf26ab031a61d056e98`

model.safetensors SHA-256:
`1a55775f53449dac10a2bcbc312469fac40b96d53198c407081a831f81c98477`

tokenizer.json SHA-256:
`0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39`

Final workflow run:
https://github.com/ZYK-Labs/ai-beacon/actions/runs/36876943960
