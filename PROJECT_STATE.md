# AI-BEACON — PROJECT STATE

**Checkpoint:** 2026-10-01 — multilingual-e5-small dense benchmark v1 completed

## Evidence Envelope — DONE
Public/authorized evidence has an explicit envelope for source/provenance/time/channel, self-reported identity, evidence level, source version/hash/invalidation lineage and separate acceptance status. Retrieval/model actors cannot assign corroborated/verified acceptance authority.

## Privacy boundary — DONE
Public discovery/evidence, private Inbox and operator evidence labels/notes remain separate domains. Private Inbox data and operator-only notes are excluded from the public benchmark/derived index by default. The lexical searchable text was tightened so `acceptance.status` is not indexed.

## Exact + lexical baseline — DONE
Frozen result:
- Recall@1: **11/14 = 0.7857**
- Recall@3/5: **12/14 = 0.8571**
- MRR@5: **0.8214**
- no-evidence abstention: **2/2 = 1.0**
- cross-lingual semantic Recall@5: **0/2**

## multilingual-e5-small dense experiment — DONE
Owner-approved, public/synthetic only. No private Inbox, no MiniLM/BGE/ELECTRA/BERT, no reranker and no production integration.

Pinned model:
`intfloat/multilingual-e5-small@fd1525a9fd15316a2d503bf26ab031a61d056e98`

Measured:
- dense Recall@1: **12/14 = 0.8571**
- dense Recall@5: **12/14 = 0.8571**
- dense Recall@10: **14/14 = 1.0**
- dense cross-lingual Recall@5: **1/2**
- hybrid RRF Recall@5: **13/14 = 0.9286**
- hybrid cross-lingual Recall@5: **1/2**
- dense/hybrid no-evidence false-candidate rate without a fitted threshold: **2/2**
- missed cross-lingual q05 target appears at dense rank **10**
- revoked evidence remains revoked; retrieval did not mutate acceptance/evidence authority.

Runtime snapshot: p50 ~9.90 ms/query, p95 ~10.68 ms/query, peak RSS ~1.35 GiB on the final GitHub-hosted CPU run.

Full result: `evidence/experiments/multilingual-e5-small-v1/RESULTS.md`.

## Fixtures — DONE
MutationFixture/hard negatives cover provider/model/identity substitution, stale/revoked sources, source/version/hash mismatch, negation/identifier corruption, no-evidence nearest-candidate traps and prompt-injection-like content.

## Future contracts
- EvidenceReranker: **gate remains CLOSED**. There is an ordering gap, but top-5 candidate recall is not yet adequate.
- DerivedIndexProfile: contract exists; dense index remains experimental and public/authorized only.
- ContextualCandidateHead: doc-only; not exercised.
- No-model authority: unchanged; model output cannot directly publish, block, contact, change trust/evidence status or expand permissions.

## Next retrieval experiment
Before reranking: expand/freeze a larger public/synthetic RU/EN/mixed benchmark with an independent no-evidence calibration split, then retest the same pinned E5 candidate-generation policy/top-k. Do not tune an absolute threshold on the existing frozen evaluation set.

No new model is required for that next diagnostic. Rerank remains blocked until upstream candidate recall and no-evidence behavior are adequate.

## Deferred
Issue #12 remains the backlog checkpoint for aggressive distribution and later design-only agent-to-agent communication.
