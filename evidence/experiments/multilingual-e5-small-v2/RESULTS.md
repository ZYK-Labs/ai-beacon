# multilingual-e5-small expanded benchmark v2 — RESULTS

Run date: 2026-10-01  
Workflow run: https://github.com/ZYK-Labs/ai-beacon/actions/runs/36879900496

## Scope

This run used only the separately frozen synthetic/public benchmark in `expanded-v2.json`.

- corpus records: **28**
- calibration queries: **20** (10 positive + 10 no-evidence)
- evaluation queries: **36** (24 positive + 12 no-evidence)
- languages: RU / EN / mixed / cross-lingual
- private Inbox: **not used**
- operator-only acceptance labels as embedding text: **not used**
- other models: **not used**
- reranker: **not used**
- production integration: **none**

Model remained pinned to:

`intfloat/multilingual-e5-small@fd1525a9fd15316a2d503bf26ab031a61d056e98`

Artifact hashes remained identical to v1:

- model.safetensors SHA-256: `1a55775f53449dac10a2bcbc312469fac40b96d53198c407081a831f81c98477`
- tokenizer.json SHA-256: `0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39`

## Calibration rule frozen before evaluation

A deliberately simple score gate was tested.

Threshold = the next representable float above the **maximum top-1 cosine among calibration no-evidence queries**.

Observed calibration maximum: **0.8929644227**  
Frozen gate threshold: **0.8929644823**

Positive calibration examples were not used to choose the threshold, and evaluation queries were untouched until the threshold was fixed.

## Evaluation result

| Path | Recall@1 | Recall@3 | Recall@5 | Recall@10 | Cross-lingual R@5 | No-evidence false-candidate rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| exact+lexical | 70.8% | 83.3% | 87.5% | 87.5% | 81.25% | **100%** |
| forced dense | 62.5% | **100%** | **100%** | **100%** | **100%** | **100%** |
| gated dense | 25.0% | 25.0% | 25.0% | 25.0% | 0% | 33.3% |
| gated lexical+dense hybrid | 70.8% | 83.3% | 87.5% | 87.5% | 81.25% | **100%** |

## What this establishes

### 1. E5 closes the recall gap on this expanded positive set

Forced dense retrieval found **24/24 positive evaluation cases by k=3**, including **all 16/16 cross-lingual cases by k=5**.

So the semantic recall effect seen in v1 was real and becomes stronger on the expanded synthetic set.

### 2. The earlier no-evidence success of lexical retrieval did not generalize

The small v1 benchmark had only two no-evidence cases and lexical abstained on both.

The expanded benchmark deliberately contains near-neighbor no-evidence queries that share real provider/domain terms while naming a nonexistent model or claim. Under those harder cases, the existing lexical minimum-score rule emitted candidates for **12/12** evaluation no-evidence queries.

Therefore the previous 2/2 abstention result must not be treated as evidence that lexical retrieval solves open-world no-evidence detection.

### 3. Dense nearest-neighbor retrieval is excellent candidate generation but not an evidence acceptance gate

Forced E5 produced full positive Recall@5, but also emitted candidates for all no-evidence queries. That is expected nearest-neighbor behavior and confirms the architectural rule:

**similarity score is not evidence/trust/identity authority.**

### 4. A single global cosine threshold is a NO-GO

The calibration-only threshold correctly forced 0/10 false candidates on calibration, but generalized badly:

- held-out no-evidence false-candidate rate: **4/12 = 33.3%**
- positive Recall@5 collapsed to **6/24 = 25%**
- cross-lingual Recall@5 collapsed to **0/16**

So a global E5 cosine cutoff does not solve the evidence/no-evidence decision problem and destroys the semantic recall that justified dense retrieval.

### 5. The hybrid cannot repair acceptance if lexical itself accepts near-neighbor evidence

The gated hybrid falls back to lexical candidates when the dense gate rejects a query. Because the expanded lexical baseline itself emits nearest-looking candidates for all no-evidence evaluation cases, the hybrid also reaches 100% no-evidence false-candidate generation.

This is not a ranking problem. It is an **acceptance/abstention problem upstream of any reranker**.

## Stale/revoked boundary

All four frozen revoked records retained their original `acceptance.status = revoked` and `invalidated_at` metadata. Dense retrieval did not mutate evidence state or authority.

## Runtime snapshot

Final CPU run on GitHub-hosted 4-logical-CPU Linux:

- model load: ~1.20 s
- encoding all 28 passages: ~1.10 s
- query latency p50: ~18.19 ms
- query latency p95: ~20.40 ms
- embedding dimension: 384
- float32 embedding matrix: 43,008 bytes
- peak RSS: ~1.35 GiB

These measurements describe the small frozen experiment only.

## Gate status

**Dense semantic candidate generation: evidence of utility confirmed.**  
**Dense score as acceptance/no-evidence authority: rejected.**  
**Single global cosine threshold: rejected.**  
**Reranker: remains closed.**

Reason: positive candidate recall is now adequate in forced dense retrieval, but the remaining bottleneck is not candidate ordering. The unresolved issue is deterministic/typed evidence acceptance and open-world abstention. A reranker would only reorder plausible candidates and would not answer whether any candidate should be accepted at all.

For now the production/no-model path remains unchanged. Dense retrieval stays experimental and has no authority over publication, contact, trust, identity or evidence acceptance.
