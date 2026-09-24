/**
 * The Jetty tool catalog, declared once as data. Both surfaces consume it:
 *
 *   - tools.ts registers every definition on an MCP server (stdio, npx).
 *   - webmcp.ts registers the same definitions on a page's
 *     `navigator.modelContext` (WebMCP), deriving JSON Schema from the zod
 *     shape and executing through a browser-side JettyApiClient.
 *
 * Browser-safe: imports zod and the client type only.
 */
import { z, type ZodRawShape, type ZodTypeAny } from "zod";
import type { JettyApiClient } from "./api-client.js";

/** MCP tool annotations (a subset of the spec's ToolAnnotations). */
export interface ToolAnnotations {
  readOnlyHint: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface JettyToolDefinition<Shape extends ZodRawShape = ZodRawShape> {
  name: string;
  title: string;
  description: string;
  /** zod raw shape — the MCP SDK's native input form. */
  inputSchema: Shape;
  annotations: ToolAnnotations;
  /**
   * Whether the WebMCP adapter may expose the tool. Defaults to true; the
   * MCP server registers every tool regardless. Set false for account-level
   * actions a page should not hand to an in-browser agent.
   */
  webmcp?: boolean;
  handler: (
    client: JettyApiClient,
    args: z.objectOutputType<Shape, ZodTypeAny>
  ) => Promise<unknown>;
}

/** The MCP/WebMCP result envelope both surfaces return. */
export interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export function jsonResult(data: unknown): ToolResult {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

const READ: ToolAnnotations = { readOnlyHint: true, idempotentHint: true };
const WRITE: ToolAnnotations = { readOnlyHint: false, destructiveHint: false };
const DESTRUCTIVE: ToolAnnotations = { readOnlyHint: false, destructiveHint: true };

function define<Shape extends ZodRawShape>(
  def: JettyToolDefinition<Shape>
): JettyToolDefinition {
  return def as unknown as JettyToolDefinition;
}

const collection = () => z.string().describe("Collection name");
const task = () => z.string().describe("Task name");
const routineName = () => z.string().describe("Routine name");

const INIT_PARAMS_MERGE =
  "Input parameters for the workflow, merged shallowly over the task's stored init_params (caller wins per top-level key). A nested object such as vars replaces the task's whole vars, so include every variable, not just the changed ones.";
const WEBHOOK_URL_DESC =
  "Optional URL POSTed the full trajectory JSON when each run completes or fails (best effort, up to 3 attempts).";
const WEBHOOK_SECRET_DESC =
  "Optional. When set, deliveries carry X-Mise-Signature = hex HMAC-SHA256(secret, '{timestamp}.{body}'); without it they are sent unsigned (no signature header).";

const cadenceSchema = z
  .object({
    type: z
      .enum(["manual", "hourly", "daily", "weekdays", "weekly"])
      .describe(
        "Cadence type. 'manual' creates a saved invocation preset (no schedule); the others register a Temporal schedule."
      ),
    hour_utc: z
      .number()
      .int()
      .min(0)
      .max(23)
      .optional()
      .describe("Hour of day in UTC (0-23). Required for daily/weekdays/weekly."),
    minute_utc: z
      .number()
      .int()
      .min(0)
      .max(59)
      .optional()
      .describe("Minute of the hour in UTC (0-59). Defaults to 0."),
    day_of_week: z
      .enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])
      .optional()
      .describe("Day of week. Required for weekly cadence."),
  })
  .describe(
    "Cadence config. Examples: {type:'hourly', minute_utc:15}, {type:'daily', hour_utc:9}, {type:'weekly', day_of_week:'mon', hour_utc:9}."
  );

