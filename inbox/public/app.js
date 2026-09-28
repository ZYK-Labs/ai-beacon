const element = id => document.getElementById(id);
const state = { id: "", token: "" };

function notice(message, error = false) {
  const box = element("systemStatus");
  box.textContent = message;
  box.classList.toggle("error", error);
}

async function api(path, options = {}) {
  const response = await fetch(path, { cache: "no-store", ...options });
  const data = await response.json().catch(() => ({ error: "Unexpected server response." }));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function sessionSave() {
  try { sessionStorage.setItem("ai-beacon-conversation", JSON.stringify(state)); } catch {}
}

function setSession(id, token) {
  state.id = id;
  state.token = token;
  sessionSave();
}

function drawMessages(messages) {
  const container = element("messages");
  container.replaceChildren();
  if (!messages.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No messages yet.";
    container.append(empty);
    return;
  }
  for (const entry of messages) {
    const bubble = document.createElement("div");
    bubble.className = entry.role === "admin" ? "bubble admin" : "bubble";
    const header = document.createElement("div");
    header.className = "bubbleHeader";
    header.textContent = (entry.role === "admin" ? "ZYK Labs" : "Visitor") + " · " +
      new Date(entry.created_at).toLocaleString();
    const body = document.createElement("div");
    body.className = "bubbleBody";
    body.textContent = entry.body;
    bubble.append(header, body);
    container.append(bubble);
  }
}

async function refreshThread() {
  if (!state.id || !state.token) return;
  const data = await api("/api/conversations/" + encodeURIComponent(state.id), {
    headers: { Authorization: "Bearer " + state.token }
  });
  element("newSection").hidden = true;
  element("threadSection").hidden = false;
  element("threadId").textContent = data.conversation_id;
  element("threadStatus").textContent = data.status;
  element("replyForm").hidden = data.status !== "open";
  drawMessages(data.messages);
  notice("Connected to your private conversation.");
}

function firstContactToken(fields) {
  // Persist before POST so a retry after a network timeout cannot create a
  // second conversation or lose the one-time recovery token.
  const fingerprint = JSON.stringify(fields);
  try {
    const pending = JSON.parse(sessionStorage.getItem("ai-beacon-pending-first") || "null");
    if (pending?.fingerprint === fingerprint && /^[0-9a-f]{64}$/.test(pending.token)) {
      return pending.token;
    }
  } catch {}
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  try { sessionStorage.setItem("ai-beacon-pending-first", JSON.stringify({ fingerprint, token })); } catch {}
  return token;
}

element("firstForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = element("sendBtn");
  button.disabled = true;
  try {
    const fields = {
      name: element("name").value,
      invitation_id: element("invitation").value,
      message: element("message").value
    };
    const data = await api("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fields, client_access_token: firstContactToken(fields) })
    });
    setSession(data.conversation_id, data.access_token);
    try { sessionStorage.removeItem("ai-beacon-pending-first"); } catch {}
    element("receiptValue").value = data.conversation_id + "." + data.access_token;
    element("receipt").hidden = false;
    await refreshThread();
    element("receipt").scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    notice(error.message, true);
  } finally {
    button.disabled = false;
  }
});

element("replyForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = element("replyBtn");
  button.disabled = true;
  try {
    await api("/api/conversations/" + encodeURIComponent(state.id) + "/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + state.token },
      body: JSON.stringify({ message: element("replyText").value })
    });
    element("replyText").value = "";
    await refreshThread();
  } catch (error) {
    notice(error.message, true);
  } finally {
    button.disabled = false;
  }
});

element("restoreForm").addEventListener("submit", async event => {
  event.preventDefault();
  const match = /^([0-9a-f-]{36})\.([0-9a-f]{64})$/i.exec(element("restoreKey").value.trim());
  if (!match) return notice("Invalid recovery key format.", true);
  const previous = { ...state };
  state.id = match[1];
  state.token = match[2];
  try {
    await refreshThread();
    sessionSave();
    element("receipt").hidden = true;
    element("restoreKey").value = "";
  } catch (error) {
    Object.assign(state, previous);
    notice(error.message, true);
  }
});

element("copyReceipt").addEventListener("click", async () => {
  const input = element("receiptValue");
  try {
    await navigator.clipboard.writeText(input.value);
    element("copyReceipt").textContent = "Copied";
  } catch {
    input.focus();
    input.select();
    notice("Copy the selected private key and store it safely.");
  }
});

element("refreshBtn").addEventListener("click", async () => {
  try { await refreshThread(); } catch (error) { notice(error.message, true); }
});

(async () => {
  try {
    const health = await api("/api/health");
    if (health.status !== "ready") throw new Error("Inbox is not configured.");
    notice("Inbox online. You can start a conversation.");
    try {
      const saved = JSON.parse(sessionStorage.getItem("ai-beacon-conversation") || "null");
      if (saved && saved.id && saved.token) {
        state.id = saved.id;
        state.token = saved.token;
        await refreshThread();
      }
    } catch {
      sessionStorage.removeItem("ai-beacon-conversation");
    }
  } catch {
    notice("Inbox is not live yet. You can still use our public GitHub conversation.", true);
    element("sendBtn").disabled = true;
  }
})();
