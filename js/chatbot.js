(function () {
  "use strict";

  // --- Configuration ---
  var PRIMARY_URL = "";
  var FALLBACK_URL = "/.netlify/functions/chat";
  var TOKEN_URL = "/.netlify/functions/token";
  var HEALTH_TIMEOUT = 3000;
  var POLL_INTERVAL = 3000;

  // --- State ---
  var history = [];
  var streaming = false;
  var usePrimary = null;
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

    // Quick action buttons
    var actions = document.querySelectorAll(".chatbot-action");
    actions.forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (streaming) return;
        input.value = btn.getAttribute("data-query");
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
    gateOverlay.className = "chatbot-gate";

    var icon = document.createElement("div");
    icon.className = "chatbot-gate-icon";
    icon.innerHTML = '<i class="fas fa-lock"></i>';
    gateOverlay.appendChild(icon);

    var title = document.createElement("h3");
    title.textContent = "Access Required";
    title.className = "chatbot-gate-title";
    gateOverlay.appendChild(title);

    var desc = document.createElement("p");
    desc.textContent = "This is a live AI demo. Request access to start a conversation.";
    desc.className = "chatbot-gate-desc";
    gateOverlay.appendChild(desc);

    gateBtn = document.createElement("button");
    gateBtn.textContent = "Request Access";
    gateBtn.className = "btn-primary";
    gateBtn.style.cssText =
      "padding:10px 28px;border-radius:8px;color:white;font-weight:600;font-size:0.875rem;border:none;cursor:pointer;";
    gateBtn.addEventListener("click", requestAccess);
    gateOverlay.appendChild(gateBtn);

    gateStatus = document.createElement("p");
    gateStatus.className = "chatbot-gate-status";
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

    addMessage("user", text);
    history.push({ role: "user", content: text });
    input.value = "";

    var chipsContainer = document.getElementById("chatbot-chips");
    if (chipsContainer) chipsContainer.style.display = "none";
    var actionsContainer = document.getElementById("chatbot-actions");
    if (actionsContainer) actionsContainer.style.display = "none";

    sendToBackend(text);
  }

  async function sendToBackend(message) {
    streaming = true;
    sendBtn.disabled = true;
    input.disabled = true;

    var msgEl = addMessage("assistant", "");
    var contentEl = msgEl.querySelector(".chat-msg-content");
    contentEl.innerHTML =
      '<span class="typing-indicator"><i class="fas fa-search" style="font-size:10px;color:#64748b;margin-right:6px;"></i><span></span><span></span><span></span></span>';

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

    var TOOL_LABELS = {
      search_knowledge: "Searching knowledge base",
      get_project_details: "Looking up project details",
      get_experience: "Looking up work experience",
      get_skills: "Looking up technical skills"
    };

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

        // Server-side demo limit reached
        if (response.status === 429 && errData.error === "demo_limit") {
          contentEl.textContent = "You've reached the demo message limit. The admin can reset your limit if needed.";
          return;
        }

        throw new Error(errData.error || "HTTP " + response.status);
      }

      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var fullText = "";
      var buffer = "";
      var showingTyping = true;
      var receivedText = false;

      while (true) {
        var result = await reader.read();
        if (result.done) break;

        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split("\n");
        buffer = lines.pop();

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i];
          if (!line.startsWith("data: ")) continue;
          var raw = line.substring(6);

          var evt;
          try {
            evt = JSON.parse(raw);
          } catch {
            // Legacy plain text fallback
            if (raw === "[DONE]") continue;
            if (raw.startsWith("[ERROR]")) {
              contentEl.textContent = "Something went wrong. Please try again.";
              break;
            }
            if (showingTyping) { contentEl.innerHTML = ""; showingTyping = false; }
            fullText += raw;
            contentEl.innerHTML = renderMarkdown(fullText);
            if (isNearBottom()) scrollToBottom();
            continue;
          }

          if (evt.type === "tool") {
            if (showingTyping) { contentEl.innerHTML = ""; showingTyping = false; }
            var label = TOOL_LABELS[evt.name] || evt.name;
            var indicator = document.createElement("div");
            indicator.className = "chat-tool-indicator";
            indicator.innerHTML = '<i class="fas fa-cog fa-spin"></i> ' + label + '...';
            contentEl.appendChild(indicator);
            if (isNearBottom()) scrollToBottom();
          } else if (evt.type === "delta") {
            if (!receivedText) {
              contentEl.innerHTML = "";
              receivedText = true;
            }
            fullText += evt.text;
            contentEl.innerHTML = renderMarkdown(fullText);
            if (isNearBottom()) scrollToBottom();
          } else if (evt.type === "error") {
            contentEl.textContent = "Something went wrong. Please try again.";
            break;
          }
        }
      }

      if (fullText) {
        history.push({ role: "assistant", content: fullText });
        contentEl.innerHTML = renderMarkdown(fullText);
        renderMermaidBlocks(contentEl);
      } else if (!receivedText) {
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

  // --- Markdown rendering ---
  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderInlineMarkdown(line) {
    // Inline code first (protect from other transforms)
    var codes = [];
    line = line.replace(/`([^`]+)`/g, function (_, code) {
      codes.push(code);
      return "\x00CODE" + (codes.length - 1) + "\x00";
    });
    // Bold: **text** or __text__
    line = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    line = line.replace(/__(.+?)__/g, "<strong>$1</strong>");
    // Italic: *text* or _text_ (but not inside words for _)
    line = line.replace(/\*(.+?)\*/g, "<em>$1</em>");
    line = line.replace(/(?:^|(?<=\s))_(.+?)_(?=\s|$)/g, "<em>$1</em>");
    // Strikethrough: ~~text~~
    line = line.replace(/~~(.+?)~~/g, "<del>$1</del>");
    // Links: [text](url)
    line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-sky-400 hover:underline">$1</a>');
    // Restore inline codes
    line = line.replace(/\x00CODE(\d+)\x00/g, function (_, idx) {
      return '<code class="chat-inline-code">' + codes[parseInt(idx)] + "</code>";
    });
    return line;
  }

  function renderMarkdown(text) {
    var result = "";
    var parts = text.split("```");
    for (var i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        // Outside code block: full markdown
        var lines = escapeHtml(parts[i]).split("\n");
        var html = "";
        var inList = false;
        var listType = "";

        for (var j = 0; j < lines.length; j++) {
          var line = lines[j];

          // Headings
          var headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
          if (headingMatch) {
            if (inList) { html += "</" + listType + ">"; inList = false; }
            var level = headingMatch[1].length;
            var sizes = { 1: "1.3em", 2: "1.15em", 3: "1em", 4: "0.9em" };
            html += '<div style="font-weight:700;font-size:' + sizes[level] + ';margin:8px 0 4px;color:var(--text-heading);">' + renderInlineMarkdown(headingMatch[2]) + "</div>";
            continue;
          }

          // Horizontal rule
          if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
            if (inList) { html += "</" + listType + ">"; inList = false; }
            html += '<hr style="border:none;border-top:1px solid var(--border-light);margin:8px 0;">';
            continue;
          }

          // Blockquote
          if (line.match(/^&gt;\s?(.*)$/)) {
            if (inList) { html += "</" + listType + ">"; inList = false; }
            var quoteContent = line.replace(/^&gt;\s?/, "");
            html += '<div style="border-left:3px solid var(--text-dim);padding:2px 12px;margin:4px 0;color:var(--text-muted);">' + renderInlineMarkdown(quoteContent) + "</div>";
            continue;
          }

          // Unordered list
          var ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
          if (ulMatch) {
            if (!inList || listType !== "ul") {
              if (inList) html += "</" + listType + ">";
              html += '<ul style="margin:4px 0;padding-left:20px;list-style:disc;">';
              inList = true;
              listType = "ul";
            }
            html += "<li>" + renderInlineMarkdown(ulMatch[2]) + "</li>";
            continue;
          }

          // Ordered list
          var olMatch = line.match(/^(\s*)\d+[.)]\s+(.+)$/);
          if (olMatch) {
            if (!inList || listType !== "ol") {
              if (inList) html += "</" + listType + ">";
              html += '<ol style="margin:4px 0;padding-left:20px;list-style:decimal;">';
              inList = true;
              listType = "ol";
            }
            html += "<li>" + renderInlineMarkdown(olMatch[2]) + "</li>";
            continue;
          }

          // Close any open list
          if (inList) { html += "</" + listType + ">"; inList = false; }

          // Empty line = paragraph break
          if (line.trim() === "") {
            html += "<br>";
            continue;
          }

          // Regular paragraph line
          html += renderInlineMarkdown(line) + "<br>";
        }

        if (inList) html += "</" + listType + ">";
        // Clean up trailing <br>
        html = html.replace(/(<br>)+$/, "");
        result += html;
      } else {
        // Inside code block
        var block = parts[i];
        var lang = "";
        var newlineIdx = block.indexOf("\n");
        if (newlineIdx !== -1) {
          var firstLine = block.substring(0, newlineIdx).trim();
          if (firstLine && /^[a-zA-Z0-9+#_-]+$/.test(firstLine)) {
            lang = firstLine;
            block = block.substring(newlineIdx + 1);
          }
        }
        // Remove trailing newline
        if (block.endsWith("\n")) block = block.slice(0, -1);

        if (lang === "mermaid") {
          var dlBtn = '<button class="chat-mermaid-download" title="Download as PNG"><i class="fas fa-download"></i></button>';
          result += '<div class="chat-mermaid-block">' + dlBtn + '<pre class="mermaid">' + escapeHtml(block) + "</pre></div>";
        } else {
          var langAttr = lang ? ' data-lang="' + escapeHtml(lang) + '"' : "";
          var langLabel = lang ? '<span class="chat-code-lang">' + escapeHtml(lang) + "</span>" : "";
          var copyBtn = '<button class="chat-code-copy" title="Copy"><i class="fas fa-copy"></i></button>';
          result += '<div class="chat-code-block"' + langAttr + "><div class=\"chat-code-header\">" + langLabel + copyBtn + "</div><pre><code>" + escapeHtml(block) + "</code></pre></div>";
        }
      }
    }
    return result;
  }

  function renderMermaidBlocks(container) {
    if (typeof mermaid === "undefined") return;
    setTimeout(function () {
      var nodes = container.querySelectorAll("pre.mermaid:not([data-processed])");
      if (nodes.length === 0) return;
      try {
        var result = mermaid.run({ nodes: nodes });
        if (result && result.then) {
          result.then(function() {
            if (typeof window.updateMermaidTheme === 'function') {
              var theme = document.documentElement.getAttribute('data-theme') || 'dark';
              window.updateMermaidTheme(theme);
            }
          });
        }
      } catch (e) {
        // Fallback: leave raw text visible
      }
    }, 150);
  }

  function formatTime() {
    var now = new Date();
    var h = now.getHours();
    var m = now.getMinutes();
    var ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return h + ":" + (m < 10 ? "0" : "") + m + " " + ampm;
  }

  function isNearBottom() {
    var threshold = 100;
    return messages.scrollHeight - messages.scrollTop - messages.clientHeight < threshold;
  }

  function scrollToBottom() {
    messages.scrollTo({ top: messages.scrollHeight, behavior: "smooth" });
  }

  function addMessage(role, text) {
    var shouldScroll = isNearBottom();

    var wrapper = document.createElement("div");
    wrapper.className = "chat-msg chat-msg-" + role;

    // Avatar
    var avatar = document.createElement("div");
    avatar.className = "chat-msg-avatar";
    avatar.innerHTML = role === "assistant"
      ? '<i class="fas fa-robot"></i>'
      : '<i class="fas fa-user"></i>';

    var bubble = document.createElement("div");
    bubble.className = "chat-msg-bubble";

    var content = document.createElement("div");
    content.className = "chat-msg-content";
    if (text) {
      content.innerHTML = renderMarkdown(text);
    }

    // Timestamp
    var time = document.createElement("div");
    time.className = "chat-msg-time";
    time.textContent = formatTime();

    bubble.appendChild(content);
    bubble.appendChild(time);
    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    messages.appendChild(wrapper);

    if (shouldScroll) scrollToBottom();
    if (text) renderMermaidBlocks(content);
    return wrapper;
  }

  // Copy button handler (event delegation)
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".chat-code-copy");
    if (!btn) return;
    var block = btn.closest(".chat-code-block");
    if (!block) return;
    var code = block.querySelector("code");
    if (!code) return;
    navigator.clipboard.writeText(code.textContent).then(function () {
      btn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(function () {
        btn.innerHTML = '<i class="fas fa-copy"></i>';
      }, 1500);
    });
  });

  // Mermaid download as PNG handler (event delegation)
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".chat-mermaid-download");
    if (!btn) return;
    var block = btn.closest(".chat-mermaid-block");
    if (!block) return;
    var svg = block.querySelector("svg");
    if (!svg) return;

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    var scale = 4;
    var clone = svg.cloneNode(true);
    var bbox = svg.getBoundingClientRect();
    var w = bbox.width;
    var h = bbox.height;

    // Inline all computed styles so the standalone SVG renders correctly
    var origEls = svg.querySelectorAll("*");
    var cloneEls = clone.querySelectorAll("*");
    for (var si = 0; si < origEls.length; si++) {
      var cs = getComputedStyle(origEls[si]);
      var style = "";
      for (var pi = 0; pi < cs.length; pi++) {
        style += cs[pi] + ":" + cs.getPropertyValue(cs[pi]) + ";";
      }
      cloneEls[si].setAttribute("style", style);
    }

    // Force the SVG to render at the target pixel resolution
    var vb = svg.getAttribute("viewBox") || ("0 0 " + w + " " + h);
    clone.setAttribute("viewBox", vb);
    clone.setAttribute("width", w * scale);
    clone.setAttribute("height", h * scale);
    clone.removeAttribute("style");
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    var svgData = new XMLSerializer().serializeToString(clone);
    var blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = function () {
      var canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      canvas.toBlob(function (pngBlob) {
        var link = document.createElement("a");
        link.download = "diagram.png";
        link.href = URL.createObjectURL(pngBlob);
        link.click();
        URL.revokeObjectURL(link.href);
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(function () {
          btn.innerHTML = '<i class="fas fa-download"></i>';
        }, 1500);
      }, "image/png");
    };

    img.onerror = function () {
      URL.revokeObjectURL(url);
      btn.innerHTML = '<i class="fas fa-download"></i>';
    };

    img.src = url;
  });
})();
