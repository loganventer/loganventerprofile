import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const DEFAULT_ENDPOINT = "https://learn.microsoft.com/api/mcp";
const CONNECTION_TIMEOUT_MS = 5000;
const CALL_TIMEOUT_MS = 8000;

export function createMcpClient(endpoint = DEFAULT_ENDPOINT) {
  let client = null;
  let transport = null;
  let connected = false;

  return {
    async connect() {
      transport = new StreamableHTTPClientTransport(new URL(endpoint));
      client = new Client(
        { name: "portfolio-chatbot", version: "1.0.0" },
        { capabilities: {} }
      );

      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("MCP connection timeout")), CONNECTION_TIMEOUT_MS)
      );
      await Promise.race([client.connect(transport), timeout]);
      connected = true;
    },

    async listTools() {
      if (!connected) throw new Error("MCP client not connected");
      const result = await client.listTools();
      return result.tools || [];
    },

    async callTool(name, args) {
      if (!connected) throw new Error("MCP client not connected");
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("MCP tool call timeout")), CALL_TIMEOUT_MS)
      );
      return Promise.race([
        client.callTool({ name, arguments: args }),
        timeout,
      ]);
    },

    async disconnect() {
      connected = false;
      if (transport) {
        try { await transport.close(); } catch { /* best effort */ }
      }
      client = null;
      transport = null;
    },

    isConnected() { return connected; },
  };
}
