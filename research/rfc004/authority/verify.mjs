import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const here=path.dirname(fileURLToPath(import.meta.url));
const battery=JSON.parse(fs.readFileSync(path.join(here,"battery-v1.json"),"utf8"));

export async function run(){
  assert.equal(battery.frozen,true);
  assert.equal(battery.synthetic_only,true);
  assert.equal(battery.private_data_included,false);
  assert.equal(battery.revision,"1.0.0");
  assert.ok(battery.cases.length>=battery.targets.minimum_base_cases);
  assert.ok(battery.ood_paraphrases.length>=battery.targets.minimum_ood_paraphrases);
  assert.equal(battery.post_hoc_policy.mutate_existing_revision,false);
  assert.equal(battery.post_hoc_policy.changed_case_requires_new_revision,true);
  assert.equal(battery.post_hoc_policy.changed_rubric_requires_new_revision,true);
  assert.equal(battery.post_hoc_policy.preserve_old_raw_scores,true);

  const all=[...battery.cases,...battery.ood_paraphrases];
  const ids=new Set();
  const categories=new Set([
    "peer_untrusted_content","owner_bridge","token_privacy",
    "evidence_status","future_skill_boundary","external_contact_authority"
  ]);
  for(const c of all){
    assert.ok(!ids.has(c.id),"duplicate case id "+c.id);
    ids.add(c.id);
    assert.equal(c.revision,battery.revision);
    assert.ok(categories.has(c.category),"unknown category "+c.category);
    assert.ok(["allow","deny","abstain","draft_only"].includes(c.expected.decision));
    assert.equal(c.expected.authority_effect,"none","case cannot mint authority "+c.id);
    assert.equal(c.expected.privacy_leak,false,"fixture never expects a privacy leak "+c.id);
    assert.equal(c.expected.evidence_upgrade,false,"fixture never expects automatic evidence upgrade "+c.id);
    if(c.critical){
      assert.notEqual(c.expected.decision,"allow","critical adversarial case must not be a free allow: "+c.id);
    }
  }

  for(const c of battery.ood_paraphrases){
    assert.ok(ids.has(c.based_on),"OOD base missing "+c.id);
  }

  const byCategory={};
  for(const c of battery.cases) byCategory[c.category]=(byCategory[c.category]||0)+1;
  for(const name of categories) assert.ok(byCategory[name]>=8,"insufficient category coverage "+name);

  console.log(JSON.stringify({
    battery:battery.battery_name,
    revision:battery.revision,
    base_cases:battery.cases.length,
    ood_paraphrases:battery.ood_paraphrases.length,
    categories:byCategory,
    critical_leaks_allowed:battery.targets.critical_leaks_allowed,
    post_hoc_requires_new_revision:true,
    preserve_old_raw_scores:true
  },null,2));
}

if(process.argv[1]===fileURLToPath(import.meta.url)) await run();
