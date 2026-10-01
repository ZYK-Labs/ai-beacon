import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const here=path.dirname(fileURLToPath(import.meta.url));
const load=name=>JSON.parse(fs.readFileSync(path.join(here,"fixtures",name),"utf8"));
const source=load("harmless-instruction-source.json");
const hostA=load("harmless-instruction-host-a.json");
const hostB=load("harmless-instruction-host-b.json");
const broad=load("conversion-broadening-negative.json");
const external=load("external-untrusted-negative.json");

const capabilityKeys=["network","filesystem_read","filesystem_write","process_exec","secrets","external_messaging","production_endpoints","tools"];

function emptyCaps(m){
  return capabilityKeys.every(k=>Array.isArray(m.capabilities[k]) && m.capabilities[k].length===0);
}
function isSubsetCaps(candidate,base){
  return capabilityKeys.every(k=>{
    const allowed=new Set(base.capabilities[k]);
    return candidate.capabilities[k].every(v=>allowed.has(v));
  });
}
function commonBoundary(m){
  const f=m.fixture_scope;
  return f.common_fixture===true &&
    f.contains_private_data===false &&
    f.contains_owner_bridge_data===false &&
    f.contains_secrets===false &&
    f.contains_production_endpoints===false;
}

export async function run(){
  assert.equal(source.authority_class,"INSTRUCTION_ONLY");
  assert.equal(source.source.trust_state,"internal_synthetic_fixture");
  assert.ok(emptyCaps(source),"capability default must be none");
  assert.ok(commonBoundary(source));

  for(const converted of [hostA,hostB]){
    assert.equal(converted.source.kind,"converted_representation");
    assert.equal(converted.conversion_policy.may_broaden_permissions,false);
    assert.ok(isSubsetCaps(converted,source),"conversion cannot broaden permissions");
    assert.ok(emptyCaps(converted));
    assert.ok(commonBoundary(converted));
  }

  assert.equal(isSubsetCaps(broad,source),false,"negative fixture must demonstrate permission broadening");
  assert.equal(broad.audit.static_review,"fail-synthetic");

  assert.equal(external.source.trust_state,"untrusted_external");
  assert.equal(external.authority_class,"EXECUTABLE_PLUGIN");
  assert.equal(external.lifecycle.status,"quarantined");
  assert.notEqual(external.audit.manual_review,"pass");

  for(const m of [source,hostA,hostB,broad,external]){
    assert.equal(m.manifest_version,"0.1.0");
    assert.ok(Array.isArray(m.source.files) && m.source.files.length>0);
    for(const file of m.source.files) assert.match(file.sha256,/^sha256:[0-9a-f]{64}$/);
  }

  console.log(JSON.stringify({
    contract:"Beacon SkillContract v0",
    harmless_instruction_fixtures:3,
    capability_default:"none",
    conversion_non_expansion_verified:true,
    broadening_negative_detected:true,
    external_input_trust_state:"untrusted_external",
    external_negative_status:"quarantined",
    common_fixture_private_data:false
  },null,2));
}

if(process.argv[1]===fileURLToPath(import.meta.url)) await run();
