/**
 * Node client for the stdio MCP server: the browser-safe core (api-client.ts)
 * plus token resolution from the environment and the file `jetty login`
 * writes. Not for the browser — it imports node:fs.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_API_URL,
  JettyApiClient,
  type JettyApiClientOptions,
} from "./api-client.js";

export { DEFAULT_API_URL, JettyApiClient } from "./api-client.js";
export type { JettyApiClientOptions, TokenSource } from "./api-client.js";

// The `jetty` CLI / Claude Code skill writes the collection-scoped `mlc_` key
// here on `jetty login`. We fall back to it so an already-logged-in user does
// not also have to plumb JETTY_API_TOKEN into the MCP server's env. Resolved
// lazily (not memoized at module load) so HOME changes are honoured.
function tokenFilePath(): string {
  return join(homedir(), ".config", "jetty", "token");
}

/**
 * Resolve the API token: prefer JETTY_API_TOKEN (trimmed, non-empty), then the
 * token file written by `jetty login`. The env var is checked for emptiness
 * because the plugin's .mcp.json may pass it through as "" — which must not
 * count as "set" and must not block the file fallback.
 */
export function resolveToken(): string | undefined {
  const fromEnv = process.env.JETTY_API_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  try {
    const fromFile = readFileSync(tokenFilePath(), "utf8").trim();
    if (fromFile) return fromFile;
  } catch {
    // file absent / unreadable — fall through to undefined
  }

  return undefined;
}

export class JettyClient extends JettyApiClient {
  constructor(options: JettyApiClientOptions = {}) {
    super({
      ...options,
      token: options.token ?? resolveToken(),
      apiUrl: options.apiUrl ?? (process.env.JETTY_API_URL || DEFAULT_API_URL),
      missingTokenMessage:
        options.missingTokenMessage ??
        "No Jetty token found. Set JETTY_API_TOKEN, or run `jetty login` " +
          `(writes ${tokenFilePath()}). ` +
          "Get a token at https://jetty.io → Settings → API Tokens",
    });
  }
}
