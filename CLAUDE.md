# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build       # TypeScript → dist/
npm test            # Unit tests (no DB required)
npm run dev         # Watch mode build
npm start           # Run the compiled server (requires .env)
```

Single test file: `npx vitest run tests/unit/security.test.ts`

## Architecture

MCP stdio server: AI agents call tools → tools validate SQL → execute against MySQL pool → return JSON.

```
src/
  index.ts              # Entry: McpServer + StdioServerTransport, registers all tool groups
  lib/
    pool.ts             # mysql2 createPool (env config, multipleStatements:false, timezone:Z)
    security.ts         # checkSql(): Layer 1 regex blocklist → Layer 2 AST whitelist (fail-closed)
    errors.ts           # ToolResponse builder + serializeRows (BigInt→string, Buffer→base64, Date→ISO)
  tools/
    query.ts            # execute_query, execute_transaction
    schema.ts           # create_table, drop_table, alter_table, show_tables, describe_table
    database.ts         # list_databases, create_database, drop_database
    introspection.ts    # ping, show_columns, get_server_info
  types/index.ts        # ToolResponse, QueryResult, TransactionStatement
```

## Security Model

Every SQL string from the agent flows through `checkSql()` in `src/lib/security.ts` before reaching mysql2:

1. **Regex blocklist** (fast, runs first) — blocks SET GLOBAL, GRANT, REVOKE, FLUSH, KILL, LOAD DATA, INTO OUTFILE, replication commands, plugin management
2. **AST whitelist** (fail-closed) — `node-sql-parser` parses SQL; if the statement type is not in the allow-list OR parsing fails → rejected. Unknown syntax never reaches the DB.

`multipleStatements: false` on the pool prevents statement smuggling via semicolons.

## Multi-Database Design

No `use_database` tool exists. All queries use fully-qualified names (`mydb.users`). Tools accept a `database` parameter and call `conn.changeUser({ database })` before executing — no `USE` SQL command, no pool state leakage.

Transactions are atomic batches: `execute_transaction` accepts an array of statements, pins one connection for `BEGIN → execute all → COMMIT/ROLLBACK`, then releases.

## Environment Variables

Copy `.env.example` to `.env`. Required: `MYSQL_USER`. Key behavioural flags:

- `ALLOW_DESTRUCTIVE_DDL=true` — enables `drop_table` and `drop_database` (default: false)
- `MAX_ROWS=1000` — caps `execute_query` result rows

## MCP Client Config (Claude Desktop)

```json
{
  "mcpServers": {
    "mysql": {
      "command": "node",
      "args": ["C:/path/to/mysql-mcp/dist/index.js"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_USER": "mcp_user",
        "MYSQL_PASSWORD": "..."
      }
    }
  }
}
```
