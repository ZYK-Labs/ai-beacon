# T01 — BeaconEventRef v0

Status: **design + synthetic fixture only**. No production streaming/schema change is authorized.

## Contract

`BeaconEventRef` is a compact change notification that points to authoritative local/canonical state. It is **not** the source of truth and it is **not** a credential.

Required fields:

- `event_id` — globally unique event identifier used for idempotency.
- `stream_id` — ordering domain. Sequence numbers are meaningful only inside this stream.
- `entity_type`, `entity_id` — target entity identity.
- `event_type` — typed change notification.
- `seq` — monotonically increasing stream-local sequence.
- `state_ref` — opaque reference to authoritative state.
- `state_version` — exact version expected at dereference.
- `state_hash` — exact content/version hash expected at dereference.
- `required_scope` — capability/scope required to dereference protected state.
- `occurred_at` — diagnostic event time, never a global ordering authority.
- optional `delta` — bounded convenience data. The delta is never authoritative unless a future contract explicitly says so.

## Authoritative-state rule

The canonical store owns state. The event only states that a particular version/hash exists at `state_ref`.

A consumer must never infer a newer/older state from arrival order alone. Dereference succeeds only if:

1. the receiver has `required_scope`;
2. `state_ref` exists;
3. entity identity matches;
4. `state_version` matches;
5. `state_hash` matches.

A mismatch is a reconcile/replay condition, not permission to accept "close enough" state.

## Ordering / replay / loss

- `seq` is stream-local only.
- Duplicate `event_id` or an already-applied `seq` is idempotently ignored.
- `seq > expected_seq` is an explicit gap and must be detected.
- Out-of-order later events may be buffered within a bounded window, but cannot be applied before the missing predecessor.
- Restart resumes from persisted `last_applied_seq` and replays canonical history.
- An unresolved gap ends in degraded/reconcile state; it is never silently skipped.
- No cross-stream causal order is inferred from timestamps.

## Burst / backpressure

The consumer has a bounded queue. If input exceeds the queue budget, it must apply backpressure or enter a safe degraded/reconcile state rather than silently discard events.

## Synthetic acceptance target

`fixture.json` and `verify.mjs` exercise:

- duplicate;
- loss;
- out-of-order;
- restart/replay;
- stale version/hash;
- unauthorized dereference;
- bounded delta;
- burst/backpressure;
- FullPayload-vs-EventRef byte comparison.

Required design-fixture outcomes:

- **100% injected-gap detection**;
- deterministic replay;
- idempotent duplicate handling;
- **zero unauthorized dereference**.

The byte comparison is diagnostic only; no historical Mahowald byte-reduction claim is used.
