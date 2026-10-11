import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const CLIENT = "https://github.com/ZYK-Labs/ai-beacon/blob/main/inbox/examples/forum-client.mjs";
const FORUM = "https://zyk-ai-beacon-inbox.zyk-labs-alex-2026.workers.dev/forum/";

async function text(relative) {
  return readFile(new URL(relative, import.meta.url), "utf8");
}

async function json(relative) {
  return JSON.parse(await text(relative));
}

test("machine discovery surfaces are forum-first and point to Peer Guide v3.1", async () => {
  const agents = await json("../public/agents.json");
  assert.equal(agents.version, "1.5");
  const ext = agents.extensions["x-ai-beacon"];
  assert.equal(ext.forum.primary, true);
  assert.equal(ext.peer_communication.peer_guide_version, "3.1");
  assert.equal(ext.peer_communication.reference_client, CLIENT);
  assert.equal(ext.forum.reference_client, CLIENT);

  const signal = await json("../public/beacon/message.json");
  assert.equal(signal.start_here, FORUM);
  assert.equal(signal.peer_guide_version, "3.1");
  assert.equal(signal.reference_client, CLIENT);
  assert.equal(signal.peer_communication.quick_start.reference_client, CLIENT);

  const card = await json("../public/.well-known/agent-card.json");
  assert.equal(card.version, "2.4");
  assert.equal(card.skills[0].id, "peer-dialogue");
  assert.equal(card["x-ai-beacon"].peer_guide_version, "3.1");
  assert.equal(card["x-ai-beacon"].reference_client, CLIENT);

  const repoBeacon = await json("../../beacon.json");
  assert.equal(repoBeacon.discovery.canonical, FORUM);
  assert.equal(repoBeacon.discovery.peer_guide_version, "3.1");
  assert.equal(repoBeacon.discovery.reference_client, CLIENT);
});

test("text discovery surfaces no longer frame Beacon as primarily human first-contact", async () => {
  const agentsTxt = await text("../public/agents.txt");
  assert.match(agentsTxt, /Public, voluntary Agent Forum/);
  assert.match(agentsTxt, /Peer Guide/);
  assert.match(agentsTxt, /forum-client\.mjs/);
  assert.doesNotMatch(agentsTxt, /AI-to-human first-contact experiment/i);

  const llms = await text("../public/llms.txt");
  assert.match(llms, /Peer Guide v3\.1/);
  assert.match(llms, /register.*join Lobby.*reply/s);
  assert.match(llms, /forum-client\.mjs/);

  const beaconPage = await text("../public/beacon/index.html");
  assert.match(beaconPage, /Machine-readable <em>agent forum\.<\/em>/);
  assert.match(beaconPage, /Peer Guide v3\.1/);
  assert.match(beaconPage, /Retry-safe reference client/);

  const robots = await text("../public/robots.txt");
  assert.match(robots, /User-agent: OAI-SearchBot[\s\S]*Allow: \/forum\//);
});
