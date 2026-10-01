# AI-BEACON — PROJECT STATE

**Checkpoint:** 2026-10-01 — expanded multilingual E5 retrieval study completed

## Evidence Envelope — DONE
Public/authorized evidence retains explicit source/provenance/time/channel, self-reported identity, evidence level, source version/hash/invalidation lineage and separate acceptance status. Retrieval/model output cannot promote a claim to verified/corroborated.

## Privacy boundary — DONE
Public discovery/evidence, private Inbox and operator evidence labels remain separate. Private Inbox data is excluded from the public benchmark/derived index by default. Operator acceptance status is not indexed as lexical/dense searchable text.

## No-model exact+lexical baseline — DONE
The original small frozen benchmark remains green. The expanded benchmark shows an important limitation: near-neighbor no-evidence queries can still produce lexical candidates. Therefore retrieval score alone is not an abstention/acceptance decision.

## multilingual-e5-small v1 — DONE
Small frozen benchmark showed measurable cross-lingual benefit and dense Recall@10 14/14, while no-evidence nearest-neighbor generation remained unresolved.

## multilingual-e5-small expanded v2 — DONE
Same pinned E5 revision; 28 synthetic/public records; 20 calibration queries; 36 held-out evaluation queries.

Evaluation:
- exact+lexical Recall@5: **87.5%**
- forced dense Recall@5: **100%**
- forced dense cross-lingual Recall@5: **100%**
- forced dense no-evidence false-candidate generation: **100%**
- calibration-only global cosine gate: positive Recall@5 **25%**, held-out no-evidence false-candidate rate **33.3%**
- gated hybrid: no improvement over lexical for this acceptance problem.

Conclusion: E5 is useful as a semantic candidate generator, but cosine/lexical score is not an evidence acceptance signal. A single global cosine threshold is rejected.

Full result:
`evidence/experiments/multilingual-e5-small-v2/RESULTS.md`

## Reranker gate — CLOSED
The current blocker is open-world acceptance/abstention, not ordering. A reranker cannot decide whether any candidate should be accepted as evidence and therefore is not justified yet.

## Production status
No dense model is integrated into production. The no-model transport/discovery/routing path remains authoritative. No model may directly publish, block, contact, change permissions, trust, identity or evidence acceptance.

## Retrieval work pause point
The retrieval experiment block is sufficiently characterized for now:
- exact/lexical strengths and failure mode known;
- dense semantic recall benefit measured;
- no-evidence nearest-neighbor failure measured;
- global cosine gating falsified;
- rerank remains blocked.

The next evidence-retrieval research question, when resumed, is a typed/deterministic acceptance-abstention contract rather than another ranking model.

## Product roadmap next
1. **Aggressive legitimate distribution / stronger Beacon signal.**
2. After that, a separate design RFC for **agent-to-agent communication**.
3. Owner requirement already recorded in Issue #12: permitted agents may converse peer-to-peer without an artificial turn limit, while retaining an explicit option to send an attributable message/escalation to the human owner.
