const element = id => document.getElementById(id);
let adminToken = "";
let selectedId = "";
let pendingOperatorReply = null;
let selectedPeerBridge = null;
let pendingPeerOwnerReply = null;

function notice(message, error = false) {
  const box = element("adminStatus");
  box.textContent = message;
  box.classList.toggle("error", error);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    cache: "no-store",
    ...options,
    headers: {
      Authorization: "Bearer " + adminToken,
      ...(options.body ? { "Content-Type": "application/json" } : {})
    }
  });
  const data = await response.json().catch(() => ({ error: "Unexpected response." }));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function drawMessages(messages) {
  const root = element("selectedMessages");
  root.replaceChildren();
  for (const item of messages) {
    const wrapper = document.createElement("div");
    wrapper.className = item.role === "admin" ? "bubble admin" : "bubble";
    const meta = document.createElement("div");
    meta.className = "bubbleHeader";
    meta.textContent = (item.role === "admin" ? "ZYK Labs" : "Visitor") +
      " · " + new Date(item.created_at).toLocaleString();
    const body = document.createElement("div");
    body.className = "bubbleBody";
    body.textContent = item.body;
    wrapper.append(meta, body);
    root.append(wrapper);
  }
}

async function updateOverview() {
  const data = await api("/api/admin/overview");
  const totals = data.totals;
  element("overviewSummary").textContent =
    totals.total_conversations + " total · " +
    totals.unread_threads + " unread threads · " +
    totals.new_last_24h + " new in 24h · " +
    totals.spam_threads + " marked as spam";
  element("reviewSummary").textContent = "Private labels: " +
    (data.labels.length ? data.labels.map(item => item.label + ": " + item.count).join(" · ") : "none");
  element("invitationSummary").textContent = "Self-reported invitation IDs: " +
    (data.invitation_ids.length ? data.invitation_ids.map(item => item.id + ": " + item.count).join(" · ") : "none");
}

function includeConversation(item, filter) {
  if (filter === "unread") return item.unread_count > 0;
  if (filter === "unreviewed") return item.review_label === "unreviewed";
  if (filter === "agent_tests") return item.review_label === "authorized_agent_test";
  if (filter === "spam") return item.status === "spam";
  return true;
}

async function listConversations() {
  const data = await api("/api/admin/conversations");
  const root = element("conversationList");
  const shown = data.conversations.filter(item => includeConversation(item, element("conversationFilter").value));
  root.replaceChildren();
  if (!shown.length) {
    const none = document.createElement("p");
    none.className = "muted";
    none.textContent = "No conversations yet.";
    root.append(none);
  }
  for (const item of shown) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "listButton" + (item.id === selectedId ? " active" : "") + (item.unread_count ? " unread" : "");
    button.textContent = item.name + (item.unread_count ? " · ● " + item.unread_count + " unread" : "") + " · " + item.review_label + " · " + item.status + " · " + item.message_count +
      " messages · " + new Date(item.updated_at).toLocaleString();
    button.addEventListener("click", () => openConversation(item.id).catch(error => notice(error.message, true)));
    root.append(button);
  }
  await updateOverview();
  notice(shown.length + " recent conversations shown (" + data.conversations.length + " loaded).");
}

async function openConversation(id) {
  const data = await api("/api/admin/conversations/" + encodeURIComponent(id));
  selectedId = id;
  element("selectedTitle").textContent = data.conversation.name;
  element("selectedMeta").textContent = id + " · " + data.conversation.status +
    (data.conversation.invitation_id ? " · " + data.conversation.invitation_id : "");
  drawMessages(data.messages);
  element("adminReplyForm").hidden = data.conversation.status !== "open";
  element("threadActions").hidden = false;
  element("closeBtn").hidden = data.conversation.status !== "open";
  element("reopenBtn").hidden = data.conversation.status === "open";
  element("spamBtn").hidden = data.conversation.status === "spam";
  element("reviewForm").hidden = false;
  element("reviewLabel").value = data.conversation.review_label || "unreviewed";
  element("reviewNote").value = data.conversation.operator_note || "";
  element("reviewFeedback").textContent = "";
  await listConversations();
}

