// The MCP server and the WebMCP adapter must expose one catalog: same names,
// same schemas, same result envelope. Also pins that the Node client still
// takes explicit options (spot's proxy relies on it).
//
// Imports from ../dist (build first; `npm test` runs the pretest build hook).

import { test } from "node:test";
import assert from "node:assert/strict";
import { JettyApiClient } from "../dist/api-client.js";
import { JettyClient } from "../dist/client.js";
import { JETTY_TOOLS, registerTools } from "../dist/tools.js";
import { jettyWebMcpTools } from "../dist/webmcp.js";

function mockFetch(body = {}) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init: init || {} });
    return {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      async json() {
        return body;
      },
      async text() {
        return JSON.stringify(body);
      },
    };
  };
  return { calls, restore: () => (globalThis.fetch = original) };
}

/** A stand-in McpServer that records registerTool calls. */
function fakeServer() {
  const registered = [];
  return {
    registered,
    registerTool(name, config, callback) {
      registered.push({ name, config, callback });
    },
  };
}

test("registerTools registers exactly the catalog, with title, description, schema and annotations", () => {
  const server = fakeServer();
  registerTools(server, new JettyApiClient({ token: "t" }));
  assert.deepEqual(server.registered.map((r) => r.name), JETTY_TOOLS.map((t) => t.name));
  for (const { config, callback } of server.registered) {
    assert.ok(config.title);
    assert.ok(config.description);
    assert.equal(typeof config.inputSchema, "object");
    assert.equal(typeof config.annotations.readOnlyHint, "boolean");
    assert.equal(typeof callback, "function");
  }
});

test("catalog names are unique kebab-case and read-only annotations mark exactly the list/get/check tools", () => {
  const names = JETTY_TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  for (const tool of JETTY_TOOLS) {
    assert.match(tool.name, /^[a-z]+(-[a-z]+)*$/);
    assert.equal(tool.annotations.readOnlyHint, /^(list|get|check)-/.test(tool.name), tool.name);
  }
  assert.equal(JETTY_TOOLS.find((t) => t.name === "delete-routine").annotations.destructiveHint, true);
});

test("an MCP callback and the WebMCP execute produce the same envelope for the same call", async () => {
  const { calls, restore } = mockFetch({ name: "acme", env_keys: ["OPENAI_API_KEY"] });
  try {
    const client = new JettyApiClient({ token: "t", apiUrl: "https://api.test" });
    const server = fakeServer();
    registerTools(server, client);
    const viaMcp = await server.registered
      .find((r) => r.name === "get-collection")
      .callback({ collection: "acme" });
    const viaWebMcp = await jettyWebMcpTools(client)
      .find((t) => t.name === "get-collection")
      .execute({ collection: "acme" });
    assert.deepEqual(viaMcp, viaWebMcp);
    assert.deepEqual(
      calls.map((c) => c.url),
      ["https://api.test/api/v1/collections/acme", "https://api.test/api/v1/collections/acme"]
    );
  } finally {
    restore();
  }
});

test("JettyClient takes explicit token and apiUrl over the environment", async () => {
  const saved = { token: process.env.JETTY_API_TOKEN, url: process.env.JETTY_API_URL };
  process.env.JETTY_API_TOKEN = "env-token";
  process.env.JETTY_API_URL = "https://env.example";
  const { calls, restore } = mockFetch({});
  try {
    const client = new JettyClient({ token: "explicit-token", apiUrl: "https://explicit.example/" });
    await client.listCollections();
    assert.equal(calls[0].url, "https://explicit.example/api/v1/collections/");
    assert.equal(calls[0].init.headers.Authorization, "Bearer explicit-token");
  } finally {
    restore();
    if (saved.token === undefined) delete process.env.JETTY_API_TOKEN;
    else process.env.JETTY_API_TOKEN = saved.token;
    if (saved.url === undefined) delete process.env.JETTY_API_URL;
    else process.env.JETTY_API_URL = saved.url;
  }
});
