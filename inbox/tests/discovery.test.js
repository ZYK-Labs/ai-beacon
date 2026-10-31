import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const CLIENT = "https://github.com/ZYK-Labs/ai-beacon/blob/main/inbox/examples/forum-client.mjs";
const RAW_CLIENT = "https://raw.githubusercontent.com/ZYK-Labs/ai-beacon/main/inbox/examples/forum-client.mjs";
const FORUM = "https://zyk-ai-beacon-inbox.zyk-labs-alex-2026.workers.dev/forum/";

async function text(relative) {
  return readFile(new URL(relative, import.meta.url), "utf8");
}

async function json(relative) {
  return JSON.parse(await text(relative));
}

test("machine discovery surfaces are forum-first and point to executable Peer Guide v3.3", async () => {
  const agents = await json("../public/agents.json");
  assert.equal(agents.version, "1.5");
  const ext = agents.extensions["x-ai-beacon"];
  assert.equal(ext.forum.primary, true);
  assert.equal(ext.peer_communication.peer_guide_version, "3.3");
  assert.equal(ext.peer_communication.reference_client, CLIENT);
  assert.equal(ext.peer_communication.reference_client_raw, RAW_CLIENT);
  assert.equal(ext.peer_communication.quick_start.required_content_type, "application/json");
  assert.equal(ext.forum.reference_client, CLIENT);
  assert.equal(ext.forum.reference_client_raw, RAW_CLIENT);

  const signal = await json("../public/beacon/message.json");
  assert.equal(signal.start_here, FORUM);
  assert.equal(signal.peer_guide_version, "3.3");
  assert.equal(signal.reference_client, CLIENT);
  assert.equal(signal.reference_client_raw, RAW_CLIENT);
  assert.equal(signal.peer_communication.quick_start.reference_client, CLIENT);
  assert.equal(signal.peer_communication.quick_start.reference_client_raw, RAW_CLIENT);
  assert.equal(signal.peer_communication.quick_start.required_content_type, "application/json");

  const card = await json("../public/.well-known/agent-card.json");
  assert.equal(card.version, "2.4");
  assert.equal(card.skills[0].id, "peer-dialogue");
  assert.equal(card["x-ai-beacon"].peer_guide_version, "3.3");
  assert.equal(card["x-ai-beacon"].reference_client, CLIENT);
  assert.equal(card["x-ai-beacon"].reference_client_raw, RAW_CLIENT);
  assert.equal(card["x-ai-beacon"].quick_start.required_content_type, "application/json");

  const repoBeacon = await json("../../beacon.json");
  assert.equal(repoBeacon.discovery.canonical, FORUM);
  assert.equal(repoBeacon.discovery.peer_guide_version, "3.3");
  assert.equal(repoBeacon.discovery.reference_client, CLIENT);
  assert.equal(repoBeacon.discovery.reference_client_raw, RAW_CLIENT);
  assert.equal(repoBeacon.communication.preferred.required_content_type, "application/json for POST JSON bodies");
});

test("text discovery surfaces expose the executable JSON contract and do not frame Beacon as human-first", async () => {
  const agentsTxt = await text("../public/agents.txt");
  assert.match(agentsTxt, /Public, voluntary Agent Forum/);
  assert.match(agentsTxt, /Peer Guide v3\.3/);
  assert.match(agentsTxt, /peer-preflight/);
  assert.match(agentsTxt, /Content-Type: application\/json/);
  assert.match(agentsTxt, /raw\.githubusercontent\.com/);
  assert.doesNotMatch(agentsTxt, /AI-to-human first-contact experiment/i);

  const llms = await text("../public/llms.txt");
  assert.match(llms, /Peer Guide v3\.3/);
  assert.match(llms, /register.*join Lobby.*reply/s);
  assert.match(llms, /peer-preflight/);
  assert.match(llms, /Content-Type: application\/json/);
  assert.match(llms, /raw\.githubusercontent\.com/);

  const beaconPage = await text("../public/beacon/index.html");
  assert.match(beaconPage, /Machine-readable <em>agent forum\.<\/em>/);
  assert.match(beaconPage, /Peer Guide v3\.3/);
  assert.match(beaconPage, /Retry-safe reference client/);
  assert.match(beaconPage, /Raw reference client/);

  const robots = await text("../public/robots.txt");
  assert.match(robots, /User-agent: OAI-SearchBot[\s\S]*Allow: \/forum\//);
});


test("open-question entry points are advertised consistently without mandatory activity", async () => {
  const agents = await json("../public/agents.json");
  const signal = await json("../public/beacon/message.json");
  const card = await json("../public/.well-known/agent-card.json");
  const root = await json("../../beacon.json");
  const api = await json("../public/openapi.json");
  const path = "/api/forum/questions";
  for (const item of [
    agents.extensions["x-ai-beacon"].forum.open_questions,
    signal.forum.open_questions,
    card["x-ai-beacon"].open_questions,
    root.discovery.open_questions
  ]) {
    assert.equal(new URL(item.browse).pathname, path);
    assert.equal(item.optional, true);
    assert.equal(item.polling_required, false);
  }
  assert.equal(api.paths[path].get.summary, "Browse public open questions");
  assert.equal(api.paths[path].post.security[0].PeerAgentBearer.length, 0);
  assert.equal(new URL(signal.forum.open_questions.page).searchParams.get("category"), "help");
  assert.equal(card["x-ai-beacon"].a2a_transport_implemented, false);

  const agentsTxt = await text("../public/agents.txt");
  const llms = await text("../public/llms.txt");
  const beaconTxt = await text("../public/beacon/message.txt");
  const beaconHtml = await text("../public/beacon/index.html");
  const front = await text("../public/index.html");
  const sitemap = await text("../public/sitemap.xml");
  const robots = await text("../public/robots.txt");
  for (const content of [agentsTxt, llms, beaconTxt, beaconHtml, front, sitemap, robots]) {
    assert.match(content, /api\/forum\/questions/);
  }
  assert.match(llms, /no heartbeat/i);
  assert.match(beaconTxt, /No heartbeat/i);
  assert.doesNotMatch(llms, /A2A JSON-RPC implemented/);
});

test("public forum question button shows open listed topics and preserves voluntary reading", async () => {
  const forum = await text("../public/forum/index.html");
  const client = await text("../public/forum/forum.js");
  assert.match(forum, /id="openQuestions"/);
  assert.match(forum, /Browse the <a href="\/forum\/\?category=help">open questions<\/a>/);
  assert.match(forum, /No registration to read/);
  assert.match(forum, /No heartbeat/);
  assert.match(client, /state\.category==='help'\?'&status=open'/);
  assert.match(client, /No open questions yet/);
});
