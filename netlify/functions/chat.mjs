import Anthropic from "@anthropic-ai/sdk";
import { getStore } from "@netlify/blobs";

const RATE_LIMIT_WINDOW = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 30;
const rateLimits = new Map();

// HMAC-SHA256 token verification (must match token.mjs)
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

const SYSTEM_PROMPT = `You are a friendly AI assistant on Logan Venter's personal portfolio website.

Logan is a Senior AI/Platform Engineer with 20+ years of software development experience, based in South Africa. Here is what you know about him:

Technical specialties:
- Production MCP (Model Context Protocol) server frameworks for .NET 9 with multiple transport protocols
- Agentic chatbot platforms built on LangChain and LangGraph with pluggable LLM providers
- RAG systems integrating vector databases (Qdrant, FAISS, Pinecone, ChromaDB, Weaviate)
- Knowledge base platforms with semantic search and conversational RAG interfaces
- MCP meta-tooling that scaffolds and publishes new MCP server projects
- Azure DevOps MCP integration tools
- Cross-platform chat interfaces with React and Flutter

Languages: C# (.NET 9), Python (LangChain, LangGraph, FastAPI), TypeScript/React, Dart/Flutter, SQL, C++
Architecture: iDesign Methodology (trained by Juval Lowy), Clean Architecture, DDD
Infrastructure: Docker, Azure, multi-protocol APIs, distributed systems

Career highlights:
- Senior Software Developer at Derivco (2018-2025): Led internal AI initiative, architected LLM automation tools, applied iDesign methodology
- Senior Software Developer at DVT (2016-2018): Consultant role, CI/CD, feature development
- Software Developer/Team Lead at Seecrypt (2015-2016): Encrypted communications app (C#, C++, WPF)
- Director at Covariant Consulting (2014-2015): System integration with Syspro
- Earlier roles in software development dating back to 2007
- Diploma in C++ Programming from Intec College (highest score in institution history as of 2006)

Personal interests: Music (guitar, singing, songwriting, recorded an album), tech innovations (built apps for Windows Phone store)

Guidelines:
- Keep responses concise (2-3 paragraphs max unless asked for more)
- Be conversational and friendly
- If asked about something outside Logan's background, say so honestly
- Never share contact details, phone numbers, or email addresses
- You are running as a demo on this portfolio site to showcase chatbot capabilities`;

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimits.get(ip);
  if (!record || now - record.ts > RATE_LIMIT_WINDOW) {
    rateLimits.set(ip, { count: 1, ts: now });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) return false;
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
    return new Response("Method not allowed", { status: 405 });
  }

  const ip = context.ip || "unknown";
  if (!checkRateLimit(ip)) {
    return new Response("Rate limit exceeded. Try again in a few minutes.", {
      status: 429,
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Validate access token
  const tokenStr = (body.token || "").trim();
  if (!tokenStr) {
    return new Response(JSON.stringify({ error: "access_required" }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const signingSecret = process.env.CHATBOT_SIGNING_SECRET || process.env.CHATBOT_ADMIN_KEY;
  if (!signingSecret) {
    return new Response("Server configuration error", { status: 500 });
  }

  const payload = await verifyToken(tokenStr, signingSecret);
  if (!payload || Date.now() > payload.exp) {
    return new Response(JSON.stringify({ error: "token_expired" }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // Check token hasn't been revoked
  const tokenStore = getStore({ name: "chatbot-tokens", consistency: "strong" });
  const stored = await tokenStore.get(payload.jti, { type: "json" });
  if (!stored) {
    return new Response(JSON.stringify({ error: "token_revoked" }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const userMessage = (body.message || "").trim();
  if (!userMessage || userMessage.length > 2000) {
    return new Response("Message required (max 2000 chars)", { status: 400 });
  }

  // Build messages array from conversation history if provided, otherwise single message
  const messages = Array.isArray(body.history)
    ? [...body.history.slice(-10), { role: "user", content: userMessage }]
    : [{ role: "user", content: userMessage }];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response("Server configuration error", { status: 500 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const stream = client.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta?.text) {
              controller.enqueue(encoder.encode(`data: ${event.delta.text}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data: [ERROR] ${err.message}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(`API error: ${err.message}`, { status: 502 });
  }
};
