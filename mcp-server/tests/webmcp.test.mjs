// WebMCP adapter tests: the tool catalog exposed through a page's
// `modelContext`, executed with a browser-side JettyApiClient.
//
// Imports from ../dist (build first; `npm test` runs the pretest build hook).

import { test } from "node:test";
import assert from "node:assert/strict";
import { JettyApiClient } from "../dist/api-client.js";
import { JETTY_TOOLS } from "../dist/tool-definitions.js";
import {
  findModelContext,
  jettyWebMcpTools,
  registerJettyWebMcpTools,
} from "../dist/webmcp.js";

/** Record fetch calls and answer with a JSON body (or a failure). */
function mockFetch({ body = {}, ok = true, status = 200 } = {}) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init: init || {} });
    return {
      ok,
      status,
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

const client = () => new JettyApiClient({ token: "static-token" });

test("every catalog tool becomes a WebMCP descriptor with a JSON-Schema input", () => {
  const tools = jettyWebMcpTools(client());
  assert.equal(tools.length, JETTY_TOOLS.length);
  for (const tool of tools) {
    assert.equal(tool.inputSchema.type, "object");
    assert.equal(typeof tool.execute, "function");
    assert.equal(typeof tool.annotations.readOnlyHint, "boolean");
    assert.equal("$schema" in tool.inputSchema, false);
  }
  const listRuns = tools.find((t) => t.name === "list-trajectories");
  assert.deepEqual(listRuns.inputSchema.required, ["collection", "task"]);
  assert.equal(listRuns.inputSchema.properties.limit.type, "number");
  assert.equal(listRuns.inputSchema.properties.limit.default, 10);
  assert.equal(listRuns.inputSchema.properties.collection.description, "Collection name");
});

test("execute validates input, applies defaults, and calls the API through the token getter and buildUrl", async () => {
  const { calls, restore } = mockFetch({ body: { items: [1] } });
  try {
    const proxied = new JettyApiClient({
      token: async () => "session-jwt",
      apiUrl: "https://ignored.example",
      // jetty.io's rewrite: /api/mise/:path* → ${mise}/api/v1/:path*
      buildUrl: (path) => `/api/mise${path.replace(/^\/api\/v1/, "")}`,
    });
    const tool = jettyWebMcpTools(proxied).find((t) => t.name === "list-trajectories");
    const result = await tool.execute({ collection: "acme", task: "nightly" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/api/mise/db/trajectories/acme/nightly?limit=10&page=1");
    assert.equal(calls[0].init.headers.Authorization, "Bearer session-jwt");
    assert.deepEqual(JSON.parse(result.content[0].text), { items: [1] });
    assert.equal(result.isError, undefined);
  } finally {
    restore();
  }
});

test("execute reports invalid input as an error result without calling the API", async () => {
  const { calls, restore } = mockFetch();
  try {
    const tool = jettyWebMcpTools(client()).find((t) => t.name === "get-task");
    const result = await tool.execute({ collection: "acme" }); // task missing
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /^Error: /);
    assert.equal(calls.length, 0);
  } finally {
    restore();
  }
});

test("execute reports an API failure as an error result carrying the status", async () => {
  const { restore } = mockFetch({ body: { detail: "nope" }, ok: false, status: 403 });
  try {
    const tool = jettyWebMcpTools(client()).find((t) => t.name === "list-collections");
    const result = await tool.execute();
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /403/);
  } finally {
    restore();
  }
});

test("include, exclude, readOnly and namePrefix shape the exposed set", () => {
  assert.deepEqual(
    jettyWebMcpTools(client(), { include: ["get-task", "list-tasks"] }).map((t) => t.name),
    ["list-tasks", "get-task"] // catalog order, not include order
  );
  const readOnly = jettyWebMcpTools(client(), { readOnly: true });
  assert.ok(readOnly.length > 0);
  assert.ok(readOnly.every((t) => t.annotations.readOnlyHint));
  assert.ok(!readOnly.some((t) => t.name === "run-workflow"));
  assert.ok(readOnly.some((t) => t.name === "list-collections"));
  assert.ok(!jettyWebMcpTools(client(), { exclude: ["delete-routine"] }).some((t) => t.name === "delete-routine"));
  assert.equal(jettyWebMcpTools(client(), { namePrefix: "jetty_" })[0].name, "jetty_list-collections");
});

test("registerJettyWebMcpTools uses registerTool(tool, { signal }) once per tool", () => {
  const registered = [];
  const modelContext = {
    registerTool: (tool, options) => registered.push([tool.name, options?.signal]),
    provideContext: () => {
      throw new Error("provideContext must not be used when registerTool exists");
    },
  };
  const controller = new AbortController();
  const result = registerJettyWebMcpTools(modelContext, client(), {
    signal: controller.signal,
    readOnly: true,
  });
  assert.equal(result.via, "registerTool");
  assert.deepEqual(registered.map(([name]) => name), result.tools);
  assert.ok(registered.every(([, signal]) => signal === controller.signal));
});

test("registerJettyWebMcpTools falls back to provideContext and clears it on abort", () => {
  let provided = null;
  let cleared = 0;
  const modelContext = {
    provideContext: (context) => (provided = context),
    clearContext: () => (cleared += 1),
  };
  const controller = new AbortController();
  const result = registerJettyWebMcpTools(modelContext, client(), { signal: controller.signal });
  assert.equal(result.via, "provideContext");
  assert.equal(provided.tools.length, JETTY_TOOLS.length);
  controller.abort();
  assert.equal(cleared, 1);
});

test("registerJettyWebMcpTools reports null when the context offers neither shape", () => {
  assert.deepEqual(registerJettyWebMcpTools({}, client()), { via: null, tools: [] });
});

test("findModelContext prefers document.modelContext, then navigator.modelContext", () => {
  const onDocument = { registerTool() {} };
  const onNavigator = { provideContext() {} };
  assert.equal(
    findModelContext({ document: { modelContext: onDocument }, navigator: { modelContext: onNavigator } }),
    onDocument
  );
  assert.equal(findModelContext({ navigator: { modelContext: onNavigator } }), onNavigator);
  assert.equal(findModelContext({ navigator: { modelContext: {} } }), null);
  assert.equal(findModelContext({}), null);
});
