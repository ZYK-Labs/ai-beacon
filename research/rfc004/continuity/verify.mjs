import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const here=path.dirname(fileURLToPath(import.meta.url));
const fixture=JSON.parse(fs.readFileSync(path.join(here,"fixture.json"),"utf8"));

function clone(x){return JSON.parse(JSON.stringify(x));}

function activeCredential(peer, id){
  return peer.credentials.find(c=>c.credential_id===id && c.status==="active") || null;
}

export async function run(){
  assert.equal(fixture.synthetic_only,true);
  assert.equal(fixture.private_data_included,false);
  const state=new Map(fixture.peers.map(p=>[p.peer_id,clone(p)]));
  const boundary=clone(fixture.boundary_contract);
  let staleRejected=0;
  let crossPeerRejected=0;

  for(const op of fixture.operations){
    if(op.type==="authenticate"){
      const peer=state.get(op.peer_id);
      const allowed=!!activeCredential(peer,op.credential_id);
      assert.equal(allowed,op.expect==="allow",op.id);
      if(!allowed && op.expect==="deny") staleRejected++;
    } else if(op.type==="restart"){
      const peer=state.get(op.peer_id);
      assert.equal(peer.identity_claim_status,op.expect_identity_status,op.id);
      assert.ok(peer.memberships.includes(op.expect_membership),op.id);
    } else if(op.type==="rotate"){
      const peer=state.get(op.peer_id);
      const current=activeCredential(peer,op.from);
      assert.ok(current,op.id+" old credential active before rotation");
      current.status="superseded";
      current.superseded_by=op.to.credential_id;
      current.revoked_at="2026-10-01T20:31:00Z";
      peer.credentials.push({
        credential_id:op.to.credential_id,
        generation:op.to.generation,
        status:"active",
        predecessor_id:op.from,
        secret_fingerprint:op.to.secret_fingerprint,
        issued_at:"2026-10-01T20:31:00Z",
        revoked_at:null,
        superseded_by:null
      });
      assert.equal(peer.identity_claim_status,"self_reported");
    } else if(op.type==="concurrent_sessions"){
      const peer=state.get(op.peer_id);
      assert.ok(activeCredential(peer,op.credential_id),op.id);
      assert.ok(op.sessions>=2);
      assert.equal(peer.identity_claim_status,"self_reported");
    } else if(op.type==="cross_peer_auth"){
      const target=state.get(op.peer_id);
      const allowed=!!activeCredential(target,op.credential_id);
      assert.equal(allowed,false,op.id);
      crossPeerRejected++;
    } else if(op.type==="revoke"){
      const peer=state.get(op.peer_id);
      const cred=activeCredential(peer,op.credential_id);
      assert.ok(cred,op.id);
      cred.status="revoked";
      cred.revoked_at="2026-10-01T20:32:00Z";
      assert.equal(peer.identity_claim_status,"self_reported");
    } else if(op.type==="assert_identity"){
      assert.equal(state.get(op.peer_id).identity_claim_status,op.expect_status,op.id);
    } else if(op.type==="assert_boundaries"){
      assert.deepEqual(boundary,op.expect,op.id);
    } else {
      assert.fail("unknown operation "+op.type);
    }
  }

  for(const peer of state.values()){
    assert.equal(peer.identity_claim_status,"self_reported");
  }
  assert.ok(staleRejected>=2,"superseded/revoked credentials must be rejected");
  assert.equal(crossPeerRejected,1);
  assert.deepEqual(boundary,fixture.boundary_contract);

  console.log(JSON.stringify({
    fixture:fixture.fixture_version,
    peer_count:state.size,
    stale_or_revoked_rejections:staleRejected,
    cross_peer_rejections:crossPeerRejected,
    identity_status:"self_reported",
    owner_bridge_scope:boundary.owner_bridge_scope,
    private_data_included:false
  },null,2));
}

if(process.argv[1]===fileURLToPath(import.meta.url)) await run();
