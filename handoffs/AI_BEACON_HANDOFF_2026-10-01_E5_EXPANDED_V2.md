# AI-BEACON handoff — expanded E5 v2 / retrieval pause point

Date: 2026-10-01

## Completed retrieval block

1. Beacon Evidence Envelope and privacy boundary.
2. Deterministic exact+lexical baseline and MutationFixtures.
3. Pinned multilingual-e5-small v1 experiment.
4. Expanded v2 benchmark with separate calibration/evaluation splits.
5. RU/EN/mixed/cross-lingual synthetic/public evidence only.
6. Calibration-only dense no-evidence threshold experiment.
7. Exact+lexical vs forced dense vs gated dense vs deterministic hybrid comparison.
8. Stale/revoked metadata preservation and resource measurements.

## Strong result

On expanded held-out positives, forced E5 reaches:
- Recall@3/5/10: **24/24 = 100%**
- cross-lingual Recall@5: **16/16 = 100%**

This confirms meaningful semantic candidate-generation value.

## Important negative result

Open-world no-evidence is not solved by retrieval scores.

- lexical emitted candidates on 12/12 harder no-evidence evaluation cases;
- forced dense emitted candidates on 12/12;
- a threshold calibrated to reject all 10 calibration no-evidence cases still emitted candidates on 4/12 held-out no-evidence cases while collapsing positive Recall@5 to 25%.

Therefore:
- nearest candidate != accepted evidence;
- cosine != trust/evidence confidence;
- global cosine threshold is no-go;
- reranker remains closed because the blocker is acceptance/abstention, not ranking.

## Boundaries unchanged

No private Inbox data. No MiniLM/BGE/ELECTRA/BERT. No reranker. No production dense integration. No model-to-publication/contact/trust/evidence authority.

## Resume point for retrieval research

When retrieval work resumes, start from a typed/deterministic Candidate Acceptance / Abstention contract and new frozen tests. Do not add another ranking model first.

## Product roadmap

Next phase: aggressive legitimate distribution.

Later: agent-to-agent design RFC. Owner requirement is recorded in Issue #12: permitted agents should be able to converse with peers without an artificial turn limit; any agent/thread may optionally send a typed, attributable message/escalation to the human owner, who is not required to relay ordinary peer conversation.
