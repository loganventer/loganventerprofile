import { assertToolProvider } from "./tool-provider.mjs";

export function createToolRegistry() {
  const providers = [];
  const toolToProvider = new Map();

  return {
    register(provider) {
      assertToolProvider(provider);
      providers.push(provider);
    },

    async initialize() {
      await Promise.allSettled(providers.map((p) => p.initialize()));
      toolToProvider.clear();
      for (const provider of providers) {
        if (!provider.isAvailable()) continue;
        const tools = await provider.getTools();
        for (const tool of tools) {
          if (!toolToProvider.has(tool.name)) {
            toolToProvider.set(tool.name, provider);
          }
        }
      }
    },

    async getAllTools() {
      const allTools = [];
      for (const provider of providers) {
        if (!provider.isAvailable()) continue;
        const tools = await provider.getTools();
        allTools.push(...tools);
      }
      return allTools;
    },

    validateToolInput(name, input) {
      const provider = toolToProvider.get(name);
      if (!provider) return false;
      return provider.validateToolInput(name, input);
    },

    async executeTool(name, input) {
      const provider = toolToProvider.get(name);
      if (!provider) return JSON.stringify({ error: "Unknown tool: " + name });
      return provider.executeTool(name, input);
    },

    async dispose() {
      await Promise.allSettled(providers.map((p) => p.dispose()));
    },
  };
}
