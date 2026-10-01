import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(here, "fixture.json"), "utf8"));

function byteLength(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function stateMap() {
  return new Map(fixture.state_store.map(s => [s.state_ref, s]));
}

function applyStream(input, scopes, persisted = { lastSeq: 0, seen: new Set(), applied: [] }) {
  const states = stateMap();
  const buffer = new Map();
  const gaps = new Set();
  const rejected = [];
  const unauthorized = [];
  const duplicate = [];
  let expected = persisted.lastSeq + 1;
  const seen = new Set(persisted.seen);
  const applied = [...persisted.applied];

  function tryApply(event) {
    if (seen.has(event.event_id) || event.seq < expected) {
      duplicate.push(event.event_id);
      return;
    }
    if (event.seq > expected) {
      for (let n = expected; n < event.seq; n++) gaps.add(n);
      buffer.set(event.seq, event);
      return;
    }
    if (!scopes.has(event.required_scope)) {
      unauthorized.push(event.event_id);
      rejected.push({event_id:event.event_id,reason:"unauthorized"});
      return;
    }
    const state = states.get(event.state_ref);
    if (!state ||
        state.stream_id !== event.stream_id ||
        state.entity_type !== event.entity_type ||
        state.entity_id !== event.entity_id ||
        state.version !== event.state_version ||
        state.hash !== event.state_hash) {
      rejected.push({event_id:event.event_id,reason:"stale_or_mismatch"});
      return;
    }
    if (event.delta && byteLength(event.delta) > fixture.delta_max_bytes) {
      rejected.push({event_id:event.event_id,reason:"delta_too_large"});
      return;
    }
    seen.add(event.event_id);
    applied.push({seq:event.seq,event_id:event.event_id,state_ref:event.state_ref,state_version:event.state_version});
    gaps.delete(event.seq);
    expected++;
    while (buffer.has(expected)) {
      const next = buffer.get(expected);
      buffer.delete(expected);
      tryApply(next);
      if (rejected.some(x => x.event_id === next.event_id)) break;
    }
  }

  for (const event of input) tryApply(event);
  return {lastSeq:expected-1,seen,applied,gaps,rejected,unauthorized,duplicate,buffer};
}

function fullPayloadEvents() {
  const states = stateMap();
  return fixture.canonical_events.map(e => ({
    event_id:e.event_id,stream_id:e.stream_id,entity_type:e.entity_type,entity_id:e.entity_id,
    event_type:e.event_type,seq:e.seq,occurred_at:e.occurred_at,
    payload:states.get(e.state_ref).payload
  }));
}

function runBurst() {
  const {count,max_queue,consumer_batch}=fixture.faults.burst;
  const queue=[];
  let produced=0, consumed=0, backpressureCount=0, maxObserved=0;
  while (consumed < count) {
    while (produced < count && queue.length < max_queue) {
      queue.push(produced++);
      maxObserved=Math.max(maxObserved,queue.length);
    }
    if (produced < count && queue.length >= max_queue) backpressureCount++;
    for(let i=0;i<consumer_batch && queue.length;i++) {
      queue.shift(); consumed++;
    }
  }
  return {produced,consumed,backpressureCount,maxObserved};
}

export async function run() {
  assert.equal(fixture.synthetic_only,true);
  const scopes=new Set(fixture.principal_scopes);

  const baseline=applyStream(fixture.canonical_events,scopes);
  assert.equal(baseline.lastSeq,120);
  assert.equal(baseline.gaps.size,0);
  assert.equal(baseline.rejected.length,0);

  const dupSeq=fixture.faults.duplicate.duplicate_seq;
  const duplicateInput=[...fixture.canonical_events.slice(0,dupSeq),fixture.canonical_events[dupSeq-1],...fixture.canonical_events.slice(dupSeq)];
  const dup=applyStream(duplicateInput,scopes);
  assert.equal(dup.lastSeq,120);
  assert.equal(dup.applied.length,120);
  assert.ok(dup.duplicate.includes(fixture.canonical_events[dupSeq-1].event_id));

  const lossSeq=fixture.faults.loss.remove_seq;
  const lossInput=fixture.canonical_events.filter(e=>e.seq!==lossSeq);
  const loss=applyStream(lossInput,scopes);
  assert.ok(loss.gaps.has(lossSeq),"injected gap must be detected");
  assert.equal(loss.lastSeq,lossSeq-1);

  const a=fixture.faults.out_of_order.swap_seq_a;
  const b=fixture.faults.out_of_order.swap_seq_b;
  const oo=[...fixture.canonical_events];
  [oo[a-1],oo[b-1]]=[oo[b-1],oo[a-1]];
  const outOfOrder=applyStream(oo,scopes);
  assert.equal(outOfOrder.lastSeq,120);
  assert.equal(outOfOrder.gaps.size,0);
  assert.deepEqual(outOfOrder.applied,baseline.applied,"out-of-order replay must converge deterministically");

  const restartAt=fixture.faults.restart.after_seq;
  const first=applyStream(fixture.canonical_events.slice(0,restartAt),scopes);
  const persisted={lastSeq:first.lastSeq,seen:first.seen,applied:first.applied};
  const resumed=applyStream(fixture.canonical_events.slice(restartAt),scopes,persisted);
  assert.deepEqual(resumed.applied,baseline.applied,"restart replay must be deterministic");

  const stale=applyStream([...fixture.canonical_events,fixture.faults.stale_version],scopes);
  assert.ok(stale.rejected.some(x=>x.event_id===fixture.faults.stale_version.event_id && x.reason==="stale_or_mismatch"));

  const unauthorized=applyStream([...fixture.canonical_events,fixture.faults.unauthorized],new Set());
  assert.equal(unauthorized.applied.length,0,"unauthorized principal must dereference zero states");
  assert.ok(unauthorized.unauthorized.length>=1);

  for(const e of fixture.canonical_events) {
    if(e.delta) assert.ok(byteLength(e.delta)<=fixture.delta_max_bytes);
  }

  const burst=runBurst();
  assert.equal(burst.produced,fixture.faults.burst.count);
  assert.equal(burst.consumed,fixture.faults.burst.count);
  assert.ok(burst.maxObserved<=fixture.faults.burst.max_queue);
  assert.ok(burst.backpressureCount>0,"burst must exercise backpressure");

  const fullBytes=byteLength(fullPayloadEvents());
  const refBytes=byteLength(fixture.canonical_events);
  assert.ok(refBytes<fullBytes,"synthetic EventRef should be smaller than FullPayload for this fixture");

  console.log(JSON.stringify({
    fixture:fixture.fixture_version,
    canonical_events:fixture.canonical_events.length,
    full_payload_bytes:fullBytes,
    event_ref_bytes:refBytes,
    gap_detection:"100% of injected loss seq detected",
    deterministic_replay:true,
    idempotency:true,
    unauthorized_dereferences:0,
    burst
  },null,2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await run();
