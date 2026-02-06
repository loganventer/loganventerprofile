import { getStore } from "@netlify/blobs";

function getStores() {
  const pending = getStore({ name: "chatbot-pending", consistency: "strong" });
  const tokens = getStore({ name: "chatbot-tokens", consistency: "strong" });
  return { pending, tokens };
}

function generateId() {
  return crypto.randomUUID();
}

// HMAC-SHA256 token signing so tokens can't be forged client-side
async function signToken(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data = JSON.stringify(payload);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return btoa(JSON.stringify({ d: data, s: sigHex }));
}

async function verifyToken(tokenStr, secret) {
  try {
    const { d, s } = JSON.parse(atob(tokenStr));
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = new Uint8Array(s.match(/.{2}/g).map((h) => parseInt(h, 16)));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(d));
    if (!valid) return null;
    return JSON.parse(d);
  } catch {
    return null;
  }
}

function cors(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// Email notification via Resend (requires RESEND_API_KEY env var)
async function notifyTokenRequest(data) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Portfolio Bot <onboarding@resend.dev>",
        to: ["logan.venter@outlook.com"],
        subject: "New Chatbot Token Request",
        text: [
          "New chatbot token request:",
          "",
          `IP: ${data.ip}`,
          `User Agent: ${data.ua}`,
          `Time: ${new Date(data.ts).toISOString()}`,
          `Request ID: ${data.id}`,
          "",
          "Go to your admin portal to approve or deny.",
        ].join("\n"),
      }),
    });
  } catch (e) {
    console.error("Token request notification failed:", e);
  }
}

// Rate limiting for token requests
const requestLimits = new Map();
function checkRequestLimit(ip) {
  const now = Date.now();
  const record = requestLimits.get(ip);
  if (!record || now - record.ts > 600000) {
    requestLimits.set(ip, { count: 1, ts: now });
    return true;
  }
  if (record.count >= 5) return false;
  record.count++;
  return true;
}

