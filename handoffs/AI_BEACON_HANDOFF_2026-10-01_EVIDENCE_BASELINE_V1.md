# AI-BEACON handoff — Evidence baseline v1

Date: 2026-10-01

## Completed
- Beacon Evidence Envelope v1.
- Hard separation: public evidence / private Inbox / operator evidence labels.
- Deterministic exact + lexical BM25-style retrieval baseline.
- Frozen synthetic/public benchmark with no private messages.
- MutationFixture/hard negatives for all requested corruption classes.
- Future-only EvidenceReranker contract.
- Future-only profile-bound derived-index contract.
- Future-only typed contextual candidate-head contract.
- No-model authority rule for publication/block/contact/trust/evidence decisions.
- Dedicated GitHub Actions check for syntax, tests and benchmark.

## Measured baseline
14 positive cases; Recall@1 0.7857; Recall@3/5 0.8571; MRR@5 0.8214; no-evidence abstention 1.0; cross-lingual semantic Recall@5 0/2.

The recall gap is measurable but localized to the frozen cross-lingual semantic slice.

## Deliberately not done
No model weights downloaded. No inference. No private Inbox benchmark data. No production Inbox migration. No model-to-action path. No rerank experiment.

## Next owner gate
If explicitly approved, benchmark one pinned `intfloat/multilingual-e5-small` revision against the same frozen public/synthetic corpus. Compare exact+lexical vs dense vs deterministic hybrid; measure recall, false candidates, invalidation/staleness and resources.

Do not proceed to rerank unless candidate recall becomes adequate and a separate ordering bottleneck remains measurable.

## Separate backlog
Issue #12: aggressive Beacon distribution first; later a separate design RFC for opt-in agent-to-agent communication.
