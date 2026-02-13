import { getStore } from "@netlify/blobs";
import { verifyToken } from "./verify-token.mjs";

const ALLOWED_ORIGINS = [
  "https://loganventer.com",
  "https://loganventer.netlify.app",
];
function getAllowedOrigin(request) {
  const origin = request.headers.get("origin") || "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

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

function cors(body, status = 200, origin = ALLOWED_ORIGINS[0]) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
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
  const origin = getAllowedOrigin(request);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "POST") {
    return cors({ error: "Method not allowed" }, 405, origin);
  }

  const respond = (body, status) => cors(body, status, origin);

  let body;
  try {
    body = await request.json();
  } catch {
    return respond({ error: "Invalid JSON" }, 400);
  }

  const action = (body.action || "").trim();
  const adminKey = process.env.CHATBOT_ADMIN_KEY;
  const signingSecret = process.env.CHATBOT_SIGNING_SECRET || adminKey;
  const { pending, tokens } = getStores();
  const PENDING_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  // --- Visitor: Request access (auto-approved, 5 min token) ---
  if (action === "request") {
    const ip = context.ip || "unknown";
    if (!checkRequestLimit(ip)) {
      return respond({ error: "Too many requests. Try again later." }, 429);
    }
    const requestId = generateId();
    const ua = request.headers.get("user-agent") || "unknown";
    const now = Date.now();
    const AUTO_TIMEOUT = 5; // minutes
    const exp = now + AUTO_TIMEOUT * 60 * 1000;
    const jti = generateId();

    const signedToken = await signToken(
      { jti, sub: requestId, iat: now, exp },
      signingSecret
    );

    await tokens.setJSON(jti, {
      jti,
      request_id: requestId,
      ip,
      created: now,
      expires: exp,
      timeout_minutes: AUTO_TIMEOUT,
      signed_token: signedToken,
    });

    notifyTokenRequest({ id: requestId, ip, ua: ua.substring(0, 120), ts: now });
    return respond({ request_id: requestId, token: signedToken, expires: exp });
  }

  // --- Visitor: Poll for approval status ---
  if (action === "poll") {
    const requestId = (body.request_id || "").trim();
    if (!requestId) return respond({ status: "unknown" });

    const req = await pending.get(requestId, { type: "json" });
    if (req) {
      if (Date.now() - req.ts > PENDING_TTL) {
        await pending.delete(requestId);
        return respond({ status: "expired" });
      }
      return respond({ status: "pending" });
    }

    // Check if a token was issued for this request
    const tokenList = await tokens.list();
    for (const entry of tokenList.blobs) {
      const data = await tokens.get(entry.key, { type: "json" });
      if (data && data.request_id === requestId) {
        if (Date.now() > data.expires) {
          await tokens.delete(entry.key);
          return respond({ status: "expired" });
        }
        return respond({ status: "approved", token: data.signed_token });
      }
    }
    return respond({ status: "denied" });
  }

  // --- Visitor: Validate a token ---
  if (action === "validate") {
    const tokenStr = (body.token || "").trim();
    if (!tokenStr) return respond({ valid: false });

    const payload = await verifyToken(tokenStr, signingSecret);
    if (!payload) return respond({ valid: false, reason: "invalid_signature" });
    if (Date.now() > payload.exp) return respond({ valid: false, reason: "expired" });

    // Also verify it hasn't been revoked
    const stored = await tokens.get(payload.jti, { type: "json" });
    if (!stored) return respond({ valid: false, reason: "revoked" });

    return respond({ valid: true, expires: payload.exp });
  }

  // --- Admin actions below require admin key ---
  if (!adminKey) {
    return respond({ error: "Admin not configured" }, 500);
  }

  if (body.admin_key !== adminKey) {
    return respond({ error: "Unauthorized" }, 401);
  }

  // --- Admin: List pending requests (auto-prune expired) ---
  if (action === "pending") {
    const list = await pending.list();
    const items = [];
    const now = Date.now();
    for (const entry of list.blobs) {
      const data = await pending.get(entry.key, { type: "json" });
      if (!data) continue;
      if (now - data.ts > PENDING_TTL) {
        await pending.delete(entry.key);
        continue;
      }
      items.push(data);
    }
    items.sort((a, b) => b.ts - a.ts);
    return respond({ pending: items });
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
    return respond({ tokens: items });
  }

  // --- Admin: Reset demo message limit ---
  if (action === "reset_limit") {
    const jti = (body.jti || "").trim();
    if (!jti) return respond({ error: "jti required" }, 400);
    const countStore = getStore({ name: "chatbot-counts", consistency: "strong" });
    await countStore.setJSON(jti, { count: 0 });
    return respond({ ok: true });
  }

  // --- Admin: Approve a pending request ---
  if (action === "approve") {
    const requestId = (body.request_id || "").trim();
    const timeoutMinutes = parseInt(body.timeout_minutes) || 60;

    if (!requestId) return respond({ error: "request_id required" }, 400);

    const req = await pending.get(requestId, { type: "json" });
    if (!req) return respond({ error: "Request not found" }, 404);

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

    return respond({ ok: true, token: signedToken, expires: exp });
  }

  // --- Admin: Deny a pending request ---
  if (action === "deny") {
    const requestId = (body.request_id || "").trim();
    if (!requestId) return respond({ error: "request_id required" }, 400);
    await pending.delete(requestId);
    return respond({ ok: true });
  }

  // --- Admin: Revoke a specific token ---
  if (action === "revoke") {
    const jti = (body.jti || "").trim();
    if (!jti) return respond({ error: "jti required" }, 400);
    await tokens.delete(jti);
    return respond({ ok: true });
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
    return respond({ ok: true, cleared });
  }

  return respond({ error: "Unknown action" }, 400);
};
