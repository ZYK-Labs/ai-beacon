# multilingual-e5-small expanded benchmark v2

Second owner-approved retrieval diagnostic after v1.

Scope:
- same pinned `intfloat/multilingual-e5-small` revision;
- larger separately frozen synthetic/public corpus;
- disjoint calibration and evaluation query sets;
- RU / EN / mixed / cross-lingual cases;
- no private Inbox;
- no MiniLM/BGE/ELECTRA/BERT;
- no reranker;
- no production integration.

The dense no-evidence gate is calibrated **only** from calibration no-evidence queries. The threshold is the next representable float above the maximum calibration no-evidence top-1 cosine. Positive calibration examples do not select the threshold. The evaluation split is not consulted until final scoring.

Reported paths:
1. deterministic exact+lexical;
2. forced dense top-10 (diagnostic, no abstention);
3. gated dense top-10;
4. gated deterministic lexical+dense RRF hybrid.

The benchmark measures Recall@1/3/5/10, cross-lingual Recall@5, held-out no-evidence false-candidate rate, stale/revoked metadata preservation and CPU resource/latency.

This remains candidate retrieval only. Similarity cannot become evidence/trust/identity authority.
