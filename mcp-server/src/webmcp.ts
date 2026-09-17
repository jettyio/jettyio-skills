/**
 * WebMCP adapter: the Jetty tool catalog on a page's `modelContext`
 * (https://webmachinelearning.github.io/webmcp/). Browser-safe.
 *
 * A site that already authenticates the visitor registers the same tools the
 * stdio MCP server offers, executed with the visitor's own session:
 *
 *   const client = new JettyApiClient({ token: () => session.getToken(), ... });
 *   registerJettyWebMcpTools(navigator.modelContext, client, { signal });
 *
 * Both API shapes are handled: the current `registerTool(tool, { signal })`
 * and the earlier `provideContext({ tools })`.
 */
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { JettyApiClient } from "./api-client.js";
import {
  JETTY_WEBMCP_TOOLS,
  jsonResult,
  type JettyToolDefinition,
  type ToolAnnotations,
  type ToolResult,
} from "./tool-definitions.js";

export interface WebMcpTool {
  name: string;
  description: string;
  /** JSON Schema (draft-07) for the tool's input. */
  inputSchema: Record<string, unknown>;
  annotations: ToolAnnotations;
  execute: (input?: Record<string, unknown>) => Promise<ToolResult>;
}

/** The subset of `ModelContext` this module touches, in either API shape. */
export interface ModelContextLike {
  registerTool?: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => unknown;
  provideContext?: (context: { tools: WebMcpTool[] }) => unknown;
  clearContext?: () => unknown;
}

export interface JettyWebMcpOptions {
  /** Only these tool names (default: every tool). */
  include?: string[];
  /** Never these tool names. */
  exclude?: string[];
  /** Only tools whose annotations say readOnlyHint (list/get). */
  readOnly?: boolean;
  /** Prefix added to every tool name, e.g. "jetty_". Default: none. */
  namePrefix?: string;
}

/** JSON Schema for a definition's zod input shape. */
export function toolInputJsonSchema(tool: JettyToolDefinition): Record<string, unknown> {
  const schema = zodToJsonSchema(z.object(tool.inputSchema), {
    target: "jsonSchema7",
    $refStrategy: "none",
  }) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

/** One WebMCP tool descriptor for a definition, executing through `client`. */
export function toWebMcpTool(
  tool: JettyToolDefinition,
  client: JettyApiClient,
  namePrefix = ""
): WebMcpTool {
  const parser = z.object(tool.inputSchema);
  return {
    name: `${namePrefix}${tool.name}`,
    description: tool.description,
    inputSchema: toolInputJsonSchema(tool),
    annotations: tool.annotations,
    execute: async (input) => {
      try {
        const args = parser.parse(input ?? {});
        return jsonResult(await tool.handler(client, args));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
      }
    },
  };
}

/**
 * The catalog as WebMCP tool descriptors, filtered per `options`. Tools the
 * catalog marks `webmcp: false` (trial-key management) are never exposed,
 * even when `include` names them.
 */
export function jettyWebMcpTools(
  client: JettyApiClient,
  options: JettyWebMcpOptions = {}
): WebMcpTool[] {
  const include = options.include ? new Set(options.include) : null;
  const exclude = new Set(options.exclude ?? []);
  return JETTY_WEBMCP_TOOLS.filter(
    (tool) =>
      (!include || include.has(tool.name)) &&
      !exclude.has(tool.name) &&
      (!options.readOnly || tool.annotations.readOnlyHint)
  ).map((tool) => toWebMcpTool(tool, client, options.namePrefix));
}

/** `document.modelContext` first (current spec), then `navigator.modelContext`. */
export function findModelContext(
  globals: { document?: unknown; navigator?: unknown } = globalThis as {
    document?: unknown;
    navigator?: unknown;
  }
): ModelContextLike | null {
  for (const host of [globals.document, globals.navigator]) {
    const candidate = (host as { modelContext?: ModelContextLike } | undefined)?.modelContext;
    if (
      candidate &&
      (typeof candidate.registerTool === "function" ||
        typeof candidate.provideContext === "function")
    ) {
      return candidate;
    }
  }
  return null;
}

export interface RegisterJettyWebMcpResult {
  /** Which API shape was used, or null when the context offers neither. */
  via: "registerTool" | "provideContext" | null;
  /** Names of the tools registered. */
  tools: string[];
}

/**
 * Register the (filtered) catalog on `modelContext`. With `registerTool`,
 * `signal` unregisters the tools when aborted; with `provideContext`, abort
 * calls `clearContext()` when the context has one. A signal that is already
 * aborted registers nothing (`via: null`).
 */
export function registerJettyWebMcpTools(
  modelContext: ModelContextLike,
  client: JettyApiClient,
  options: JettyWebMcpOptions & { signal?: AbortSignal } = {}
): RegisterJettyWebMcpResult {
  // An AbortSignal never replays an earlier abort, so a signal that is
  // already aborted would register tools nothing ever unregisters.
  if (options.signal?.aborted) return { via: null, tools: [] };
  const tools = jettyWebMcpTools(client, options);
  const names = tools.map((tool) => tool.name);
  if (typeof modelContext.registerTool === "function") {
    for (const tool of tools) {
      modelContext.registerTool(tool, options.signal ? { signal: options.signal } : undefined);
    }
    return { via: "registerTool", tools: names };
  }
  if (typeof modelContext.provideContext === "function") {
    modelContext.provideContext({ tools });
    if (options.signal && typeof modelContext.clearContext === "function") {
      options.signal.addEventListener("abort", () => modelContext.clearContext?.(), { once: true });
    }
    return { via: "provideContext", tools: names };
  }
  return { via: null, tools: [] };
}