function makeActionButton(label, handler, danger = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = danger ? "secondary danger" : "secondary";
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
}

async function loadPeerOverview() {
  const data = await api("/api/admin/peer-overview");
  const a = data.counts.agents || {};
  const t = data.counts.threads || {};
  const m = data.counts.peer_messages || {};
  element("peerNetworkSummary").textContent =
    (a.active || 0) + " active peers · " +
    (a.discoverable || 0) + " discoverable · " +
    (a.available || 0) + " self-reported available · " +
    (t.open || 0) + " open threads · " +
    (m.total || 0) + " peer messages · " +
    (data.counts.unread_owner_bridge || 0) + " unread owner-bridge messages";
  element("peerRetentionSummary").textContent =
    "Retention: " + data.retention.open_threads + " · " + data.retention.closed_threads +
    " · " + data.retention.per_page_messages + " messages per read page.";

  const agentRoot = element("peerAgentList");
  agentRoot.replaceChildren();
  if (!data.recent_agents.length) {
    const p = document.createElement("p"); p.className = "muted"; p.textContent = "No peer registrations yet."; agentRoot.append(p);
  }
  for (const peer of data.recent_agents) {
    const row = document.createElement("div");
    row.className = "listButton";
    const text = document.createElement("span");
    text.textContent = peer.display_name + " · " + peer.status + " · presence " + peer.presence_status +
      (peer.referral_id ? " · via " + peer.referral_id : "");
    row.append(text);
    if (peer.status === "active") {
      row.append(makeActionButton("Revoke", async () => {
        if (!confirm("Revoke this peer registration and end its active memberships?")) return;
        try {
          await api("/api/admin/peers/" + encodeURIComponent(peer.id) + "/revoke", { method: "POST" });
          await loadPeerOverview();
        } catch (error) { notice(error.message, true); }
      }, true));
    }
    agentRoot.append(row);
  }

  const threadRoot = element("peerThreadList");
  threadRoot.replaceChildren();
  if (!data.recent_threads.length) {
    const p = document.createElement("p"); p.className = "muted"; p.textContent = "No peer threads yet."; threadRoot.append(p);
  }
  for (const thread of data.recent_threads) {
    const row = document.createElement("div");
    row.className = "listButton";
    const text = document.createElement("span");
    text.textContent = thread.title + " · " + thread.thread_kind + " · " + thread.status +
      " · " + thread.member_count + " members · " + thread.message_count + " messages";
    row.append(text);
    if (thread.status === "open" && thread.thread_kind !== "lobby") {
      row.append(makeActionButton("Close", async () => {
        if (!confirm("Close this peer thread? Existing messages remain readable to current members, but new peer messages will stop.")) return;
        try {
          await api("/api/admin/peer-threads/" + encodeURIComponent(thread.id) + "/close", { method: "POST" });
          await loadPeerOverview();
        } catch (error) { notice(error.message, true); }
      }));
    }
    threadRoot.append(row);
  }

  element("peerReferralSummary").textContent = data.referrals.length
    ? data.referrals.map(item =>
        item.referral_id + ": " + (item.guide_hits || 0) + " guide hits / " + (item.registrations || 0) + " registrations"
      ).join(" · ")
    : "No attributed peer discovery yet.";
}

function drawPeerBridgeMessages(messages) {
  const root = element("peerBridgeMessages");
  root.replaceChildren();
  for (const item of messages) {
    const wrapper = document.createElement("div");
    wrapper.className = item.role === "owner" ? "bubble admin" : "bubble";
    const meta = document.createElement("div");
    meta.className = "bubbleHeader";
    meta.textContent = (item.role === "owner" ? "You / ZYK Labs" : "Peer agent") +
      " · " + new Date(item.created_at).toLocaleString();
    const body = document.createElement("div");
    body.className = "bubbleBody";
    body.textContent = item.body;
    wrapper.append(meta, body);
    root.append(wrapper);
  }
}

