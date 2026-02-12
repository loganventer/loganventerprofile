export function adaptMcpToolToClaude(mcpTool) {
  return {
    name: mcpTool.name,
    description: mcpTool.description || "",
    input_schema: mcpTool.inputSchema || { type: "object", properties: {} },
  };
}

export function adaptMcpToolsToClaude(mcpTools) {
  return mcpTools.map(adaptMcpToolToClaude);
}
