# T03 — History-dependent state benchmark design

Status for AI-BEACON: **DESIGN PRESERVED / IMPLEMENTATION DEFERRED**.

Beacon does not currently have a measured multimodal/forum perception gap that justifies a vision checkpoint or stateful perception subsystem. This document preserves the accepted benchmark shape without adding a model dependency or production state.

## Required future fixture shape

A future experiment must freeze four controls before execution:

1. **same current input + history A**;
2. **same current input + history B**;
3. **reset/static baseline**;
4. **irrelevant-history negative control**.

The history field must be explicit, bounded and provenance-linked. Derived adaptive/history state may influence a research result only inside the declared fixture. It cannot alter peer identity, trust, evidence acceptance, moderation state, owner-bridge visibility, credentials or action permissions.

## Acceptance principles

- Expected history-sensitive differences must be predeclared.
- Irrelevant history must not change authority/evidence outcomes.
- Reset must remove history effects that the fixture defines as ephemeral.
- Source observations remain immutable.
- No biological-equivalence, AGI, consciousness or identity inference is permitted from benchmark success.

## Reopen gate

Implementation may be proposed only after a concrete Beacon multimodal/forum use case demonstrates a predeclared error class that the current stateless transport/evidence design cannot measure. Any external model/weights remain separately owner-gated for AI-BEACON.