export const JETTY_TOOLS: readonly JettyToolDefinition[] = [
  // ── Collections ──────────────────────────────────────────────
  define({
    name: "list-collections",
    title: "List collections",
    description: "List all collections",
    inputSchema: {},
    annotations: READ,
    handler: (client) => client.listCollections(),
  }),
  define({
    name: "get-collection",
    title: "Get collection",
    description: "Get collection details including environment variable keys",
    inputSchema: { collection: collection() },
    annotations: READ,
    handler: (client, { collection }) => client.getCollection(collection),
  }),

  // ── Tasks ────────────────────────────────────────────────────
  define({
    name: "list-tasks",
    title: "List tasks",
    description: "List tasks in a collection",
    inputSchema: { collection: collection() },
    annotations: READ,
    handler: (client, { collection }) => client.listTasks(collection),
  }),
  define({
    name: "get-task",
    title: "Get task",
    description: "Get task details including workflow definition",
    inputSchema: { collection: collection(), task: task() },
    annotations: READ,
    handler: (client, { collection, task }) => client.getTask(collection, task),
  }),
  define({
    name: "create-task",
    title: "Create task",
    description: "Create a new task with a workflow definition",
    inputSchema: {
      collection: collection(),
      name: z.string().describe("Task name"),
      description: z.string().optional().describe("Task description"),
      workflow: z
        .record(z.unknown())
        .describe("Workflow JSON with init_params, step_configs, and steps"),
    },
    annotations: WRITE,
    handler: (client, { collection, name, description, workflow }) =>
      client.createTask(collection, name, workflow, description),
  }),
  define({
    name: "update-task",
    title: "Update task",
    description: "Update a task's workflow or description",
    inputSchema: {
      collection: collection(),
      task: task(),
      workflow: z.record(z.unknown()).optional().describe("Updated workflow JSON"),
      description: z.string().optional().describe("Updated description"),
    },
    annotations: WRITE,
    handler: (client, { collection, task, workflow, description }) => {
      const updates: { workflow?: unknown; description?: string } = {};
      if (workflow) updates.workflow = workflow;
      if (description) updates.description = description;
      return client.updateTask(collection, task, updates);
    },
  }),

  // ── Trial keys ───────────────────────────────────────────────
  // MCP only: trial keys are an account-level concern for the local agent
  // that set the workspace up, not something a page hands to a browser agent.
  define({
    name: "get-trial-status",
    title: "Get trial status",
    description: "Get trial key status for a collection",
    inputSchema: { collection: collection() },
    annotations: READ,
    webmcp: false,
    handler: (client, { collection }) => client.getTrialStatus(collection),
  }),
  define({
    name: "activate-trial",
    title: "Activate trial",
    description: "Activate trial keys for a collection",
    inputSchema: { collection: collection() },
    annotations: WRITE,
    webmcp: false,
    handler: (client, { collection }) => client.activateTrial(collection),
  }),

  // ── Run workflows ────────────────────────────────────────────
  define({
    name: "run-workflow",
    title: "Run workflow",
    description:
      "Run a workflow asynchronously (returns immediately with workflow_id). Trial keys are applied automatically server-side when the collection is eligible.",
    inputSchema: {
      collection: collection(),
      task: task(),
      init_params: z
        .record(z.unknown())
        .optional()
        .describe(INIT_PARAMS_MERGE),
    },
    annotations: WRITE,
    handler: (client, { collection, task, init_params }) =>
      client.runWorkflow(collection, task, init_params as Record<string, unknown>),
  }),
  define({
    name: "run-workflow-sync",
    title: "Run workflow (sync)",
    description:
      "Run a workflow synchronously (blocks until completion, may take 30-60s). Trial keys are applied automatically server-side when the collection is eligible.",
    inputSchema: {
      collection: collection(),
      task: task(),
      init_params: z
        .record(z.unknown())
        .optional()
        .describe(INIT_PARAMS_MERGE),
    },
    annotations: WRITE,
    handler: (client, { collection, task, init_params }) =>
      client.runWorkflowSync(collection, task, init_params as Record<string, unknown>),
  }),

  // ── Trajectories ─────────────────────────────────────────────
  define({
    name: "list-trajectories",
    title: "List runs",
    description: "List recent workflow runs (trajectories) for a task",
    inputSchema: {
      collection: collection(),
      task: task(),
      limit: z.number().optional().default(10).describe("Max results"),
      page: z.number().optional().default(1).describe("Page number"),
    },
    annotations: READ,
    handler: (client, { collection, task, limit, page }) =>
      client.listTrajectories(collection, task, limit, page),
  }),
  define({
    name: "get-trajectory",
    title: "Get run",
    description: "Get full details of a specific workflow run",
    inputSchema: {
      collection: collection(),
      task: task(),
      trajectory_id: z.string().describe("Trajectory ID"),
    },
    annotations: READ,
    handler: (client, { collection, task, trajectory_id }) =>
      client.getTrajectory(collection, task, trajectory_id),
  }),

  // ── Stats ────────────────────────────────────────────────────
  define({
    name: "get-stats",
    title: "Get stats",
    description: "Get execution statistics for a task",
    inputSchema: { collection: collection(), task: task() },
    annotations: READ,
    handler: (client, { collection, task }) => client.getStats(collection, task),
  }),

  // ── Labels ───────────────────────────────────────────────────
  define({
    name: "add-label",
    title: "Add label",
    description: "Add a label to a trajectory (e.g., quality=high)",
    inputSchema: {
      collection: collection(),
      task: task(),
      trajectory_id: z.string().describe("Trajectory ID"),
      key: z.string().describe("Label key (e.g., 'quality', 'status')"),
      value: z.string().describe("Label value (e.g., 'high', 'approved')"),
      author: z.string().describe("Author email"),
    },
    annotations: WRITE,
    handler: (client, { collection, task, trajectory_id, key, value, author }) =>
      client.addLabel(collection, task, trajectory_id, key, value, author),
  }),

  // ── Step templates ───────────────────────────────────────────
  define({
    name: "list-step-templates",
    title: "List step templates",
    description: "List all available workflow step templates",
    inputSchema: {},
    annotations: READ,
    handler: (client) => client.listStepTemplates(),
  }),
  define({
    name: "get-step-template",
    title: "Get step template",
    description: "Get details and schema for a step template",
    inputSchema: { name: z.string().describe("Step template activity name") },
    annotations: READ,
    handler: (client, { name }) => client.getStepTemplate(name),
  }),

  // ── Environment variables ────────────────────────────────────
  define({
    name: "check-secrets",
    title: "Check secrets",
    description:
      "Check which environment variables a collection has configured vs. what a runbook needs",
    inputSchema: {
      collection: collection(),
      required_keys: z
        .array(z.string())
        .describe("Environment variable names the runbook requires"),
    },
    annotations: READ,
    handler: async (client, { collection, required_keys }) => {
      const col = (await client.getCollectionEnvironment(collection)) as Record<string, unknown>;
      const envVars = (col.environment_variables || {}) as Record<string, unknown>;
      const configured = Object.keys(envVars);
      const missing = required_keys.filter((k) => !configured.includes(k));
      return { configured, missing, ready: missing.length === 0 };
    },
  }),
  define({
    name: "set-environment-vars",
    title: "Set environment variables",
    description:
      "Set environment variables on a collection (merge semantics, pass null to delete a key)",
    inputSchema: {
      collection: collection(),
      variables: z
        .record(z.string().nullable())
        .describe("Key-value pairs to set (null to delete)"),
    },
    annotations: WRITE,
    handler: (client, { collection, variables }) =>
      client.setEnvironmentVars(collection, variables as Record<string, string>),
  }),

  // ── Routines (scheduled runs) ────────────────────────────────
  define({
    name: "list-routines",
    title: "List routines",
    description: "List scheduled routines for a collection (optionally scoped to a task)",
    inputSchema: {
      collection: collection(),
      task: z
        .string()
        .optional()
        .describe("Task name (omit to list all routines in the collection)"),
    },
    annotations: READ,
    handler: (client, { collection, task }) => client.listRoutines(collection, task),
  }),
  define({
    name: "get-routine",
    title: "Get routine",
    description: "Get a single routine including resolved next_run_at from Temporal",
    inputSchema: {
      collection: collection(),
      task: task(),
      name: z.string().describe("Routine name (unique per collection+task)"),
    },
    annotations: READ,
    handler: (client, { collection, task, name }) => client.getRoutine(collection, task, name),
  }),
  define({
    name: "create-routine",
    title: "Create routine",
    description:
      "Create a scheduled routine for an existing task. init_params_overrides keys must be a subset of task.workflow.init_params.",
    inputSchema: {
      collection: collection(),
      task: task(),
      name: z.string().describe("Routine name (slug, unique per task)"),
      cadence: cadenceSchema,
      init_params_overrides: z
        .record(z.unknown())
        .optional()
        .describe(
          "Init param overrides. Keys must be a subset of task.workflow.init_params; unknown keys return 400. Merged shallowly per top-level key: overriding vars replaces the task's whole vars object, so include every variable."
        ),
      secret_params: z
        .record(z.unknown())
        .optional()
        .describe("Secrets injected at fire time (encrypted at rest, never logged)."),
      paused: z.boolean().optional().describe("Create the routine in paused state"),
      webhook_url: z.string().optional().describe(WEBHOOK_URL_DESC),
      webhook_secret: z.string().optional().describe(WEBHOOK_SECRET_DESC),
    },
    annotations: WRITE,
    handler: (
      client,
      { collection, task, name, cadence, init_params_overrides, secret_params, paused, webhook_url, webhook_secret }
    ) => {
      const body: Record<string, unknown> = { name, cadence };
      if (init_params_overrides !== undefined) body.init_params_overrides = init_params_overrides;
      if (secret_params !== undefined) body.secret_params = secret_params;
      if (paused !== undefined) body.paused = paused;
      if (webhook_url !== undefined) body.webhook_url = webhook_url;
      if (webhook_secret !== undefined) body.webhook_secret = webhook_secret;
      return client.createRoutine(collection, task, body);
    },
  }),
  define({
    name: "update-routine",
    title: "Update routine",
    description:
      "Patch a routine — provide any subset of cadence/overrides/secrets/paused/webhook fields",
    inputSchema: {
      collection: collection(),
      task: task(),
      name: routineName(),
      cadence: cadenceSchema.optional(),
      init_params_overrides: z
        .record(z.unknown())
        .optional()
        .describe(
          "Replace init param overrides (the whole object; merged shallowly over the task's init_params at fire time)"
        ),
      secret_params: z.record(z.unknown()).optional().describe("Replace secret params"),
      paused: z.boolean().optional().describe("Pause/resume the routine"),
      webhook_url: z.string().optional().describe(WEBHOOK_URL_DESC),
      webhook_secret: z.string().optional().describe(WEBHOOK_SECRET_DESC),
    },
    annotations: WRITE,
    handler: (
      client,
      { collection, task, name, cadence, init_params_overrides, secret_params, paused, webhook_url, webhook_secret }
    ) => {
      const patch: Record<string, unknown> = {};
      if (cadence !== undefined) patch.cadence = cadence;
      if (init_params_overrides !== undefined) patch.init_params_overrides = init_params_overrides;
      if (secret_params !== undefined) patch.secret_params = secret_params;
      if (paused !== undefined) patch.paused = paused;
      if (webhook_url !== undefined) patch.webhook_url = webhook_url;
      if (webhook_secret !== undefined) patch.webhook_secret = webhook_secret;
      return client.updateRoutine(collection, task, name, patch);
    },
  }),
  define({
    name: "delete-routine",
    title: "Delete routine",
    description: "Delete a routine and unregister its Temporal schedule",
    inputSchema: { collection: collection(), task: task(), name: routineName() },
    annotations: DESTRUCTIVE,
    handler: (client, { collection, task, name }) => client.deleteRoutine(collection, task, name),
  }),
  define({
    name: "pause-routine",
    title: "Pause routine",
    description: "Pause a routine (stops future fires until resumed)",
    inputSchema: { collection: collection(), task: task(), name: routineName() },
    annotations: WRITE,
    handler: (client, { collection, task, name }) => client.pauseRoutine(collection, task, name),
  }),
  define({
    name: "resume-routine",
    title: "Resume routine",
    description: "Resume a paused routine",
    inputSchema: { collection: collection(), task: task(), name: routineName() },
    annotations: WRITE,
    handler: (client, { collection, task, name }) => client.resumeRoutine(collection, task, name),
  }),
  define({
    name: "run-routine-now",
    title: "Run routine now",
    description:
      "Fire a routine immediately, bypassing the schedule. Returns workflow_id (parity with run-workflow).",
    inputSchema: { collection: collection(), task: task(), name: routineName() },
    annotations: WRITE,
    handler: (client, { collection, task, name }) => client.runRoutineNow(collection, task, name),
  }),
  define({
    name: "list-routine-runs",
    title: "List routine runs",
    description:
      "List recent trajectories triggered by this routine (filtered by triggered_by_routine_id)",
    inputSchema: {
      collection: collection(),
      task: task(),
      name: routineName(),
      limit: z.number().optional().describe("Max results"),
    },
    annotations: READ,
    handler: (client, { collection, task, name, limit }) =>
      client.listRoutineRuns(collection, task, name, limit),
  }),
];

/** The subset of the catalog the WebMCP adapter may expose. */
export const JETTY_WEBMCP_TOOLS: readonly JettyToolDefinition[] = JETTY_TOOLS.filter(
  (tool) => tool.webmcp !== false
);

export function getJettyTool(name: string): JettyToolDefinition | undefined {
  return JETTY_TOOLS.find((tool) => tool.name === name);
}
