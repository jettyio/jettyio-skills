// Auth/token-resolution tests for JettyClient.
//
// Regression for the "MCP can't authenticate" bug: the plugin's .mcp.json used
// to pass JETTY_API_TOKEN="" (empty), which both supplied no token AND shadowed
// any inherited one. The server now (a) treats empty/whitespace env as unset and
// (b) falls back to ~/.config/jetty/token written by `jetty login`.
//
// Imports from ../dist (build first; `npm test` runs the pretest build hook).

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JettyClient } from "../dist/client.js";

// Snapshot env we mutate so tests don't leak into each other.
function withEnv(overrides, fn) {
  const saved = {};
  for (const k of ["JETTY_API_TOKEN", "JETTY_API_URL", "HOME"]) {
    saved[k] = process.env[k];
    if (overrides[k] === undefined) delete process.env[k];
    else process.env[k] = overrides[k];
  }
  try {
    return fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

// Build a fake HOME containing ~/.config/jetty/token (or not, if token === null).
function fakeHome(token) {
  const home = mkdtempSync(join(tmpdir(), "jetty-auth-test-"));
  if (token !== null) {
    mkdirSync(join(home, ".config", "jetty"), { recursive: true });
    writeFileSync(join(home, ".config", "jetty", "token"), token);
  }
  return home;
}

// requireToken() is private; exercise it through a no-network request and assert
// on the thrown message (or the lack of an auth-shaped one).
async function tokenError(client) {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("__network_reached__");
  };
  try {
    await client.listCollections();
    return null;
  } catch (e) {
    return e.message;
  } finally {
    globalThis.fetch = orig;
  }
}

test("empty JETTY_API_TOKEN falls back to the token file", async () => {
  const home = fakeHome("mlc_filetoken");
  try {
    await withEnv({ JETTY_API_TOKEN: "", HOME: home }, async () => {
      const client = new JettyClient();
      // Token file present → no auth error; the only failure is the mocked network.
      const msg = await tokenError(client);
      assert.equal(msg, "__network_reached__");
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("whitespace-only JETTY_API_TOKEN does not count as set", async () => {
  const home = fakeHome("mlc_filetoken");
  try {
    await withEnv({ JETTY_API_TOKEN: "   ", HOME: home }, async () => {
      const client = new JettyClient();
      assert.equal(await tokenError(client), "__network_reached__");
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("env token takes precedence over the file", async () => {
  const home = fakeHome("mlc_filetoken");
  try {
    await withEnv({ JETTY_API_TOKEN: "mlc_envtoken", HOME: home }, async () => {
      const calls = [];
      const orig = globalThis.fetch;
      globalThis.fetch = async (url, init) => {
        calls.push(init?.headers?.Authorization);
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({}),
          text: async () => "{}",
        };
      };
      try {
        const client = new JettyClient();
        await client.listCollections();
        assert.equal(calls[0], "Bearer mlc_envtoken");
      } finally {
        globalThis.fetch = orig;
      }
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("no env and no file yields a helpful error mentioning jetty login", async () => {
  const home = fakeHome(null); // no token file
  try {
    await withEnv({ JETTY_API_TOKEN: undefined, HOME: home }, async () => {
      const client = new JettyClient();
      const msg = await tokenError(client);
      assert.match(msg, /jetty login/);
      assert.notEqual(msg, "__network_reached__"); // failed before any fetch
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
