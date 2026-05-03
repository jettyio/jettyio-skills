import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { JettyClient } from "./client.js";

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

const PROVIDER_KEYS = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "REPLICATE_API_TOKEN",
];

async function detectTrialEligibility(
  client: JettyClient,
  collection: string
): Promise<{ useTrialKeys: boolean; trialInfo: Record<string, unknown> }> {
  try {
    const trialStatus = (await client.getTrialStatus(collection)) as Record<
      string,
      unknown
    >;

    if (!trialStatus.active) {
      return {
        useTrialKeys: false,
        trialInfo: { trial_active: false },
      };
    }

    const env = (await client.getCollectionEnvironment(collection)) as Record<
      string,
      unknown
    >;
    const envKeys = Object.keys(env);
    const hasProviderKeys = PROVIDER_KEYS.some((k) => envKeys.includes(k));

    if (hasProviderKeys) {
      return {
        useTrialKeys: false,
        trialInfo: {
          trial_active: true,
          using_trial_keys: false,
          reason: "Collection has its own provider keys",
        },
      };
    }

    return {
      useTrialKeys: true,
      trialInfo: {
        trial_active: true,
        using_trial_keys: true,
      },
    };
  } catch {
    return { useTrialKeys: false, trialInfo: {} };
  }
}

export function registerTools(server: McpServer, client: JettyClient) {
  // ── Collections ──────────────────────────────────────────────

  server.tool("list-collections", "List all collections", {}, async () => {
    return jsonResult(await client.listCollections());
  });

  server.tool(
    "get-collection",
    "Get collection details including environment variable keys",
    { collection: z.string().describe("Collection name") },
    async ({ collection }) => {
      return jsonResult(await client.getCollection(collection));
    }
  );

  // ── Tasks ────────────────────────────────────────────────────

  server.tool(
    "list-tasks",
    "List tasks in a collection",
    { collection: z.string().describe("Collection name") },
    async ({ collection }) => {
      return jsonResult(await client.listTasks(collection));
    }
  );

  server.tool(
    "get-task",
    "Get task details including workflow definition",
    {
      collection: z.string().describe("Collection name"),
      task: z.string().describe("Task name"),
    },
    async ({ collection, task }) => {
      return jsonResult(await client.getTask(collection, task));
    }
  );

  server.tool(
    "create-task",
    "Create a new task with a workflow definition",
    {
      collection: z.string().describe("Collection name"),
      name: z.string().describe("Task name"),
      description: z.string().optional().describe("Task description"),
      workflow: z
        .record(z.unknown())
        .describe(
          "Workflow JSON with init_params, step_configs, and steps"
        ),
    },
    async ({ collection, name, description, workflow }) => {
      return jsonResult(
        await client.createTask(collection, name, workflow, description)
      );
    }
  );

  server.tool(
    "update-task",
    "Update a task's workflow or description",
    {
      collection: z.string().describe("Collection name"),
      task: z.string().describe("Task name"),
      workflow: z
        .record(z.unknown())
        .optional()
        .describe("Updated workflow JSON"),
      description: z.string().optional().describe("Updated description"),
    },
    async ({ collection, task, workflow, description }) => {
      const updates: { workflow?: unknown; description?: string } = {};
      if (workflow) updates.workflow = workflow;
      if (description) updates.description = description;
      return jsonResult(await client.updateTask(collection, task, updates));
    }
  );

  // ── Trial Keys ────────────────────────────────────────────────

  server.tool(
    "get-trial-status",
    "Get trial key status for a collection",
    { collection: z.string().describe("Collection name") },
    async ({ collection }) => {
      return jsonResult(await client.getTrialStatus(collection));
    }
  );

  server.tool(
    "activate-trial",
    "Activate trial keys for a collection",
    { collection: z.string().describe("Collection name") },
    async ({ collection }) => {
      return jsonResult(await client.activateTrial(collection));
    }
  );

  // ── Run Workflows ────────────────────────────────────────────

  server.tool(
    "run-workflow",
    "Run a workflow asynchronously (returns immediately with workflow_id). Auto-detects trial key eligibility.",
    {
      collection: z.string().describe("Collection name"),
      task: z.string().describe("Task name"),
      init_params: z
        .record(z.unknown())
        .optional()
        .describe("Input parameters for the workflow"),
    },
    async ({ collection, task, init_params }) => {
      const { useTrialKeys, trialInfo } = await detectTrialEligibility(
        client,
        collection
      );
      const result = await client.runWorkflow(
        collection,
        task,
        init_params as Record<string, unknown>,
        useTrialKeys
      );
      return jsonResult({ ...trialInfo, result });
    }
  );

  server.tool(
    "run-workflow-sync",
    "Run a workflow synchronously (blocks until completion, may take 30-60s). Auto-detects trial key eligibility.",
    {
      collection: z.string().describe("Collection name"),
      task: z.string().describe("Task name"),
      init_params: z
        .record(z.unknown())
        .optional()
        .describe("Input parameters for the workflow"),
    },
    async ({ collection, task, init_params }) => {
      const { useTrialKeys, trialInfo } = await detectTrialEligibility(
        client,
        collection
      );
      const result = await client.runWorkflowSync(
        collection,
        task,
        init_params as Record<string, unknown>,
        useTrialKeys
      );
      return jsonResult({ ...trialInfo, result });
    }
  );

  // ── Trajectories ─────────────────────────────────────────────

  server.tool(
    "list-trajectories",
    "List recent workflow runs (trajectories) for a task",
    {
      collection: z.string().describe("Collection name"),
      task: z.string().describe("Task name"),
      limit: z.number().optional().default(10).describe("Max results"),
      page: z.number().optional().default(1).describe("Page number"),
    },
    async ({ collection, task, limit, page }) => {
      return jsonResult(
        await client.listTrajectories(collection, task, limit, page)
      );
    }
  );

  server.tool(
    "get-trajectory",
    "Get full details of a specific workflow run",
    {
      collection: z.string().describe("Collection name"),
      task: z.string().describe("Task name"),
      trajectory_id: z.string().describe("Trajectory ID"),
    },
    async ({ collection, task, trajectory_id }) => {
      return jsonResult(
        await client.getTrajectory(collection, task, trajectory_id)
      );
    }
  );

  // ── Stats ────────────────────────────────────────────────────

  server.tool(
    "get-stats",
    "Get execution statistics for a task",
    {
      collection: z.string().describe("Collection name"),
      task: z.string().describe("Task name"),
    },
    async ({ collection, task }) => {
      return jsonResult(await client.getStats(collection, task));
    }
  );

  // ── Labels ───────────────────────────────────────────────────

  server.tool(
    "add-label",
    "Add a label to a trajectory (e.g., quality=high)",
    {
      collection: z.string().describe("Collection name"),
      task: z.string().describe("Task name"),
      trajectory_id: z.string().describe("Trajectory ID"),
      key: z.string().describe("Label key (e.g., 'quality', 'status')"),
      value: z.string().describe("Label value (e.g., 'high', 'approved')"),
      author: z.string().describe("Author email"),
    },
    async ({ collection, task, trajectory_id, key, value, author }) => {
      return jsonResult(
        await client.addLabel(collection, task, trajectory_id, key, value, author)
      );
    }
  );

  // ── Step Templates ───────────────────────────────────────────

  server.tool(
    "list-step-templates",
    "List all available workflow step templates",
    {},
    async () => {
      return jsonResult(await client.listStepTemplates());
    }
  );

  server.tool(
    "get-step-template",
    "Get details and schema for a step template",
    { name: z.string().describe("Step template activity name") },
    async ({ name }) => {
      return jsonResult(await client.getStepTemplate(name));
    }
  );

  // ── Environment Variables ─────────────────────────────────────

  server.tool(
    "check-secrets",
    "Check which environment variables a collection has configured vs. what a runbook needs",
    {
      collection: z.string().describe("Collection name"),
      required_keys: z
        .array(z.string())
        .describe("Environment variable names the runbook requires"),
    },
    async ({ collection, required_keys }) => {
      const col = (await client.getCollectionEnvironment(
        collection
      )) as Record<string, unknown>;
      const envVars = (col.environment_variables || {}) as Record<
        string,
        unknown
      >;
      const configured = Object.keys(envVars);
      const missing = required_keys.filter((k) => !configured.includes(k));
      return jsonResult({
        configured,
        missing,
        ready: missing.length === 0,
      });
    }
  );

  server.tool(
    "set-environment-vars",
    "Set environment variables on a collection (merge semantics, pass null to delete a key)",
    {
      collection: z.string().describe("Collection name"),
      variables: z
        .record(z.string().nullable())
        .describe("Key-value pairs to set (null to delete)"),
    },
    async ({ collection, variables }) => {
      return jsonResult(
        await client.setEnvironmentVars(
          collection,
          variables as Record<string, string>
        )
      );
    }
  );

  // ── Routines (Scheduled Runs) ─────────────────────────────────

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
        .describe(
          "Hour of day in UTC (0-23). Required for daily/weekdays/weekly."
        ),
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

  server.tool(
    "list-routines",
    "List scheduled routines for a collection (optionally scoped to a task)",
    {
      collection: z.string().describe("Collection name"),
      task: z
        .string()
        .optional()
        .describe("Task name (omit to list all routines in the collection)"),
    },
    async ({ collection, task }) => {
      return jsonResult(await client.listRoutines(collection, task));
    }
  );

  server.tool(
    "get-routine",
    "Get a single routine including resolved next_run_at from Temporal",
    {
      collection: z.string().describe("Collection name"),
      task: z.string().describe("Task name"),
      name: z.string().describe("Routine name (unique per collection+task)"),
    },
    async ({ collection, task, name }) => {
      return jsonResult(await client.getRoutine(collection, task, name));
    }
  );

  server.tool(
    "create-routine",
    "Create a scheduled routine for an existing task. init_params_overrides keys must be a subset of task.workflow.init_params.",
    {
      collection: z.string().describe("Collection name"),
      task: z.string().describe("Task name"),
      name: z.string().describe("Routine name (slug, unique per task)"),
      cadence: cadenceSchema,
      init_params_overrides: z
        .record(z.unknown())
        .optional()
        .describe(
          "Init param overrides. Keys must be a subset of task.workflow.init_params; unknown keys return 400."
        ),
      secret_params: z
        .record(z.unknown())
        .optional()
        .describe(
          "Secrets injected at fire time (encrypted at rest, never logged)."
        ),
      paused: z
        .boolean()
        .optional()
        .describe("Create the routine in paused state"),
      webhook_url: z
        .string()
        .optional()
        .describe("Optional webhook to notify on each run"),
      webhook_secret: z
        .string()
        .optional()
        .describe("Optional shared secret for webhook signing"),
    },
    async ({
      collection,
      task,
      name,
      cadence,
      init_params_overrides,
      secret_params,
      paused,
      webhook_url,
      webhook_secret,
    }) => {
      const body: Record<string, unknown> = { name, cadence };
      if (init_params_overrides !== undefined)
        body.init_params_overrides = init_params_overrides;
      if (secret_params !== undefined) body.secret_params = secret_params;
      if (paused !== undefined) body.paused = paused;
      if (webhook_url !== undefined) body.webhook_url = webhook_url;
      if (webhook_secret !== undefined) body.webhook_secret = webhook_secret;
      return jsonResult(await client.createRoutine(collection, task, body));
    }
  );

  server.tool(
    "update-routine",
    "Patch a routine — provide any subset of cadence/overrides/secrets/paused/webhook fields",
    {
      collection: z.string().describe("Collection name"),
      task: z.string().describe("Task name"),
      name: z.string().describe("Routine name"),
      cadence: cadenceSchema.optional(),
      init_params_overrides: z
        .record(z.unknown())
        .optional()
        .describe("Replace init param overrides"),
      secret_params: z
        .record(z.unknown())
        .optional()
        .describe("Replace secret params"),
      paused: z.boolean().optional().describe("Pause/resume the routine"),
      webhook_url: z.string().optional().describe("Update webhook URL"),
      webhook_secret: z
        .string()
        .optional()
        .describe("Update webhook signing secret"),
    },
    async ({
      collection,
      task,
      name,
      cadence,
      init_params_overrides,
      secret_params,
      paused,
      webhook_url,
      webhook_secret,
    }) => {
      const patch: Record<string, unknown> = {};
      if (cadence !== undefined) patch.cadence = cadence;
      if (init_params_overrides !== undefined)
        patch.init_params_overrides = init_params_overrides;
      if (secret_params !== undefined) patch.secret_params = secret_params;
      if (paused !== undefined) patch.paused = paused;
      if (webhook_url !== undefined) patch.webhook_url = webhook_url;
      if (webhook_secret !== undefined) patch.webhook_secret = webhook_secret;
      return jsonResult(
        await client.updateRoutine(collection, task, name, patch)
      );
    }
  );

  server.tool(
    "delete-routine",
    "Delete a routine and unregister its Temporal schedule",
    {
      collection: z.string().describe("Collection name"),
      task: z.string().describe("Task name"),
      name: z.string().describe("Routine name"),
    },
    async ({ collection, task, name }) => {
      return jsonResult(await client.deleteRoutine(collection, task, name));
    }
  );

  server.tool(
    "pause-routine",
    "Pause a routine (stops future fires until resumed)",
    {
      collection: z.string().describe("Collection name"),
      task: z.string().describe("Task name"),
      name: z.string().describe("Routine name"),
    },
    async ({ collection, task, name }) => {
      return jsonResult(await client.pauseRoutine(collection, task, name));
    }
  );

  server.tool(
    "resume-routine",
    "Resume a paused routine",
    {
      collection: z.string().describe("Collection name"),
      task: z.string().describe("Task name"),
      name: z.string().describe("Routine name"),
    },
    async ({ collection, task, name }) => {
      return jsonResult(await client.resumeRoutine(collection, task, name));
    }
  );

  server.tool(
    "run-routine-now",
    "Fire a routine immediately, bypassing the schedule. Returns workflow_id (parity with run-workflow).",
    {
      collection: z.string().describe("Collection name"),
      task: z.string().describe("Task name"),
      name: z.string().describe("Routine name"),
    },
    async ({ collection, task, name }) => {
      return jsonResult(await client.runRoutineNow(collection, task, name));
    }
  );

  server.tool(
    "list-routine-runs",
    "List recent trajectories triggered by this routine (filtered by triggered_by_routine_id)",
    {
      collection: z.string().describe("Collection name"),
      task: z.string().describe("Task name"),
      name: z.string().describe("Routine name"),
      limit: z.number().optional().describe("Max results"),
    },
    async ({ collection, task, name, limit }) => {
      return jsonResult(
        await client.listRoutineRuns(collection, task, name, limit)
      );
    }
  );
}
