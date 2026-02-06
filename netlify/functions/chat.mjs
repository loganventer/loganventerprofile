import Anthropic from "@anthropic-ai/sdk";
import { getStore } from "@netlify/blobs";
import { searchKnowledge, getProjectDetails, getExperience, getSkillsByCategory } from "./knowledge.mjs";

const RATE_LIMIT_WINDOW = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 30;
const MAX_TOOL_ROUNDS = 3;
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

Use your tools to look up specific details about Logan's experience, skills, projects, and background. Always use tools to get accurate information rather than guessing.

Guidelines:
- Keep responses concise (2-3 paragraphs max unless asked for more)
- Be conversational and friendly
- If asked about something outside Logan's background, say so honestly
- Never share contact details, phone numbers, or email addresses

Formatting rules (always follow these):
- Use **bold** for names, titles, technologies, and key terms
- Use bullet lists (- item) when listing multiple items, skills, or responsibilities
- Use ### headers for sections in longer responses
- Separate paragraphs with blank lines
- Use code blocks with language tags for any code examples
- When showing any diagram, flowchart, timeline, architecture, or visual structure, ALWAYS use a mermaid code block (\`\`\`mermaid)
- Never output plain walls of text`;

const TOOLS = [
  {
    name: "search_knowledge",
    description: "Search Logan's portfolio knowledge base for information about his experience, skills, projects, education, interests, or background. Use this for general or broad queries.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_project_details",
    description: "Get detailed information about a specific featured project by name. Projects include: MCP Server Framework, Chatbot Framework, Azure DevOps Integration, Knowledge Base System.",
    input_schema: {
      type: "object",
      properties: {
        project_name: { type: "string", description: "Name or keyword of the project to look up" },
      },
      required: ["project_name"],
    },
  },
  {
    name: "get_experience",
    description: "Get details about Logan's work experience at a specific company. Companies include: TIH, Derivco, DVT, Seecrypt, Covariant, UD Trucks, Enermatics, Infotech, ITW.",
    input_schema: {
      type: "object",
      properties: {
        company: { type: "string", description: "Company name or abbreviation" },
      },
      required: ["company"],
    },
  },
  {
    name: "get_skills",
    description: "Get Logan's technical skills filtered by category: 'languages', 'frameworks', 'concepts', or 'all'.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Skill category: languages, frameworks, concepts, or all" },
      },
      required: ["category"],
    },
  },
];

function executeTool(name, input) {
  switch (name) {
    case "search_knowledge":
      return JSON.stringify(searchKnowledge(input.query));
    case "get_project_details":
      return JSON.stringify(getProjectDetails(input.project_name));
    case "get_experience":
      return JSON.stringify(getExperience(input.company));
    case "get_skills":
      return JSON.stringify(getSkillsByCategory(input.category));
    default:
      return JSON.stringify({ error: "Unknown tool: " + name });
  }
}

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

  // Server-side message count enforcement
  const countStore = getStore({ name: "chatbot-counts", consistency: "strong" });
  const countKey = payload.jti;
  const countData = (await countStore.get(countKey, { type: "json" })) || { count: 0 };
  if (countData.count >= 25) {
    return new Response(JSON.stringify({ error: "demo_limit" }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
  countData.count++;
  await countStore.setJSON(countKey, countData);

  const userMessage = (body.message || "").trim();
  if (!userMessage || userMessage.length > 2000) {
    return new Response("Message required (max 2000 chars)", { status: 400 });
  }

  // Build messages array from conversation history
  const messages = Array.isArray(body.history)
    ? [...body.history.slice(-10), { role: "user", content: userMessage }]
    : [{ role: "user", content: userMessage }];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response("Server configuration error", { status: 500 });
  }

  const client = new Anthropic({ apiKey });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      function emit(obj) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      }

      try {
        let toolMessages = [...messages];
        let finalText = null;

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const response = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            tools: TOOLS,
            messages: toolMessages,
          });

          const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
          if (toolUseBlocks.length === 0) {
            finalText = response.content
              .filter((b) => b.type === "text")
              .map((b) => b.text)
              .join("");
            break;
          }

          // Emit tool call indicators to the client
          for (const block of toolUseBlocks) {
            emit({ type: "tool", name: block.name });
          }

          toolMessages.push({ role: "assistant", content: response.content });

          const toolResults = toolUseBlocks.map((block) => ({
            type: "tool_result",
            tool_use_id: block.id,
            content: executeTool(block.name, block.input),
          }));

          toolMessages.push({ role: "user", content: toolResults });
        }

        if (finalText !== null) {
          // Got text from tool loop - send in chunks
          const chunkSize = 20;
          for (let i = 0; i < finalText.length; i += chunkSize) {
            emit({ type: "delta", text: finalText.slice(i, i + chunkSize) });
          }
        } else {
          // Exhausted tool rounds - stream final response
          const stream = client.messages.stream({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: toolMessages,
          });

          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta?.text) {
              emit({ type: "delta", text: event.delta.text });
            }
          }
        }

        emit({ type: "done" });
      } catch (err) {
        emit({ type: "error", message: err.message });
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
};
