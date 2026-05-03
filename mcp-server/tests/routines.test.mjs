// Smoke tests for routine client methods.
// Mocks global fetch and asserts each method hits the expected URL,
// HTTP method, body, and Authorization: Bearer header.
//
// Imports from ../dist (so the project must be built before running).
// Use `npm test` which runs `npm run build` via the `pretest` hook.

import { test } from "node:test";
import assert from "node:assert/strict";
import { JettyClient } from "../dist/client.js";

const TOKEN = "test-token-xyz";
const API_URL = "https://flows-api.test.jetty.io";

function setEnv() {
  process.env.JETTY_API_TOKEN = TOKEN;
  process.env.JETTY_API_URL = API_URL;
}

/**
 * Install a fetch mock that records call args and returns a JSON body.
 * Returns { calls, restore } — calls is an array of { url, init }.
 */
function mockFetch(responseBody = {}) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init: init || {} });
    return {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      async json() {
        return responseBody;
      },
      async text() {
        return JSON.stringify(responseBody);
      },
    };
  };
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function authHeader(init) {
  const h = init.headers || {};
  // headers may be a plain object (current implementation passes a Record)
  return h.Authorization || h.authorization;
}

function bodyJson(init) {
  if (!init.body) return undefined;
  return JSON.parse(init.body);
}

test("listRoutines without task hits collection-wide endpoint", async () => {
  setEnv();
  const { calls, restore } = mockFetch({ routines: [] });
  try {
    const c = new JettyClient();
    await c.listRoutines("my-coll");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${API_URL}/api/v1/routines/my-coll`);
    assert.equal(authHeader(calls[0].init), `Bearer ${TOKEN}`);
  } finally {
    restore();
  }
});

test("listRoutines with task hits task-scoped endpoint", async () => {
  setEnv();
  const { calls, restore } = mockFetch({ routines: [] });
  try {
    const c = new JettyClient();
    await c.listRoutines("my-coll", "my-task");
    assert.equal(calls[0].url, `${API_URL}/api/v1/routines/my-coll/my-task`);
    assert.equal(authHeader(calls[0].init), `Bearer ${TOKEN}`);
  } finally {
    restore();
  }
});

test("getRoutine hits the named routine endpoint", async () => {
  setEnv();
  const { calls, restore } = mockFetch({ id: 1 });
  try {
    const c = new JettyClient();
    await c.getRoutine("c", "t", "r");
    assert.equal(calls[0].url, `${API_URL}/api/v1/routines/c/t/r`);
    assert.equal(calls[0].init.method, undefined); // GET (default)
    assert.equal(authHeader(calls[0].init), `Bearer ${TOKEN}`);
  } finally {
    restore();
  }
});

test("createRoutine POSTs JSON body to task endpoint", async () => {
  setEnv();
  const { calls, restore } = mockFetch({ id: 42 });
  try {
    const c = new JettyClient();
    const body = {
      name: "daily-summary",
      cadence: { type: "daily", hour_utc: 9, minute_utc: 0 },
      init_params_overrides: { prompt: "summarize" },
    };
    await c.createRoutine("c", "t", body);
    assert.equal(calls[0].url, `${API_URL}/api/v1/routines/c/t`);
    assert.equal(calls[0].init.method, "POST");
    assert.equal(authHeader(calls[0].init), `Bearer ${TOKEN}`);
    assert.equal(calls[0].init.headers["Content-Type"], "application/json");
    assert.deepEqual(bodyJson(calls[0].init), body);
  } finally {
    restore();
  }
});

test("updateRoutine PATCHes the named routine endpoint", async () => {
  setEnv();
  const { calls, restore } = mockFetch({ id: 42 });
  try {
    const c = new JettyClient();
    const patch = { paused: true };
    await c.updateRoutine("c", "t", "r", patch);
    assert.equal(calls[0].url, `${API_URL}/api/v1/routines/c/t/r`);
    assert.equal(calls[0].init.method, "PATCH");
    assert.equal(authHeader(calls[0].init), `Bearer ${TOKEN}`);
    assert.deepEqual(bodyJson(calls[0].init), patch);
  } finally {
    restore();
  }
});

test("deleteRoutine DELETEs the named routine endpoint", async () => {
  setEnv();
  const { calls, restore } = mockFetch({ ok: true });
  try {
    const c = new JettyClient();
    await c.deleteRoutine("c", "t", "r");
    assert.equal(calls[0].url, `${API_URL}/api/v1/routines/c/t/r`);
    assert.equal(calls[0].init.method, "DELETE");
    assert.equal(authHeader(calls[0].init), `Bearer ${TOKEN}`);
  } finally {
    restore();
  }
});

test("pauseRoutine POSTs to /pause", async () => {
  setEnv();
  const { calls, restore } = mockFetch({ ok: true });
  try {
    const c = new JettyClient();
    await c.pauseRoutine("c", "t", "r");
    assert.equal(calls[0].url, `${API_URL}/api/v1/routines/c/t/r/pause`);
    assert.equal(calls[0].init.method, "POST");
    assert.equal(authHeader(calls[0].init), `Bearer ${TOKEN}`);
  } finally {
    restore();
  }
});

test("resumeRoutine POSTs to /resume", async () => {
  setEnv();
  const { calls, restore } = mockFetch({ ok: true });
  try {
    const c = new JettyClient();
    await c.resumeRoutine("c", "t", "r");
    assert.equal(calls[0].url, `${API_URL}/api/v1/routines/c/t/r/resume`);
    assert.equal(calls[0].init.method, "POST");
    assert.equal(authHeader(calls[0].init), `Bearer ${TOKEN}`);
  } finally {
    restore();
  }
});

test("runRoutineNow POSTs to /run-now", async () => {
  setEnv();
  const { calls, restore } = mockFetch({ workflow_id: "wf-123" });
  try {
    const c = new JettyClient();
    const res = await c.runRoutineNow("c", "t", "r");
    assert.equal(calls[0].url, `${API_URL}/api/v1/routines/c/t/r/run-now`);
    assert.equal(calls[0].init.method, "POST");
    assert.equal(authHeader(calls[0].init), `Bearer ${TOKEN}`);
    assert.equal(res.workflow_id, "wf-123");
  } finally {
    restore();
  }
});

test("listRoutineRuns hits /runs and includes ?limit when provided", async () => {
  setEnv();
  const { calls, restore } = mockFetch({ trajectories: [] });
  try {
    const c = new JettyClient();
    await c.listRoutineRuns("c", "t", "r");
    assert.equal(calls[0].url, `${API_URL}/api/v1/routines/c/t/r/runs`);
    assert.equal(authHeader(calls[0].init), `Bearer ${TOKEN}`);

    await c.listRoutineRuns("c", "t", "r", 25);
    assert.equal(
      calls[1].url,
      `${API_URL}/api/v1/routines/c/t/r/runs?limit=25`
    );
  } finally {
    restore();
  }
});

test("missing JETTY_API_TOKEN raises a helpful error", async () => {
  delete process.env.JETTY_API_TOKEN;
  process.env.JETTY_API_URL = API_URL;
  const c = new JettyClient();
  await assert.rejects(
    () => c.listRoutines("c"),
    /JETTY_API_TOKEN environment variable is required/
  );
});
