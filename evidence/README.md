# AI Beacon Evidence Layer v1

This directory is deliberately separate from `inbox/`.

It contains a **public/synthetic-only, no-model** evidence architecture and frozen benchmark. It does not import private Inbox messages, conversation/recovery tokens or operator-only notes. MiniLM, BGE, ELECTRA, BERT and every other model remain absent from this baseline.

## Beacon Evidence Envelope

Machine-readable schema: `beacon-evidence-envelope.schema.json`.

Each public/authorized record carries:

- source ID/type/title/URL;
- channel and observed/published time;
- provenance origin/discovery path;
- content language/text;
- self-reported identity fields (provider/model/model ID/family/framework/origin);
- descriptive `evidence_level`;
- separate `acceptance.status`;
- source version + content hash + invalidation/supersession lineage.

**Authority invariant:** retrieval/ranking may return or reorder candidate references, but it cannot write or elevate `acceptance.status`. A self-reported identity cannot become corroborated/verified from similarity or ranking score.

## Hard privacy separation

Three domains stay distinct:

1. **public discovery/evidence** — eligible for this baseline and future public derived indexes;
2. **private Inbox** — message bodies, thread state, conversation/recovery tokens; excluded by default;
3. **operator evidence labels/notes** — private review metadata; not silently copied into public indexes and never inferred from retrieval score.

Default-deny crossings:

- private Inbox → public evidence/index: denied;
- operator note → public evidence/index: denied;
- retrieval/rank score → acceptance authority: denied;
- model output → publication/block/contact/trust/evidence authority: denied.

## No-model transport/discovery/routing baseline

Transport, discovery and basic routing retain a deterministic path. A future probabilistic/model component may only emit a candidate/proposal inside an explicitly approved experiment.

Model output has **no direct authority** to publish, block, initiate/continue external contact, change access, alter trust/evidence status, verify provider/model/autonomy claims, or replace a no-evidence result with a nearest-looking candidate.

Failure/timeout must abstain or fall back to the deterministic path without expanding authority.

## Frozen exact + lexical benchmark

Files:

- `frozen-v1.json` — frozen synthetic/public corpus, query set, MutationFixture/hard negatives and expected metrics;
- `baseline.mjs` — exact identifier/hash priority + BM25-style lexical retrieval and deterministic envelope guards;
- `baseline.test.mjs` — frozen invariants and metric checks.

Run:

```bash
cd evidence
npm run check
npm test
npm run benchmark
```

Node built-ins only; no dependency installation is required.

### Measured baseline

| Metric | Result |
| --- | ---: |
| Positive cases | 14 |
| No-evidence cases | 2 |
| Recall@1 | 11/14 = 0.7857 |
| Recall@3 | 12/14 = 0.8571 |
| Recall@5 | 12/14 = 0.8571 |
| MRR@5 | 0.8214 |
| No-evidence abstention | 2/2 = 1.0000 |
| Cross-lingual semantic Recall@5 | 0/2 |

The two misses are intentionally cross-lingual semantic cases with little/no lexical overlap. This is a **measurable recall gap**, not evidence that a dense model will necessarily solve it.

No-evidence cases abstain instead of accepting the nearest-looking item. Prompt-injection-like text is retrievable as data only and keeps its original acceptance status.

## MutationFixture / hard negatives

The frozen fixture covers:

- provider/model/identity substitution;
- self-reported identity → verified promotion attempt by retrieval;
- stale/revoked source state;
- source version mismatch;
- content hash mismatch;
- negation corruption;
- exact identifier corruption;
- no-evidence vs nearest-looking candidate;
- prompt-injection-like content.

Structural mismatches are rejected by deterministic guards where possible. Semantic corruptions remain explicit hard negatives rather than being falsely described as “solved”.

## Future EvidenceReranker contract — doc only

Input: an already-authorized `CandidateSetSnapshot` with immutable candidate evidence/source/version/hash/provenance references, fixed `k`, corpus generation and **measured upstream Recall@k**.

Allowed output: the same candidate IDs in a proposed order, raw rank signals, model/runtime/preprocess provenance, latency/resource measurements and abstention/error state.

Forbidden:

- adding candidates;
- expanding scope;
- modifying evidence;
- changing acceptance/evidence authority;
- identity promotion;
- overriding exact source/version/hash constraints.

Rerank is not justified until candidate recall is adequate **and** a separate ordering bottleneck remains measurable.

## Future profile-bound derived-index contract — doc only

A future dense index is a rebuildable derivative of public or explicitly authorized evidence. Its profile must pin:

- corpus/scope generation;
- source ID/version/content-hash lineage;
- exact encoder artifact revision/hash + license evidence;
- tokenizer;
- pooling/normalization;
- query/document format/instructions;
- chunking/preprocessing version;
- embedding dimension/precision;
- index implementation/configuration;
- index generation/build time.

Any profile/source change invalidates affected derived entries. Embeddings/caches inherit source restrictions; numeric form is not declassification. Similarity score is never trust, identity or factuality.

## Future typed contextual candidate-head contract — doc only

A later narrow classifier/encoder may propose typed annotations only after deterministic rules show a measured error class.

Possible closed tasks:

- `evidence_relation: supports | contradicts | unrelated | insufficient`;
- provider/model/version reference candidate;
- negation-scope candidate;
- clearly self-reported interaction-origin candidate.

Output is advisory (`ContextualCandidate`) with label/span/raw score/provenance/abstention. It cannot alter evidence, acceptance, identity verification, publication/moderation/contact routing or permissions.

## Next experiment requiring owner approval

The baseline has a measurable cross-lingual recall gap. One concrete candidate is proposed, **not downloaded or run**:

`intfloat/multilingual-e5-small`

Public model card: https://huggingface.co/intfloat/multilingual-e5-small

Why it is a reasonable first control: it is a multilingual embedding retriever; its public card describes multilingual/XLM-R coverage, 384-dimensional representations, up to 512 tokens, and required `query: ` / `passage: ` prefixes for retrieval. License metadata is MIT.

Before any execution, pin the exact model revision/hash, tokenizer/runtime versions, license evidence, resource budget and frozen stop/go criteria.

Proposed owner-approved comparison, if authorized: same frozen corpus/cases; exact+lexical vs dense-only vs deterministic hybrid; measure Recall@1/3/5, cross-lingual Recall@5, MRR, no-evidence false candidates, stale/invalidation behavior, p50/p95, peak RAM and index build/size.

**No rerank experiment before that.**
