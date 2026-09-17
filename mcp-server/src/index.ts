#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { JettyClient } from "./client.js";
import { registerTools } from "./tools.js";

const server = new McpServer({
  name: "jetty",
  version: "1.1.0",
});

const client = new JettyClient();
registerTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
