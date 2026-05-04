const DEFAULT_API_URL = "https://flows-api.jetty.io";

export class JettyClient {
  private token: string | undefined;
  private apiUrl: string;

  constructor() {
    this.token = process.env.JETTY_API_TOKEN || undefined;
    this.apiUrl = process.env.JETTY_API_URL || DEFAULT_API_URL;
  }

  private requireToken(): string {
    if (!this.token) {
      throw new Error(
        "JETTY_API_TOKEN environment variable is required. " +
          "Get your token at https://jetty.io → Settings → API Tokens"
      );
    }
    return this.token;
  }

  private async request(
    path: string,
    options: RequestInit = {}
  ): Promise<unknown> {
    const url = `${this.apiUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.requireToken()}`,
      ...((options.headers as Record<string, string>) || {}),
    };

    const res = await fetch(url, { ...options, headers });

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

  // Run workflows
  async runWorkflow(
    collection: string,
    task: string,
    initParams?: Record<string, unknown>,
    useTrialKeys?: boolean
  ) {
    const formData = new FormData();
    formData.append("init_params", JSON.stringify(initParams || {}));
    if (useTrialKeys) {
      formData.append("use_trial_keys", "true");
    }

    return this.api(`/api/v1/run/${collection}/${task}`, {
      method: "POST",
      body: formData,
    });
  }

  async runWorkflowSync(
    collection: string,
    task: string,
    initParams?: Record<string, unknown>,
    useTrialKeys?: boolean
  ) {
    const formData = new FormData();
    formData.append("init_params", JSON.stringify(initParams || {}));
    if (useTrialKeys) {
      formData.append("use_trial_keys", "true");
    }

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
