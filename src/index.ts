#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pool } from "./lib/pool.js";
import { registerQueryTools } from "./tools/query.js";
import { registerSchemaTools } from "./tools/schema.js";
import { registerDatabaseTools } from "./tools/database.js";
import { registerIntrospectionTools } from "./tools/introspection.js";

const server = new McpServer({
  name: "mysql-mcp",
  version: "1.0.0",
});

registerQueryTools(server, pool);
registerSchemaTools(server, pool);
registerDatabaseTools(server, pool);
registerIntrospectionTools(server, pool);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so stdout stays clean for MCP JSON-RPC
  process.stderr.write("mysql-mcp server started (stdio)\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