export default async (request, context) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "POST") {
    return cors({ error: "Method not allowed" }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return cors({ error: "Invalid JSON" }, 400);
  }

  const action = (body.action || "").trim();
  const adminKey = process.env.CHATBOT_ADMIN_KEY;
  const signingSecret = process.env.CHATBOT_SIGNING_SECRET || adminKey;
  const { pending, tokens } = getStores();

  // --- Visitor: Request access ---
  if (action === "request") {
    const ip = context.ip || "unknown";
    if (!checkRequestLimit(ip)) {
      return cors({ error: "Too many requests. Try again later." }, 429);
    }
    const requestId = generateId();
    const ua = request.headers.get("user-agent") || "unknown";
    const ts = Date.now();
    await pending.setJSON(requestId, {
      id: requestId,
      ip,
      ua: ua.substring(0, 120),
      ts,
      status: "pending",
    });
    await notifyTokenRequest({ id: requestId, ip, ua: ua.substring(0, 120), ts });
    return cors({ request_id: requestId });
  }

  // --- Visitor: Poll for approval status ---
  if (action === "poll") {
    const requestId = (body.request_id || "").trim();
    if (!requestId) return cors({ status: "unknown" });

    const req = await pending.get(requestId, { type: "json" });
    if (req) return cors({ status: "pending" });

    // Check if a token was issued for this request
    const tokenList = await tokens.list();
    for (const entry of tokenList.blobs) {
      const data = await tokens.get(entry.key, { type: "json" });
      if (data && data.request_id === requestId) {
        if (Date.now() > data.expires) {
          await tokens.delete(entry.key);
          return cors({ status: "expired" });
        }
        return cors({ status: "approved", token: data.signed_token });
      }
    }
    return cors({ status: "denied" });
  }

  // --- Visitor: Validate a token ---
  if (action === "validate") {
    const tokenStr = (body.token || "").trim();
    if (!tokenStr) return cors({ valid: false });

    const payload = await verifyToken(tokenStr, signingSecret);
    if (!payload) return cors({ valid: false, reason: "invalid_signature" });
    if (Date.now() > payload.exp) return cors({ valid: false, reason: "expired" });

    // Also verify it hasn't been revoked
    const stored = await tokens.get(payload.jti, { type: "json" });
    if (!stored) return cors({ valid: false, reason: "revoked" });

    return cors({ valid: true, expires: payload.exp });
  }

  // --- Admin actions below require admin key ---
  if (!adminKey) {
    return cors({ error: "Admin not configured" }, 500);
  }

  if (body.admin_key !== adminKey) {
    return cors({ error: "Unauthorized" }, 401);
  }

  // --- Admin: List pending requests ---
  if (action === "pending") {
    const list = await pending.list();
    const items = [];
    for (const entry of list.blobs) {
      const data = await pending.get(entry.key, { type: "json" });
      if (data) items.push(data);
    }
    items.sort((a, b) => b.ts - a.ts);
    return cors({ pending: items });
  }

  // --- Admin: List active tokens ---
  if (action === "tokens") {
    const list = await tokens.list();
    const countStore = getStore({ name: "chatbot-counts", consistency: "strong" });
    const items = [];
    const now = Date.now();
    for (const entry of list.blobs) {
      const data = await tokens.get(entry.key, { type: "json" });
      if (data) {
        data.is_expired = now > data.expires;
        const countData = await countStore.get(entry.key, { type: "json" });
        data.msg_count = countData ? countData.count : 0;
        items.push(data);
      }
    }
    items.sort((a, b) => b.created - a.created);
    return cors({ tokens: items });
  }

  // --- Admin: Reset demo message limit ---
  if (action === "reset_limit") {
    const jti = (body.jti || "").trim();
    if (!jti) return cors({ error: "jti required" }, 400);
    const countStore = getStore({ name: "chatbot-counts", consistency: "strong" });
    await countStore.setJSON(jti, { count: 0 });
    return cors({ ok: true });
  }

  // --- Admin: Approve a pending request ---
  if (action === "approve") {
    const requestId = (body.request_id || "").trim();
    const timeoutMinutes = parseInt(body.timeout_minutes) || 60;

    if (!requestId) return cors({ error: "request_id required" }, 400);

    const req = await pending.get(requestId, { type: "json" });
    if (!req) return cors({ error: "Request not found" }, 404);

    const jti = generateId();
    const now = Date.now();
    const exp = now + timeoutMinutes * 60 * 1000;

    // Create signed token
    const signedToken = await signToken(
      { jti, sub: requestId, iat: now, exp },
      signingSecret
    );

    await tokens.setJSON(jti, {
      jti,
      request_id: requestId,
      ip: req.ip,
      created: now,
      expires: exp,
      timeout_minutes: timeoutMinutes,
      signed_token: signedToken,
    });

    await pending.delete(requestId);

    return cors({ ok: true, token: signedToken, expires: exp });
  }

  // --- Admin: Deny a pending request ---
  if (action === "deny") {
    const requestId = (body.request_id || "").trim();
    if (!requestId) return cors({ error: "request_id required" }, 400);
    await pending.delete(requestId);
    return cors({ ok: true });
  }

  // --- Admin: Revoke a specific token ---
  if (action === "revoke") {
    const jti = (body.jti || "").trim();
    if (!jti) return cors({ error: "jti required" }, 400);
    await tokens.delete(jti);
    return cors({ ok: true });
  }

  // --- Admin: Emergency clear ALL ---
  if (action === "clear") {
    let cleared = 0;
    const pendingList = await pending.list();
    for (const entry of pendingList.blobs) {
      await pending.delete(entry.key);
      cleared++;
    }
    const tokenList = await tokens.list();
    for (const entry of tokenList.blobs) {
      await tokens.delete(entry.key);
      cleared++;
    }
    return cors({ ok: true, cleared });
  }

  return cors({ error: "Unknown action" }, 400);
};