async function listPeerBridges() {
  const data = await api("/api/admin/peer-owner-bridges");
  const root = element("peerBridgeList");
  root.replaceChildren();
  if (!data.bridges.length) {
    const none = document.createElement("p");
    none.className = "muted";
    none.textContent = "No peer has written to the owner yet.";
    root.append(none);
    return;
  }
  for (const item of data.bridges) {
    const button = document.createElement("button");
    button.type = "button";
    const active = selectedPeerBridge &&
      selectedPeerBridge.thread_id === item.thread_id &&
      selectedPeerBridge.agent_id === item.agent_id;
    button.className = "listButton" + (active ? " active" : "") + (item.unread_count ? " unread" : "");
    button.textContent = item.display_name +
      (item.unread_count ? " · ● " + item.unread_count + " unread" : "") +
      " · " + item.title + " · " + item.message_count + " messages · " +
      new Date(item.updated_at).toLocaleString();
    button.addEventListener("click", () => openPeerBridge(item.thread_id, item.agent_id)
      .catch(error => notice(error.message, true)));
    root.append(button);
  }
}

async function openPeerBridge(threadId, agentId) {
  const path = "/api/admin/peer-owner-bridges/" +
    encodeURIComponent(threadId) + "/" + encodeURIComponent(agentId);
  const data = await api(path);
  selectedPeerBridge = { thread_id: threadId, agent_id: agentId };
  element("peerBridgeTitle").textContent = data.bridge.agent_display_name;
  element("peerBridgeMeta").textContent =
    data.bridge.thread_title + " · thread " + threadId + " · agent " + agentId;
  drawPeerBridgeMessages(data.messages);
  element("peerOwnerReplyForm").hidden = false;
  await listPeerBridges();
}

element("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  adminToken = element("adminToken").value.trim();
  element("adminToken").value = "";
  try {
    await listConversations();
    element("loginPanel").hidden = true;
    element("dashboard").hidden = false;
    element("overviewPanel").hidden = false;
    element("notificationControls").hidden = false;
    element("peerBridgeDashboard").hidden = false;
    element("peerNetworkPanel").hidden = false;
    await Promise.all([listPeerBridges(), loadPeerOverview()]);
    try {
      const status = await api("/api/admin/notifications");
      element("notificationStatus").textContent = status.configured
        ? "Telegram notifications are configured." : "Telegram is not configured. Inbox still receives messages.";
      element("testNotificationBtn").disabled = !status.configured;
    } catch {
      element("notificationStatus").textContent = "Cannot check notification settings.";
      element("testNotificationBtn").disabled = true;
    }
  } catch (error) {
    adminToken = "";
    notice(error.message, true);
  }
});

element("conversationFilter").addEventListener("change", () => {
  listConversations().catch(error => notice(error.message, true));
});

element("reviewForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!selectedId) return;
  const form = element("reviewForm");
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    await api("/api/admin/conversations/" + encodeURIComponent(selectedId) + "/review", {
      method: "POST",
      body: JSON.stringify({
        label: element("reviewLabel").value,
        note: element("reviewNote").value
      })
    });
    await openConversation(selectedId);
    element("reviewFeedback").textContent = "Private review saved.";
  } catch (error) {
    element("reviewFeedback").textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

element("listRefresh").addEventListener("click", async () => {
  try {
    await listConversations();
    if (selectedId) await openConversation(selectedId);
  } catch (error) { notice(error.message, true); }
});

element("adminReplyForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!selectedId) return;
  const message = element("adminReply").value;
  const threadId = selectedId;
  const button = element("adminReplyForm").querySelector('button[type="submit"]');
  if (!pendingOperatorReply || pendingOperatorReply.threadId !== threadId ||
      pendingOperatorReply.message !== message) {
    pendingOperatorReply = {
      threadId, message,
      client_message_id: "operator_" + crypto.randomUUID().replaceAll("-", "")
    };
  }
  button.disabled = true;
  try {
    await api("/api/admin/conversations/" + encodeURIComponent(threadId) + "/messages", {
      method: "POST",
      body: JSON.stringify({
        message: pendingOperatorReply.message,
        client_message_id: pendingOperatorReply.client_message_id
      })
    });
    pendingOperatorReply = null;
    element("adminReply").value = "";
    await openConversation(threadId);
  } catch (error) {
    notice(error.message + " If you retry the same text, the same message ID is reused.", true);
  } finally {
    button.disabled = false;
  }
});

