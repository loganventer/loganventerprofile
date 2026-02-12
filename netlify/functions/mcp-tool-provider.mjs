import { createMcpClient } from "./mcp-client.mjs";
import { adaptMcpToolsToClaude } from "./tool-schema-adapter.mjs";

export function createMcpToolProvider(endpoint) {
  const mcpClient = createMcpClient(endpoint);
  let tools = [];
  let mcpToolNames = new Set();
  let available = false;

  return {
    name: "mslearn",

    async initialize() {
      try {
        await mcpClient.connect();
        const mcpTools = await mcpClient.listTools();
        tools = adaptMcpToolsToClaude(mcpTools);
        mcpToolNames = new Set(tools.map((t) => t.name));
        available = true;
      } catch (err) {
        console.error("[MCP] Failed to initialize MS Learn provider:", err.message);
        tools = [];
        mcpToolNames = new Set();
        available = false;
      }
    },

    async getTools() {
      return tools;
    },

    async executeTool(name, input) {
      if (!available || !mcpToolNames.has(name)) {
        return JSON.stringify({ error: "MCP tool unavailable: " + name });
      }
      try {
        const result = await mcpClient.callTool(name, input);
        if (result && result.content) {
          const text = result.content
            .filter((c) => c.type === "text")
            .map((c) => c.text)
            .join("\n");
          return text || JSON.stringify(result.content);
        }
        return JSON.stringify(result);
      } catch (err) {
        console.error("[MCP] Tool call failed:", name, err.message);
        return JSON.stringify({ error: "MCP tool call failed: " + err.message });
      }
    },

    validateToolInput(name, input) {
      return mcpToolNames.has(name) && input !== null && typeof input === "object";
    },

    async dispose() {
      available = false;
      await mcpClient.disconnect();
    },

    isAvailable() { return available; },
  };
}
