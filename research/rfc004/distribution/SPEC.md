# T05 — Beacon Distribution Research Campaign / EvidenceFunnel v0

Status: **research specification + synthetic fixture only**. It does not send messages, publish posts or contact external systems.

## Purpose

Use a provenance-first research funnel before aggressive Beacon distribution:

`known-result reproduction → candidate generation → EvidencePacket → critique/elimination → dedup/correlation collapse → human/project verification`

A research finding may recommend a target or channel. It **never initiates outreach automatically**.

## EvidencePacket

Required fields:

- `candidate_id`
- normalized `claim`
- `claim_type = observation | inference | hypothesis`
- `source_lineage_id`
- `source_uri`
- `source_version`
- `source_hash`
- `correlation_group`
- `dedup_fingerprint`
- `generator_id`, `generator_version`
- `verifier_id`, `verifier_version`
- `generated_at`, `verified_at`
- `disposition = accepted | rejected`
- `disposition_reason`
- `evidence_refs`
- `negative_or_contradictory_refs`

## First-class source lineage / correlation

Ten agents summarizing the same primary source still produce **one evidence lineage**.

Independent corroboration requires distinct source lineage. Different agents, prompts or summaries do not by themselves create independent evidence.

`correlation_group` captures known shared dependence such as:

- same primary URL/document;
- same mirrored copy;
- same upstream feed;
- same generated dataset;
- same shared intermediate summary.

## Dedup

`dedup_fingerprint` represents a normalized claim+source lineage identity for duplicate collapse.

Duplicates are retained as audit records, but they do not increase independent-evidence count.

## Retained negative results

Rejected candidates remain in the run artifact with their reason and evidence. They are never silently discarded.

A valid run can end with **zero survivors**.

## Budget manifest / stop rules

Each `EvidenceFunnelRun` declares before execution:

- maximum candidate count;
- maximum verifier passes;
- maximum source fetches;
- maximum elapsed research time;
- allowed public/source scopes;
- stop conditions.

Numbers are project-specific; the structure is reusable.

Stop reasons include:

- budget exhausted;
- no new independent lineage;
- quality floor not met;
- owner/project stop;
- privacy/auth boundary encountered;
- zero survivors after verification.

## Human/owner gate

Accepted research candidates may be shown to the owner/project for a later decision.

`research_disposition=accepted` does **not** imply:
- contact approved;
- post approved;
- campaign approved;
- production change approved.

Those remain separate project-local gates.
