/**
 * Register the Jetty tool catalog (tool-definitions.ts) on an MCP server.
 * Node/SDK side; the same catalog reaches the browser through webmcp.ts.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { JettyApiClient } from "./api-client.js";
import { JETTY_TOOLS, jsonResult } from "./tool-definitions.js";

export { JETTY_TOOLS, JETTY_WEBMCP_TOOLS, getJettyTool, jsonResult } from "./tool-definitions.js";
export type { JettyToolDefinition, ToolAnnotations, ToolResult } from "./tool-definitions.js";

export function registerTools(server: McpServer, client: JettyApiClient) {
  for (const tool of JETTY_TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      async (args) => jsonResult(await tool.handler(client, args))
    );
  }
}
