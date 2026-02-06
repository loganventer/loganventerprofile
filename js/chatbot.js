(function () {
  "use strict";

  // --- Configuration ---
  var PRIMARY_URL = "";
  var FALLBACK_URL = "/.netlify/functions/chat";
  var TOKEN_URL = "/.netlify/functions/token";
  var MAX_MESSAGES = 25;
  var HEALTH_TIMEOUT = 3000;
  var POLL_INTERVAL = 3000;

  // --- State ---
  var history = [];
  var streaming = false;
  var usePrimary = null;
  var msgCount = parseInt(sessionStorage.getItem("cb_count") || "0");
  var accessToken = localStorage.getItem("cb_token") || null;
  var requestId = sessionStorage.getItem("cb_request_id") || null;
  var pollTimer = null;

  // --- DOM ---
  var container, messages, input, sendBtn, statusDot, statusText;
  var gateOverlay, gateBtn, gateStatus;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    container = document.getElementById("chatbot-container");
    messages = document.getElementById("chatbot-messages");
    input = document.getElementById("chatbot-input");
    sendBtn = document.getElementById("chatbot-send");
    statusDot = document.getElementById("chatbot-status-dot");
    statusText = document.getElementById("chatbot-status-text");

    if (!container) return;

    // Build the access gate overlay
    buildGateOverlay();

    sendBtn.addEventListener("click", handleSend);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    var chips = document.querySelectorAll(".chatbot-prompt-chip");
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        if (streaming) return;
        input.value = chip.textContent;
        handleSend();
      });
    });

    // Check existing token validity
    if (accessToken) {
      validateToken(accessToken).then(function (valid) {
        if (valid) {
          showChat();
        } else {
          accessToken = null;
          localStorage.removeItem("cb_token");
          showGate();
        }
      });
    } else if (requestId) {
      showGate();
      setGateStatus("waiting", "Waiting for approval...");
      startPolling();
    } else {
      showGate();
    }
  }

  function buildGateOverlay() {
    gateOverlay = document.createElement("div");
    gateOverlay.id = "chatbot-gate";
    gateOverlay.style.cssText =
      "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;" +
      "justify-content:center;background:rgba(15,23,42,0.95);z-index:10;border-radius:0.75rem;padding:32px;text-align:center;";

    var icon = document.createElement("div");
    icon.innerHTML =
      '<i class="fas fa-lock" style="font-size:2.5rem;color:#475569;margin-bottom:16px;"></i>';
    gateOverlay.appendChild(icon);

    var title = document.createElement("h3");
    title.textContent = "Access Required";
    title.style.cssText = "color:#E5E7EB;font-size:1.25rem;font-weight:700;margin-bottom:8px;";
    gateOverlay.appendChild(title);

    var desc = document.createElement("p");
    desc.textContent = "This is a live AI demo. Request access to start a conversation.";
    desc.style.cssText = "color:#9CA3AF;font-size:0.875rem;margin-bottom:24px;max-width:280px;";
    gateOverlay.appendChild(desc);

    gateBtn = document.createElement("button");
    gateBtn.textContent = "Request Access";
    gateBtn.className = "btn-primary";
    gateBtn.style.cssText =
      "padding:10px 28px;border-radius:8px;color:white;font-weight:600;font-size:0.875rem;border:none;cursor:pointer;";
    gateBtn.addEventListener("click", requestAccess);
    gateOverlay.appendChild(gateBtn);

    gateStatus = document.createElement("p");
    gateStatus.style.cssText = "color:#6B7280;font-size:0.75rem;margin-top:16px;min-height:1.2em;";
    gateOverlay.appendChild(gateStatus);

    container.style.position = "relative";
    container.appendChild(gateOverlay);
  }

  function showGate() {
    if (gateOverlay) gateOverlay.style.display = "flex";
  }

  function hideGate() {
    if (gateOverlay) gateOverlay.style.display = "none";
  }

  function showChat() {
    hideGate();
    addMessage(
      "assistant",
      "Hi! I'm Logan's portfolio assistant. Ask me anything about his experience, skills, or projects."
    );
  }

  function setGateStatus(type, text) {
    if (!gateStatus) return;
    gateStatus.textContent = text;
    if (type === "waiting") {
      gateStatus.style.color = "#F59E0B";
    } else if (type === "error") {
      gateStatus.style.color = "#EF4444";
    } else {
      gateStatus.style.color = "#6B7280";
    }
  }

  async function requestAccess() {
    gateBtn.disabled = true;
    gateBtn.textContent = "Requesting...";
    setGateStatus("info", "");

    try {
      var res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request" }),
      });

      var data = await res.json();
      if (!res.ok) {
        setGateStatus("error", data.error || "Request failed");
        gateBtn.disabled = false;
        gateBtn.textContent = "Request Access";
        return;
      }

      requestId = data.request_id;
      sessionStorage.setItem("cb_request_id", requestId);
      gateBtn.textContent = "Awaiting Approval";
      setGateStatus("waiting", "Your request has been sent. Waiting for approval...");
      startPolling();
    } catch (err) {
      setGateStatus("error", "Could not reach server. Try again.");
      gateBtn.disabled = false;
      gateBtn.textContent = "Request Access";
    }
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(pollForApproval, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function pollForApproval() {
    if (!requestId) {
      stopPolling();
      return;
    }

    try {
      var res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "poll", request_id: requestId }),
      });

      var data = await res.json();

      if (data.status === "approved" && data.token) {
        stopPolling();
        accessToken = data.token;
        localStorage.setItem("cb_token", accessToken);
        sessionStorage.removeItem("cb_request_id");
        requestId = null;
        showChat();
      } else if (data.status === "denied") {
        stopPolling();
        sessionStorage.removeItem("cb_request_id");
        requestId = null;
        setGateStatus("error", "Access denied.");
        gateBtn.disabled = false;
        gateBtn.textContent = "Request Access";
      } else if (data.status === "expired") {
        stopPolling();
        sessionStorage.removeItem("cb_request_id");
        requestId = null;
        setGateStatus("error", "Token expired. Request again.");
        gateBtn.disabled = false;
        gateBtn.textContent = "Request Access";
      }
    } catch {
      // Silently retry on network errors
    }
  }

  async function validateToken(token) {
    try {
      var res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate", token: token }),
      });
      var data = await res.json();
      return data.valid === true;
    } catch {
      return false;
    }
  }

  function handleSend() {
    var text = input.value.trim();
    if (!text || streaming) return;

    if (!accessToken) {
      showGate();
      return;
    }

    if (msgCount >= MAX_MESSAGES) {
      addMessage(
        "assistant",
        "You've reached the demo limit for this session. Refresh the page to start a new conversation."
      );
      return;
    }

    addMessage("user", text);
    history.push({ role: "user", content: text });
    input.value = "";
    msgCount++;
    sessionStorage.setItem("cb_count", String(msgCount));

    var chipsContainer = document.getElementById("chatbot-chips");
    if (chipsContainer) chipsContainer.style.display = "none";

    sendToBackend(text);
  }

  async function sendToBackend(message) {
    streaming = true;
    sendBtn.disabled = true;
    input.disabled = true;

    var msgEl = addMessage("assistant", "");
    var contentEl = msgEl.querySelector(".chat-msg-content");
    contentEl.innerHTML =
      '<span class="typing-indicator"><span></span><span></span><span></span></span>';

    if (usePrimary === null && PRIMARY_URL) {
      usePrimary = await checkPrimaryHealth();
    }

    var url, body;
    if (usePrimary) {
      url = PRIMARY_URL + "/chat/stream";
      body = JSON.stringify({ message: message, stream: true, token: accessToken });
      setStatus(true);
    } else {
      url = FALLBACK_URL;
      body = JSON.stringify({
        message: message,
        history: history.slice(0, -1),
        token: accessToken,
      });
      setStatus(false);
    }

    try {
      var response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
      });

      if (!response.ok) {
        var errData;
        try {
          errData = await response.json();
        } catch {
          errData = {};
        }

        // Token expired or revoked: clear and show gate
        if (
          response.status === 403 &&
          (errData.error === "token_expired" ||
            errData.error === "token_revoked" ||
            errData.error === "access_required")
        ) {
          accessToken = null;
          localStorage.removeItem("cb_token");
          contentEl.textContent = "Access expired. Please request access again.";
          setTimeout(function () {
            showGate();
            gateBtn.disabled = false;
            gateBtn.textContent = "Request Access";
            setGateStatus("info", "");
          }, 1500);
          return;
        }

        throw new Error(errData.error || "HTTP " + response.status);
      }

      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var fullText = "";
      var buffer = "";
      var firstChunk = true;

      while (true) {
        var result = await reader.read();
        if (result.done) break;

        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split("\n");
        buffer = lines.pop();

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i];
          if (!line.startsWith("data: ")) continue;
          var data = line.substring(6);
          if (data === "[DONE]") continue;
          if (data.startsWith("[ERROR]")) {
            contentEl.textContent = "Something went wrong. Please try again.";
            break;
          }
          if (firstChunk) {
            contentEl.textContent = "";
            firstChunk = false;
          }
          fullText += data;
          contentEl.textContent = fullText;
          messages.scrollTop = messages.scrollHeight;
        }
      }

      if (fullText) {
        history.push({ role: "assistant", content: fullText });
      } else if (firstChunk) {
        contentEl.textContent = "No response received. Please try again.";
      }
    } catch (err) {
      contentEl.textContent = err.message.includes("Rate limit")
        ? "Too many requests. Please wait a moment."
        : "Could not reach the assistant. Please try again.";

      if (usePrimary) {
        usePrimary = false;
        setStatus(false);
      }
    } finally {
      streaming = false;
      sendBtn.disabled = false;
      input.disabled = false;
      input.focus();
    }
  }

  async function checkPrimaryHealth() {
    try {
      var controller = new AbortController();
      var timeout = setTimeout(function () {
        controller.abort();
      }, HEALTH_TIMEOUT);
      var res = await fetch(PRIMARY_URL + "/health", { signal: controller.signal });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }

  function setStatus(isPrimary) {
    if (!statusDot || !statusText) return;
    if (isPrimary) {
      statusDot.className = "chatbot-dot chatbot-dot-green";
      statusText.textContent = "Connected to framework";
    } else {
      statusDot.className = "chatbot-dot chatbot-dot-gray";
      statusText.textContent = "Powered by Claude";
    }
  }

  function addMessage(role, text) {
    var wrapper = document.createElement("div");
    wrapper.className = "chat-msg chat-msg-" + role;

    var bubble = document.createElement("div");
    bubble.className = "chat-msg-bubble";

    var content = document.createElement("div");
    content.className = "chat-msg-content";
    content.textContent = text;

    bubble.appendChild(content);
    wrapper.appendChild(bubble);
    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;
    return wrapper;
  }
})();
