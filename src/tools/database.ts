import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Pool } from "mysql2/promise";
import { z } from "zod";
import {
  errorResponse,
  fromError,
  queryResultResponse,
  serializeRows,
} from "../lib/errors.js";

const ALLOW_DESTRUCTIVE = process.env.ALLOW_DESTRUCTIVE_DDL === "true";

const SYSTEM_DATABASES = new Set([
  "information_schema",
  "performance_schema",
  "mysql",
  "sys",
]);

export function registerDatabaseTools(server: McpServer, pool: Pool): void {
  // -------------------------------------------------------------------------
  // list_databases
  // -------------------------------------------------------------------------
  server.tool(
    "list_databases",
    "List all user databases (system databases are excluded).",
    {},
    async (_args) => {
      try {
        const conn = await pool.getConnection();
        try {
          const placeholders = [...SYSTEM_DATABASES].map(() => "?").join(", ");
          const [rows] = await conn.execute(
            `SELECT SCHEMA_NAME as database_name,
                    DEFAULT_CHARACTER_SET_NAME as charset,
                    DEFAULT_COLLATION_NAME as collation
             FROM information_schema.SCHEMATA
             WHERE SCHEMA_NAME NOT IN (${placeholders})
             ORDER BY SCHEMA_NAME`,
            [...SYSTEM_DATABASES]
          );
          return queryResultResponse({
            rows: serializeRows(rows as Record<string, unknown>[]),
          });
        } finally {
          conn.release();
        }
      } catch (err) {
        return fromError(err);
      }
    }
  );

  // -------------------------------------------------------------------------
  // create_database
  // -------------------------------------------------------------------------
  server.tool(
    "create_database",
    "Create a new database.",
    {
      name: z.string().describe("Database name to create"),
      charset: z
        .string()
        .optional()
        .describe("Character set (e.g. utf8mb4). Default: server default"),
      collation: z
        .string()
        .optional()
        .describe("Collation (e.g. utf8mb4_unicode_ci)"),
      if_not_exists: z
        .boolean()
        .optional()
        .describe("Add IF NOT EXISTS clause (default: false)"),
    },
    async ({ name, charset, collation, if_not_exists }) => {
      if (SYSTEM_DATABASES.has(name.toLowerCase())) {
        return errorResponse(`Cannot create system database: ${name}`);
      }

      const clause = if_not_exists ? "IF NOT EXISTS " : "";
      let sql = `CREATE DATABASE ${clause}\`${name}\``;
      if (charset) sql += ` CHARACTER SET ${charset}`;
      if (collation) sql += ` COLLATE ${collation}`;

      try {
        const conn = await pool.getConnection();
        try {
          await conn.execute(sql);
          return queryResultResponse({
            rows: [],
            message: `Database \`${name}\` created`,
          });
        } finally {
          conn.release();
        }
      } catch (err) {
        return fromError(err);
      }
    }
  );

  // -------------------------------------------------------------------------
  // drop_database
  // -------------------------------------------------------------------------
  server.tool(
    "drop_database",
    "Drop a database. Requires ALLOW_DESTRUCTIVE_DDL=true environment variable.",
    {
      name: z.string().describe("Database name to drop"),
      if_exists: z
        .boolean()
        .optional()
        .describe("Add IF EXISTS clause (default: false)"),
    },
    async ({ name, if_exists }) => {
      if (!ALLOW_DESTRUCTIVE) {
        return errorResponse(
          "drop_database is disabled. Set ALLOW_DESTRUCTIVE_DDL=true to enable destructive DDL operations."
        );
      }

      if (SYSTEM_DATABASES.has(name.toLowerCase())) {
        return errorResponse(`Cannot drop system database: ${name}`);
      }

      const clause = if_exists ? "IF EXISTS " : "";
      const sql = `DROP DATABASE ${clause}\`${name}\``;

      try {
        const conn = await pool.getConnection();
        try {
          await conn.execute(sql);
          return queryResultResponse({
            rows: [],
            message: `Database \`${name}\` dropped`,
          });
        } finally {
          conn.release();
        }
      } catch (err) {
        return fromError(err);
      }
    }
  );
}
