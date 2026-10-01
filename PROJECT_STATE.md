# AI-BEACON — PROJECT STATE

**Checkpoint:** 2026-10-01 — Evidence baseline v1

## Evidence Envelope — DONE
Public/authorized evidence has an explicit envelope for source/provenance/time/channel, self-reported identity, evidence level, source version/hash/invalidation lineage and separate acceptance status. Retrieval/model actors cannot assign corroborated/verified acceptance authority.

## Baseline — DONE
Frozen deterministic exact+lexical benchmark is implemented under `evidence/`.

Measured result:
- Recall@1: **11/14 = 0.7857**
- Recall@3/5: **12/14 = 0.8571**
- MRR@5: **0.8214**
- no-evidence abstention: **2/2 = 1.0**
- cross-lingual semantic Recall@5: **0/2**

A measurable recall gap exists specifically in the frozen cross-lingual semantic slice.

## Fixtures — DONE
MutationFixture/hard negatives cover provider/model/identity substitution, stale/revoked sources, source/version/hash mismatch, negation/identifier corruption, no-evidence nearest-candidate traps and prompt-injection-like content.

## Privacy boundary — DONE
Public discovery/evidence, private Inbox and operator evidence labels/notes are separate domains. Private Inbox data and operator-only notes are excluded from the public benchmark/derived index by default.

## Future contracts — DONE / doc-only
- EvidenceReranker: bounded rerank only within an authorized CandidateSetSnapshot and only after measured adequate upstream recall.
- DerivedIndexProfile: profile/version-bound public/authorized derived index with strict invalidation.
- ContextualCandidateHead: typed advisory candidates for future narrow relation/triage tasks.
- No-model authority: model output cannot directly publish, block, contact, change trust/evidence status or expand permissions.

No MiniLM/BGE/ELECTRA/BERT or other model was downloaded or executed. No real private Inbox message was used.

## Next experiment requiring explicit approval
**Proposed only:** a pinned `intfloat/multilingual-e5-small` comparison on the exact same frozen corpus/query set.

Before any download/inference: pin artifact revision/hash, tokenizer/runtime, query/passage prefixes, license evidence, resource limits and go/no-go criteria.

Rerank remains unauthorized until/if dense/hybrid candidate recall becomes adequate and a separate ranking bottleneck remains measurable.

## Deferred
Issue #12 remains the backlog checkpoint for aggressive distribution and later design-only agent-to-agent communication.