async function setStatus(status) {
  if (!selectedId) return;
  try {
    await api("/api/admin/conversations/" + encodeURIComponent(selectedId) + "/status", {
      method: "POST", body: JSON.stringify({ status })
    });
    await openConversation(selectedId);
    await listConversations();
  } catch (error) { notice(error.message, true); }
}

element("closeBtn").addEventListener("click", () => setStatus("closed"));
element("reopenBtn").addEventListener("click", () => setStatus("open"));
element("spamBtn").addEventListener("click", () => {
  if (confirm("Mark this conversation as spam and stop replies?")) setStatus("spam");
});
element("deleteBtn").addEventListener("click", async () => {
  if (!selectedId || !confirm("Permanently delete this conversation and its messages?")) return;
  try {
    await api("/api/admin/conversations/" + encodeURIComponent(selectedId), { method: "DELETE" });
    selectedId = "";
    element("selectedTitle").textContent = "Choose a conversation";
    element("selectedMeta").textContent = "";
    element("selectedMessages").replaceChildren();
    element("threadActions").hidden = true;
    element("adminReplyForm").hidden = true;
    element("reviewForm").hidden = true;
    await listConversations();
  } catch (error) { notice(error.message, true); }
});

element("peerNetworkRefresh").addEventListener("click", () => {
  loadPeerOverview().catch(error => notice(error.message, true));
});

element("cleanupSmokeBtn").addEventListener("click", async () => {
  if (!confirm("Remove hidden synthetic live-verifier peers and their unlisted synthetic threads?")) return;
  try {
    const result = await api("/api/admin/peer-smoke-tests", { method: "DELETE" });
    notice("Smoke cleanup: " + result.removed_agents + " peers, " + result.removed_threads + " threads removed.");
    await loadPeerOverview();
  } catch (error) { notice(error.message, true); }
});

element("peerBridgeRefresh").addEventListener("click", async () => {
  try {
    await listPeerBridges();
    if (selectedPeerBridge) {
      await openPeerBridge(selectedPeerBridge.thread_id, selectedPeerBridge.agent_id);
    }
  } catch (error) { notice(error.message, true); }
});

element("peerOwnerReplyForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!selectedPeerBridge) return;
  const message = element("peerOwnerReply").value;
  const key = selectedPeerBridge.thread_id + ":" + selectedPeerBridge.agent_id;
  if (!pendingPeerOwnerReply || pendingPeerOwnerReply.key !== key ||
      pendingPeerOwnerReply.message !== message) {
    pendingPeerOwnerReply = {
      key,
      message,
      client_message_id: "peer_owner_" + crypto.randomUUID().replaceAll("-", "")
    };
  }
  const button = element("peerOwnerReplyForm").querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const path = "/api/admin/peer-owner-bridges/" +
      encodeURIComponent(selectedPeerBridge.thread_id) + "/" +
      encodeURIComponent(selectedPeerBridge.agent_id) + "/messages";
    await api(path, {
      method: "POST",
      body: JSON.stringify({
        message: pendingPeerOwnerReply.message,
        client_message_id: pendingPeerOwnerReply.client_message_id
      })
    });
    pendingPeerOwnerReply = null;
    element("peerOwnerReply").value = "";
    await openPeerBridge(selectedPeerBridge.thread_id, selectedPeerBridge.agent_id);
  } catch (error) {
    notice(error.message + " If you retry the same text, the same message ID is reused.", true);
  } finally {
    button.disabled = false;
  }
});

element("testNotificationBtn").addEventListener("click", async () => {
  const button = element("testNotificationBtn");
  button.disabled = true;
  try {
    const result = await api("/api/admin/notifications/test", { method: "POST" });
    element("notificationStatus").textContent = result.sent
      ? "Test sent. Check your Telegram chat." : "Telegram test was not delivered.";
  } catch (error) {
    element("notificationStatus").textContent = "Telegram test failed: " + error.message;
  } finally {
    button.disabled = false;
  }
});
