const element = id => document.getElementById(id);
let adminToken = "";
let selectedId = "";

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
  try {
    await api("/api/admin/conversations/" + encodeURIComponent(selectedId) + "/messages", {
      method: "POST", body: JSON.stringify({ message: element("adminReply").value })
    });
    element("adminReply").value = "";
    await openConversation(selectedId);
    await listConversations();
  } catch (error) { notice(error.message, true); }
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
