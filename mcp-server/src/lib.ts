/**
 * Library entry (`import ... from "jetty-mcp-server"`). Side-effect free;
 * the stdio server lives in index.ts and is what the `jetty-mcp-server`
 * binary runs.
 */
export { JettyClient, resolveToken } from "./client.js";
export { JettyApiClient, DEFAULT_API_URL } from "./api-client.js";
export type { JettyApiClientOptions, TokenSource } from "./api-client.js";
export { registerTools } from "./tools.js";
export { JETTY_TOOLS, getJettyTool, jsonResult } from "./tool-definitions.js";
export type { JettyToolDefinition, ToolAnnotations, ToolResult } from "./tool-definitions.js";
export {
  findModelContext,
  jettyWebMcpTools,
  registerJettyWebMcpTools,
  toWebMcpTool,
  toolInputJsonSchema,
} from "./webmcp.js";
export type {
  JettyWebMcpOptions,
  ModelContextLike,
  RegisterJettyWebMcpResult,
  WebMcpTool,
} from "./webmcp.js";
