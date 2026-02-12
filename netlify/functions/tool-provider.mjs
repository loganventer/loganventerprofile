/**
 * ToolProvider Contract Definition
 *
 * Every tool provider must satisfy this shape:
 *   name: string                                - unique provider identifier
 *   async initialize(): Promise<void>           - connect / prepare resources
 *   async getTools(): Promise<Tool[]>           - return tools in Claude API format
 *   async executeTool(name, input): Promise<string> - execute tool, return JSON string
 *   validateToolInput(name, input): boolean     - validate input before execution
 *   async dispose(): Promise<void>              - cleanup / disconnect
 *   isAvailable(): boolean                      - whether provider is ready
 *
 * Tool (Claude API format):
 *   { name: string, description: string, input_schema: { type: "object", ... } }
 */

const REQUIRED_MEMBERS = [
  "name",
  "initialize",
  "getTools",
  "executeTool",
  "validateToolInput",
  "dispose",
  "isAvailable",
];

export function assertToolProvider(provider) {
  for (const member of REQUIRED_MEMBERS) {
    const type = typeof provider[member];
    if (type !== "function" && type !== "string") {
      throw new Error(
        `ToolProvider "${provider.name || "unknown"}" missing required member: ${member}`
      );
    }
  }
  return provider;
}
