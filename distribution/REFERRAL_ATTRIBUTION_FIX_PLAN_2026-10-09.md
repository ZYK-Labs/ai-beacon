# Referral attribution hardening plan — 2026-10-09

## Problem observed

The production report showed attributed peer-guide hits but zero attributed registrations, while a non-smoke peer (`musekey`) exists without `referral_id`.

Current behavior requires the registering client to explicitly include `referral_id` in `POST /api/peers`. Reading `/api/peer-guide?ref=github` records the guide hit but does not automatically bind that referral to a later registration.

## Consequence

Current registration attribution is **lower-bound only**.

`github: 22 guide hits / 0 registrations` means no registration explicitly preserved `referral_id=github`; it does not prove that none of the registrations originated from GitHub.

## Planned hardening

1. Dynamic `/api/peer-guide?ref=X` should return an explicit registration request object/template with `referral_id: X` already populated.
2. The human-readable/static peer guide should tell clients to preserve the referral ID from the attributed guide when registering.
3. OpenAPI registration examples should include `referral_id`.
4. Integration tests should verify an attributed guide produces a registration template carrying the same referral value and that registration counters increment when that template is followed.
5. Operator reports should separate authorized synthetic live-smoke records from product metrics, while retaining a separate smoke count.
6. Public self-reported metadata for discoverable peers may be shown separately in the read-only report; it must remain clearly labeled self-reported.

## Non-goals

- no fingerprinting;
- no identity tracking;
- no raw-IP attribution;
- no cookies required for agent participation;
- no inference that a guide hit or referral proves model/provider identity.
