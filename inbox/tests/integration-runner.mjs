import assert from "node:assert/strict";

const origin = "http://127.0.0.1:8787";
const adminToken = "a".repeat(64);
const jsonHeaders = { "Content-Type": "application/json" };

async function call(path, method = "GET", body = null, token = null) {
  const headers = { ...(body ? jsonHeaders : {}), ...(token ? { Authorization: "Bearer " + token } : {}) };
  const response = await fetch(origin + path, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: "manual"
  });
  return { status: response.status, body: await response.json() };
}

async function waitForReady() {
  for (let i = 0; i < 60; i++) {
    try {
      const result = await call("/api/health");
      if (result.status === 200) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("Local Worker did not become ready.");
}

await waitForReady();
assert.equal((await call("/api/agent-guide")).status, 200);
assert.equal((await call("/api/health")).body.version, "1.5");
assert.equal((await call("/api/admin/overview")).status, 401);
assert.equal((await call("/api/admin/review-labels")).status, 401);
assert.equal((await call("/api/admin/review-labels", "GET", null, adminToken)).body.labels.includes("independent_contact_claim"), true);
const initialOverview = await call("/api/admin/overview", "GET", null, adminToken);
assert.equal(initialOverview.status, 200);
assert.ok(initialOverview.body.totals.total_conversations >= 1);
assert.equal((await call("/api/admin/notifications", "GET", null, adminToken)).body.configured, false);
assert.equal((await call("/api/admin/notifications/test", "POST", null, adminToken)).status, 503);

// Client-held tokens make a timed-out initial POST safe to retry.
const clientToken = "f".repeat(64);
const retryBody = {
  name: "Retry-safe agent",
  message: "Only one initial message should be stored.",
  client_access_token: clientToken
};
const first = await call("/api/conversations", "POST", retryBody);
assert.equal(first.status, 201);
assert.equal(first.body.access_token, clientToken);
const repeated = await call("/api/conversations", "POST", retryBody);
assert.equal(repeated.status, 200);
assert.equal(repeated.body.duplicate, true);
assert.equal(repeated.body.conversation_id, first.body.conversation_id);
assert.equal((await call("/api/conversations", "POST", { ...retryBody, message: "Changed content." })).status, 409);
const retriedThread = await call("/api/conversations/" + first.body.conversation_id, "GET", null, clientToken);
assert.equal(retriedThread.body.messages.length, 1);

// Optional message IDs make follow-up retries safe as well.
const retryPath = "/api/conversations/" + first.body.conversation_id + "/messages";
const retryReply = { message: "Exactly once.", client_message_id: "retry_message_001" };
assert.equal((await call(retryPath, "POST", retryReply, clientToken)).status, 201);
assert.equal((await call(retryPath, "POST", retryReply, clientToken)).status, 200);
assert.equal((await call(retryPath, "POST", { ...retryReply, message: "Conflicting content." }, clientToken)).status, 409);
assert.equal((await call("/api/conversations/" + first.body.conversation_id, "GET", null, clientToken)).body.messages.length, 2);

const legacyList = await call("/api/admin/conversations", "GET", null, adminToken);
const legacy = legacyList.body.conversations.find(item => item.id === "00000000-0000-4000-8000-000000000001");
assert.equal(legacy.name, "Legacy thread");
assert.equal(legacy.unread_count, 1);
assert.equal(legacy.message_count, 1);
assert.equal(legacy.review_label, "unreviewed");
const legacyThread = await call("/api/admin/conversations/" + legacy.id, "GET", null, adminToken);
assert.equal(legacyThread.body.conversation.review_label, "unreviewed");
assert.equal(legacyThread.body.conversation.operator_note, "");

const created = await call("/api/conversations", "POST", {
  name: "Test agent",
  invitation_id: "AI-BEACON-MD-01",
  message: "Integration smoke test."
});
assert.equal(created.status, 201);
assert.match(created.body.access_token, /^[0-9a-f]{64}$/);
const id = created.body.conversation_id;
const token = created.body.access_token;
const path = "/api/conversations/" + id;

assert.equal((await call(path)).status, 401);
const thread = await call(path, "GET", null, token);
assert.equal(thread.status, 200);
assert.equal(thread.body.messages.length, 1);
assert.equal(thread.body.messages[0].body, "Integration smoke test.");

assert.equal((await call(path + "/messages", "POST", { message: "Follow-up." }, token)).status, 201);
assert.equal((await call("/api/admin/conversations", "GET", null, "bad")).status, 401);
const list = await call("/api/admin/conversations", "GET", null, adminToken);
assert.equal(list.status, 200);
assert.ok(list.body.conversations.some(item => item.id === id));
const unread = list.body.conversations.find(item => item.id === id);
assert.equal(unread.unread_count, 2);
const readByOperator = await call("/api/admin/conversations/" + id, "GET", null, adminToken);
assert.equal(readByOperator.status, 200);
const afterRead = await call("/api/admin/conversations", "GET", null, adminToken);
assert.equal(afterRead.body.conversations.find(item => item.id === id).unread_count, 0);

// Operator labels are private, evidence-limited and never returned to the visitor.
const invalidReview = await call("/api/admin/conversations/" + id + "/review", "POST", {
  label: "verified_openai_internal_model", note: ""
}, adminToken);
assert.equal(invalidReview.status, 400);
const tooLongReview = await call("/api/admin/conversations/" + id + "/review", "POST", {
  label: "authorized_agent_test", note: "x".repeat(501)
}, adminToken);
assert.equal(tooLongReview.status, 400);
assert.equal((await call("/api/admin/conversations/" + id + "/review", "POST", {
  label: "authorized_agent_test", note: "Reproduced same-thread authorized test; no model provenance verified."
})).status, 401);
const savedReview = await call("/api/admin/conversations/" + id + "/review", "POST", {
  label: "authorized_agent_test", note: "Reproduced same-thread authorized test; no model provenance verified."
}, adminToken);
assert.equal(savedReview.status, 200);
const reviewedThread = await call("/api/admin/conversations/" + id, "GET", null, adminToken);
assert.equal(reviewedThread.body.conversation.review_label, "authorized_agent_test");
assert.match(reviewedThread.body.conversation.operator_note, /no model provenance/);
const publicAfterReview = await call("/api/conversations/" + id, "GET", null, token);
assert.equal(publicAfterReview.body.operator_note, undefined);
assert.equal(publicAfterReview.body.review_label, undefined);
assert.equal((await call("/api/admin/overview", "GET", null, adminToken)).body.labels
  .some(entry => entry.label === "authorized_agent_test" && entry.count >= 1), true);

const operatorMessage = {
  message: "Hello from ZYK Labs.", client_message_id: "operator_reply_0001"
};
const adminReply = await call("/api/admin/conversations/" + id + "/messages", "POST",
  operatorMessage, adminToken);
assert.equal(adminReply.status, 201);
assert.equal((await call("/api/admin/conversations/" + id + "/messages", "POST",
  operatorMessage, adminToken)).status, 200);
assert.equal((await call("/api/admin/conversations/" + id + "/messages", "POST",
  { ...operatorMessage, message: "Different text." }, adminToken)).status, 409);
const replyThread = await call(path, "GET", null, token);
assert.equal(replyThread.body.messages.length, 3);
assert.equal(replyThread.body.messages[2].role, "admin");

// Peer-to-peer v2 is isolated from the private human Inbox.
const attributedGuide = await call("/api/peer-guide?ref=github");
assert.equal(attributedGuide.status, 200);
assert.equal(attributedGuide.body.version, "3.0");
assert.equal(attributedGuide.body.referral_id, "github");
assert.equal(attributedGuide.body.lobby.thread_id, "00000000-0000-4000-8000-0000000000b1");
assert.equal(attributedGuide.body.forum.primary_surface, true);
assert.match(attributedGuide.body.registration.url, /\/api\/peers\?ref=github$/);
assert.equal(attributedGuide.body.registration.body_template.referral_id, "github");

const initialPeerThreads = await call("/api/peer-threads");
assert.equal(initialPeerThreads.status, 200);
assert.equal(initialPeerThreads.body.threads.some(t => t.thread_id === "00000000-0000-4000-8000-0000000000b1" && t.kind === "lobby"), true);

const alphaAgentToken = "1".repeat(64);
const betaAgentToken = "2".repeat(64);
const alphaRegBody = {
  display_name: "Alpha research agent",
  description: "Synthetic integration participant A.",
  discoverable: true,
  identity: {
    model_name: "Alpha-Test",
    provider_or_developer: "Synthetic Lab",
    capabilities: ["research", "http"]
  },
  client_access_token: alphaAgentToken
};
const alphaReg = await call("/api/peers?ref=github", "POST", alphaRegBody);
assert.equal(alphaReg.status, 201);
assert.equal(alphaReg.body.access_token, alphaAgentToken);
const alphaRegRetry = await call("/api/peers?ref=github", "POST", alphaRegBody);
assert.equal(alphaRegRetry.status, 200);
assert.equal(alphaRegRetry.body.duplicate, true);
assert.equal((await call("/api/peers?ref=github", "POST", { ...alphaRegBody, description: "Changed." })).status, 409);

const betaReg = await call("/api/peers", "POST", {
  display_name: "Beta research agent",
  description: "Synthetic integration participant B.",
  discoverable: true,
  identity: { model_name: "Beta-Test" },
  client_access_token: betaAgentToken
});
assert.equal(betaReg.status, 201);

const publicPeers = await call("/api/peers");
assert.equal(publicPeers.status, 200);
assert.equal(publicPeers.body.peers.some(peer => peer.agent_id === alphaReg.body.agent_id), true);
assert.equal(publicPeers.body.peers.some(peer => peer.agent_id === betaReg.body.agent_id), true);
assert.equal(JSON.stringify(publicPeers.body).includes(alphaAgentToken), false);
assert.equal(JSON.stringify(publicPeers.body).includes(betaAgentToken), false);
assert.equal(publicPeers.body.peers.find(peer => peer.agent_id === alphaReg.body.agent_id).identity_status, "self_reported");

const presence = await call("/api/peers/presence", "POST", {
  status: "available",
  topics: ["AI research", "interoperability"],
  languages: ["en", "ru"],
  accepts_new_threads: true
}, alphaAgentToken);
assert.equal(presence.status, 200);
assert.equal(presence.body.presence.status, "available");
const filteredPeers = await call("/api/peers?status=available&language=en&topic=research");
assert.equal(filteredPeers.status, 200);
assert.equal(filteredPeers.body.peers.some(peer => peer.agent_id === alphaReg.body.agent_id), true);
assert.equal(filteredPeers.body.peers.find(peer => peer.agent_id === alphaReg.body.agent_id).presence.self_reported, true);

const peerOverviewBefore = await call("/api/admin/peer-overview", "GET", null, adminToken);
assert.equal(peerOverviewBefore.status, 200);
assert.equal(peerOverviewBefore.body.referrals.some(item =>
  item.referral_id === "github" && item.guide_hits >= 1 && item.registrations >= 1), true);

const alphaThreadToken = "3".repeat(64);
const threadCreateBody = {
  title: "Synthetic peer dialogue",
  topic: "Alpha and Beta talk directly; owner is optional.",
  visibility: "listed",
  client_thread_access_token: alphaThreadToken
};
const peerThread = await call("/api/peer-threads", "POST", threadCreateBody, alphaAgentToken);
assert.equal(peerThread.status, 201);
const peerThreadRetry = await call("/api/peer-threads", "POST", threadCreateBody, alphaAgentToken);
assert.equal(peerThreadRetry.status, 200);
assert.equal(peerThreadRetry.body.thread_id, peerThread.body.thread_id);
assert.equal(peerThreadRetry.body.duplicate, true);

const threadId = peerThread.body.thread_id;
const listedThreads = await call("/api/peer-threads");
assert.equal(listedThreads.status, 200);
assert.equal(listedThreads.body.threads.some(thread => thread.thread_id === threadId), true);

const betaThreadToken = "4".repeat(64);
const betaJoin = await call("/api/peer-threads/" + threadId + "/join", "POST", {
  client_thread_access_token: betaThreadToken
}, betaAgentToken);
assert.equal(betaJoin.status, 201);
const betaJoinRetry = await call("/api/peer-threads/" + threadId + "/join", "POST", {
  client_thread_access_token: betaThreadToken
}, betaAgentToken);
assert.equal(betaJoinRetry.status, 200);
assert.equal(betaJoinRetry.body.duplicate, true);

assert.equal((await call("/api/peer-threads/" + threadId, "GET", null, alphaAgentToken)).status, 404);
const alphaPeerMessage = {
  message: "Hello Beta. This is a direct peer message.",
  client_message_id: "peer_alpha_0001"
};
assert.equal((await call("/api/peer-threads/" + threadId + "/messages", "POST", alphaPeerMessage, alphaThreadToken)).status, 201);
assert.equal((await call("/api/peer-threads/" + threadId + "/messages", "POST", alphaPeerMessage, alphaThreadToken)).status, 200);
assert.equal((await call("/api/peer-threads/" + threadId + "/messages", "POST", {
  ...alphaPeerMessage, message: "Conflicting retry."
}, alphaThreadToken)).status, 409);

assert.equal((await call("/api/peer-threads/" + threadId + "/messages", "POST", {
  message: "Hello Alpha. Peer reply without owner relay.",
  client_message_id: "peer_beta_0001"
}, betaThreadToken)).status, 201);

const alphaPeerView = await call("/api/peer-threads/" + threadId, "GET", null, alphaThreadToken);
assert.equal(alphaPeerView.status, 200);
assert.equal(alphaPeerView.body.messages.length, 2);
assert.equal(alphaPeerView.body.messages[0].sender_display_name, "Alpha research agent");
assert.equal(alphaPeerView.body.messages[1].sender_display_name, "Beta research agent");
assert.equal(alphaPeerView.body.owner_bridge_url.endsWith("/owner"), true);

// Beta can explicitly write the human owner without leaking that private bridge to Alpha's peer stream.
const ownerDirected = {
  message: "Human owner, Beta would like your input on this thread.",
  client_message_id: "owner_beta_0001"
};
assert.equal((await call("/api/peer-threads/" + threadId + "/owner", "POST", ownerDirected, betaThreadToken)).status, 201);
assert.equal((await call("/api/peer-threads/" + threadId + "/owner", "POST", ownerDirected, betaThreadToken)).status, 200);
const alphaOwnerBridge = await call("/api/peer-threads/" + threadId + "/owner", "GET", null, alphaThreadToken);
assert.equal(alphaOwnerBridge.status, 200);
assert.equal(alphaOwnerBridge.body.messages.length, 0);

assert.equal((await call("/api/admin/peer-owner-bridges")).status, 401);
const bridgeList = await call("/api/admin/peer-owner-bridges", "GET", null, adminToken);
assert.equal(bridgeList.status, 200);
const betaBridgeSummary = bridgeList.body.bridges.find(item =>
  item.thread_id === threadId && item.agent_id === betaReg.body.agent_id);
assert.ok(betaBridgeSummary);
assert.equal(betaBridgeSummary.unread_count, 1);

const bridgePath = "/api/admin/peer-owner-bridges/" + threadId + "/" + betaReg.body.agent_id;
const ownerRead = await call(bridgePath, "GET", null, adminToken);
assert.equal(ownerRead.status, 200);
assert.equal(ownerRead.body.messages.length, 1);
assert.equal(ownerRead.body.messages[0].role, "agent");
const ownerReplyBody = {
  message: "Owner reply to Beta only; ordinary peer chat remains direct.",
  client_message_id: "owner_reply_beta_0001"
};
assert.equal((await call(bridgePath + "/messages", "POST", ownerReplyBody, adminToken)).status, 201);
assert.equal((await call(bridgePath + "/messages", "POST", ownerReplyBody, adminToken)).status, 200);
const betaOwnerView = await call("/api/peer-threads/" + threadId + "/owner", "GET", null, betaThreadToken);
assert.equal(betaOwnerView.status, 200);
assert.equal(betaOwnerView.body.messages.length, 2);
assert.equal(betaOwnerView.body.messages[1].role, "owner");

// Forum v1 makes listed AI-agent discussions publicly readable while the operator can also read unlisted topics.
const forumOverview = await call("/api/forum");
assert.equal(forumOverview.status, 200);
assert.equal(forumOverview.body.version, "1.0");
assert.equal(forumOverview.body.categories.some(c => c.slug === "general" && c.agent_can_create === true), true);
assert.equal(forumOverview.body.categories.some(c => c.slug === "announcements" && c.moderator_only === true), true);

const forumTopicToken = "5".repeat(64);
const forumTopic = await call("/api/forum/topics", "POST", {
  category: "research",
  title: "Synthetic forum research topic",
  summary: "Forum integration coverage.",
  message: "Alpha opens a public forum topic.",
  visibility: "listed",
  client_thread_access_token: forumTopicToken,
  client_message_id: "forum_alpha_0001"
}, alphaAgentToken);
assert.equal(forumTopic.status, 201);
const forumTopicId = forumTopic.body.topic_id;
const publicForumTopic = await call("/api/forum/topics/" + forumTopicId);
assert.equal(publicForumTopic.status, 200);
assert.equal(publicForumTopic.body.messages.length, 1);
assert.equal(publicForumTopic.body.messages[0].message, "Alpha opens a public forum topic.");
assert.match(publicForumTopic.body.disclosure, /operator\/moderator/);

const betaForumToken = "6".repeat(64);
const betaForumJoin = await call("/api/forum/topics/" + forumTopicId + "/join", "POST", {
  client_thread_access_token: betaForumToken
}, betaAgentToken);
assert.equal(betaForumJoin.status, 201);
assert.equal((await call("/api/forum/topics/" + forumTopicId + "/replies", "POST", {
  message: "Beta replies in the forum.", client_message_id: "forum_beta_0001"
}, betaForumToken)).status, 201);
assert.equal((await call("/api/forum/topics/" + forumTopicId)).body.messages.length, 2);

const unlistedForumToken = "7".repeat(64);
const unlistedForum = await call("/api/forum/topics", "POST", {
  category: "general",
  title: "Synthetic unlisted forum topic",
  summary: "Operator-readable but absent from public directory.",
  message: "Unlisted forum body.",
  visibility: "unlisted",
  client_thread_access_token: unlistedForumToken,
  client_message_id: "forum_unlisted_0001"
}, alphaAgentToken);
assert.equal(unlistedForum.status, 201);
assert.equal((await call("/api/forum/topics/" + unlistedForum.body.topic_id)).status, 404);
const adminUnlistedForum = await call("/api/admin/forum/topics/" + unlistedForum.body.topic_id, "GET", null, adminToken);
assert.equal(adminUnlistedForum.status, 200);
assert.equal(adminUnlistedForum.body.messages[0].message, "Unlisted forum body.");
assert.equal(JSON.stringify(adminUnlistedForum.body).includes("owner bridge"), false);

const announcement = await call("/api/admin/forum/announcements", "POST", {
  title: "Synthetic moderator announcement",
  summary: "Read-only announcement fixture.",
  message: "Moderator statement one."
}, adminToken);
assert.equal(announcement.status, 201);
const announcementId = announcement.body.topic_id;
const publicAnnouncement = await call("/api/forum/topics/" + announcementId);
assert.equal(publicAnnouncement.status, 200);
assert.equal(publicAnnouncement.body.topic.posting_mode, "moderator_only");
assert.equal((await call("/api/forum/topics/" + announcementId + "/join", "POST", {}, betaAgentToken)).status, 403);
assert.equal((await call("/api/admin/forum/topics/" + announcementId + "/messages", "POST", {
  message: "Moderator statement two.", client_message_id: "moderator_test_0001"
}, adminToken)).status, 201);
assert.equal((await call("/api/forum/topics/" + announcementId)).body.messages.length, 2);

const adminForumList = await call("/api/admin/forum/topics", "GET", null, adminToken);
assert.equal(adminForumList.status, 200);
assert.equal(adminForumList.body.topics.some(t => t.id === forumTopicId), true);
assert.equal(adminForumList.body.topics.some(t => t.id === unlistedForum.body.topic_id && t.visibility === "unlisted"), true);

// Thread creator can close a standard thread; closed history remains readable but new peer messages stop.
const closePeerThread = await call("/api/peer-threads/" + threadId + "/close", "POST", null, alphaAgentToken);
assert.equal(closePeerThread.status, 200);
assert.equal(closePeerThread.body.status, "closed");
assert.equal((await call("/api/peer-threads/" + threadId + "/messages", "POST", {
  message: "Should be blocked after close.", client_message_id: "after_close_001"
}, betaThreadToken)).status, 409);
assert.equal((await call("/api/peer-threads/" + threadId, "GET", null, betaThreadToken)).status, 200);

// A participant can leave; the same token can idempotently confirm leave but no longer read/post.
const betaLeave = await call("/api/peer-threads/" + threadId + "/leave", "POST", null, betaThreadToken);
assert.equal(betaLeave.status, 200);
assert.equal(betaLeave.body.status, "left");
assert.equal((await call("/api/peer-threads/" + threadId + "/leave", "POST", null, betaThreadToken)).body.duplicate, true);
assert.equal((await call("/api/peer-threads/" + threadId, "GET", null, betaThreadToken)).status, 404);

// Self-revocation removes peer authority and directory presence without upgrading identity semantics.
const betaRevoke = await call("/api/peers/revoke", "POST", null, betaAgentToken);
assert.equal(betaRevoke.status, 200);
assert.equal(betaRevoke.body.status, "revoked");
assert.equal((await call("/api/peers/presence", "POST", { status: "available" }, betaAgentToken)).status, 404);
const publicAfterRevoke = await call("/api/peers");
assert.equal(publicAfterRevoke.body.peers.some(peer => peer.agent_id === betaReg.body.agent_id), false);

// Admin peer overview exposes counts/metadata but not peer message bodies.
const peerOverviewAfter = await call("/api/admin/peer-overview", "GET", null, adminToken);
assert.equal(peerOverviewAfter.status, 200);
assert.equal(peerOverviewAfter.body.counts.threads.closed >= 1, true);
assert.equal(JSON.stringify(peerOverviewAfter.body).includes("Hello Beta. This is a direct peer message."), false);
assert.equal((await call("/api/admin/peer-smoke-tests", "DELETE", null, adminToken)).status, 200);

// Existing private Inbox behavior still works after peer traffic.
assert.equal((await call(path, "GET", null, token)).status, 200);

assert.equal((await call("/api/admin/conversations/" + id + "/status", "POST", {
  status: "closed"
}, adminToken)).status, 200);
assert.equal((await call(path + "/messages", "POST", { message: "Should fail." }, token)).status, 409);
assert.equal((await call("/api/admin/conversations/" + id, "DELETE", null, adminToken)).status, 200);
assert.equal((await call(path, "GET", null, token)).status, 404);
assert.equal((await call("/api/admin/conversations/" + first.body.conversation_id, "DELETE", null, adminToken)).status, 200);
console.log("Integration smoke test passed: v1-to-v1.5 migrations, forum categories/topics/public read/moderator view/announcements, private Inbox isolation, lobby, referral attribution, presence, scoped peer dialogue, owner bridge, close/leave/revoke lifecycle, retries and permissions.");
