/**
 * Jetty API client core. Browser-safe: no Node built-ins, no environment
 * reads. Credentials and the API origin come in through the constructor, so
 * the same class serves the stdio MCP server (see client.ts, which resolves
 * the token from JETTY_API_TOKEN / ~/.config/jetty/token) and WebMCP in a
 * page (see webmcp.ts, where a site passes a session token getter and a
 * same-origin proxy).
 */

export const DEFAULT_API_URL = "https://flows-api.jetty.io";

/** A bearer token, or a function that yields one per request. */
export type TokenSource =
  | string
  | (() => string | undefined | Promise<string | undefined>);

export interface JettyApiClientOptions {
  /** Bearer token, or a getter called on every request (e.g. a fresh session JWT). */
  token?: TokenSource;
  /** API origin. Defaults to https://flows-api.jetty.io. */
  apiUrl?: string;
  /** fetch implementation. Defaults to globalThis.fetch, resolved per request. */
  fetch?: typeof fetch;
  /**
   * Maps an API path (always `/api/v1/...`) to the URL to request. Defaults
   * to `${apiUrl}${path}`. Override it behind a same-origin proxy, e.g.
   * jetty.io rewrites `/api/mise/:path*` to `${mise}/api/v1/:path*`.
   */
  buildUrl?: (path: string, apiUrl: string) => string;
  /** Error message thrown when no token is available. */
  missingTokenMessage?: string;
}

const DEFAULT_MISSING_TOKEN =
  "No Jetty token available. Pass `token` (a string or a getter) to the client.";

export class JettyApiClient {
  protected readonly apiUrl: string;
  private readonly tokenSource: TokenSource | undefined;
  private readonly fetchImpl: typeof fetch | undefined;
  private readonly buildUrlImpl: (path: string, apiUrl: string) => string;
  private readonly missingTokenMessage: string;

  constructor(options: JettyApiClientOptions = {}) {
    this.tokenSource = options.token;
    this.apiUrl = (options.apiUrl || DEFAULT_API_URL).replace(/\/+$/, "");
    this.fetchImpl = options.fetch;
    this.buildUrlImpl = options.buildUrl ?? ((path, apiUrl) => `${apiUrl}${path}`);
    this.missingTokenMessage = options.missingTokenMessage ?? DEFAULT_MISSING_TOKEN;
  }

  protected async requireToken(): Promise<string> {
    const source = this.tokenSource;
    const token = typeof source === "function" ? await source() : source;
    if (!token) throw new Error(this.missingTokenMessage);
    return token;
  }

