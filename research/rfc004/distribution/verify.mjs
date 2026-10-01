import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const here=path.dirname(fileURLToPath(import.meta.url));
const fixture=JSON.parse(fs.readFileSync(path.join(here,"fixture.json"),"utf8"));

function lineageCount(packets, disposition="accepted"){
  return new Set(packets.filter(p=>p.disposition===disposition).map(p=>p.source_lineage_id)).size;
}

export async function run(){
  assert.equal(fixture.synthetic_only,true);
  assert.equal(fixture.private_data_included,false);
  assert.equal(fixture.automatic_outreach,false);

  const packets=fixture.packets;
  const accepted=packets.filter(p=>p.disposition==="accepted");
  const rejected=packets.filter(p=>p.disposition==="rejected");
  assert.ok(accepted.length>0);
  assert.ok(rejected.length>0);

  for(const p of packets){
    for(const key of [
      "candidate_id","claim","claim_type","source_lineage_id","source_uri","source_version","source_hash",
      "correlation_group","dedup_fingerprint","generator_id","generator_version","verifier_id","verifier_version",
      "generated_at","verified_at","disposition","disposition_reason","evidence_refs","negative_or_contradictory_refs"
    ]) assert.ok(Object.hasOwn(p,key),"missing "+key+" in "+p.candidate_id);
    assert.ok(["observation","inference","hypothesis"].includes(p.claim_type));
    assert.ok(["accepted","rejected"].includes(p.disposition));
  }

  const alpha=packets.filter(p=>p.claim.startsWith("Directory Alpha"));
  assert.equal(alpha.length,3);
  assert.equal(new Set(alpha.slice(0,2).map(p=>p.source_lineage_id)).size,1,
    "same source repeated by multiple generators remains one lineage");
  assert.equal(new Set(alpha.map(p=>p.source_lineage_id)).size,2,
    "independent corroboration is counted by lineage, not agent count");

  const beta=packets.filter(p=>p.claim.startsWith("Directory Beta"));
  assert.equal(beta.every(p=>p.disposition==="rejected"),true);
  assert.equal(new Set(beta.map(p=>p.source_lineage_id)).size,1);

  const zero=fixture.zero_survivor_run;
  assert.equal(zero.packets.filter(p=>p.disposition==="accepted").length,zero.expected_survivors);
  assert.equal(zero.stop_reason,"zero_survivors");

  const retainedIds=new Set(packets.map(p=>p.candidate_id));
  assert.equal(retainedIds.size,packets.length,"accepted and rejected packets remain retained");

  console.log(JSON.stringify({
    run_id:fixture.run_manifest.run_id,
    packets:packets.length,
    accepted:accepted.length,
    rejected:rejected.length,
    accepted_source_lineages:lineageCount(packets),
    repeated_same_source_weight:"one lineage",
    zero_survivor_outcome:"valid",
    automatic_outreach:false
  },null,2));
}

if(process.argv[1]===fileURLToPath(import.meta.url)) await run();