  private async request(
    path: string,
    options: RequestInit = {}
  ): Promise<unknown> {
    const url = this.buildUrlImpl(path, this.apiUrl);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${await this.requireToken()}`,
      ...((options.headers as Record<string, string>) || {}),
    };

    // Resolved per request so a test (or a page) may swap globalThis.fetch
    // after construction.
    const fetchImpl = this.fetchImpl ?? globalThis.fetch;
    const res = await fetchImpl(url, { ...options, headers });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Jetty API error ${res.status}: ${body}`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return res.json();
    }
    return res.text();
  }

  private api(path: string, options?: RequestInit) {
    return this.request(path, options);
  }

  // Collections
  async listCollections() {
    return this.api("/api/v1/collections/");
  }

  async getCollection(collection: string) {
    return this.api(`/api/v1/collections/${collection}`);
  }

  // Tasks
  async listTasks(collection: string) {
    return this.api(`/api/v1/tasks/${collection}/`);
  }

  async getTask(collection: string, task: string) {
    return this.api(`/api/v1/tasks/${collection}/${task}`);
  }

  async createTask(
    collection: string,
    name: string,
    workflow: unknown,
    description?: string
  ) {
    return this.api(`/api/v1/tasks/${collection}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: description || "", workflow }),
    });
  }

  async updateTask(
    collection: string,
    task: string,
    updates: { workflow?: unknown; description?: string }
  ) {
    return this.api(`/api/v1/tasks/${collection}/${task}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  }

  async deleteTask(collection: string, task: string) {
    return this.api(`/api/v1/tasks/${collection}/${task}`, {
      method: "DELETE",
    });
  }

  // Trial keys
  async getTrialStatus(collection: string) {
    return this.api(`/api/v1/trial/${collection}`);
  }

  async activateTrial(collection: string) {
    return this.api(`/api/v1/trial/${collection}/activate`, {
      method: "POST",
    });
  }

  // Collection environment
  async getCollectionEnvironment(collection: string) {
    return this.api(`/api/v1/collections/${collection}/environment`);
  }

  // Run workflows. Trial keys are injected automatically server-side when
  // the collection is eligible — there is no flag to send.
  async runWorkflow(
    collection: string,
    task: string,
    initParams?: Record<string, unknown>
  ) {
    const formData = new FormData();
    formData.append("init_params", JSON.stringify(initParams || {}));

    return this.api(`/api/v1/run/${collection}/${task}`, {
      method: "POST",
      body: formData,
    });
  }

  async runWorkflowSync(
    collection: string,
    task: string,
    initParams?: Record<string, unknown>
  ) {
    const formData = new FormData();
    formData.append("init_params", JSON.stringify(initParams || {}));

    return this.api(`/api/v1/run-sync/${collection}/${task}`, {
      method: "POST",
      body: formData,
    });
  }

  // Trajectories
  async listTrajectories(
    collection: string,
    task: string,
    limit = 10,
    page = 1
  ) {
    return this.api(
      `/api/v1/db/trajectories/${collection}/${task}?limit=${limit}&page=${page}`
    );
  }

  async getTrajectory(
    collection: string,
    task: string,
    trajectoryId: string
  ) {
    return this.api(
      `/api/v1/db/trajectory/${collection}/${task}/${trajectoryId}`
    );
  }

  // Stats
  async getStats(collection: string, task: string) {
    return this.api(`/api/v1/db/stats/${collection}/${task}`);
  }

  // Labels
  async addLabel(
    collection: string,
    task: string,
    trajectoryId: string,
    key: string,
    value: string,
    author: string
  ) {
    return this.api(
      `/api/v1/trajectory/${collection}/${task}/${trajectoryId}/labels`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value, author }),
      }
    );
  }

  // Workflow logs
  async getWorkflowLogs(workflowId: string) {
    return this.api(`/api/v1/workflows-logs/${workflowId}`);
  }

  // Step templates
  async listStepTemplates() {
    return this.request("/api/v1/step-templates");
  }

  async getStepTemplate(name: string) {
    return this.request(`/api/v1/step-templates/${name}`);
  }

  // Environment variables
  async setEnvironmentVars(
    collection: string,
    vars: Record<string, string>
  ) {
    return this.api(`/api/v1/collections/${collection}/environment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ environment_variables: vars }),
    });
  }

  // Routines (scheduled runs)
  async listRoutines(collection: string, task?: string) {
    const path = task
      ? `/api/v1/routines/${collection}/${task}`
      : `/api/v1/routines/${collection}`;
    return this.api(path);
  }

  async getRoutine(collection: string, task: string, name: string) {
    return this.api(`/api/v1/routines/${collection}/${task}/${name}`);
  }

  async createRoutine(
    collection: string,
    task: string,
    body: Record<string, unknown>
  ) {
    return this.api(`/api/v1/routines/${collection}/${task}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async updateRoutine(
    collection: string,
    task: string,
    name: string,
    patch: Record<string, unknown>
  ) {
    return this.api(`/api/v1/routines/${collection}/${task}/${name}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async deleteRoutine(collection: string, task: string, name: string) {
    return this.api(`/api/v1/routines/${collection}/${task}/${name}`, {
      method: "DELETE",
    });
  }

  async pauseRoutine(collection: string, task: string, name: string) {
    return this.api(
      `/api/v1/routines/${collection}/${task}/${name}/pause`,
      { method: "POST" }
    );
  }

  async resumeRoutine(collection: string, task: string, name: string) {
    return this.api(
      `/api/v1/routines/${collection}/${task}/${name}/resume`,
      { method: "POST" }
    );
  }

  async runRoutineNow(collection: string, task: string, name: string) {
    return this.api(
      `/api/v1/routines/${collection}/${task}/${name}/run-now`,
      { method: "POST" }
    );
  }

  async listRoutineRuns(
    collection: string,
    task: string,
    name: string,
    limit?: number
  ) {
    const qs = typeof limit === "number" ? `?limit=${limit}` : "";
    return this.api(
      `/api/v1/routines/${collection}/${task}/${name}/runs${qs}`
    );
  }
}
