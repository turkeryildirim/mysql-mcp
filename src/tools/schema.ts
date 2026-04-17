import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Pool } from "mysql2/promise";
import { z } from "zod";
import { checkSql } from "../lib/security.js";
import {
  errorResponse,
  fromError,
  queryResultResponse,
  serializeRows,
} from "../lib/errors.js";

const ALLOW_DESTRUCTIVE = process.env.ALLOW_DESTRUCTIVE_DDL === "true";

export function registerSchemaTools(server: McpServer, pool: Pool): void {
  // -------------------------------------------------------------------------
  // create_table
  // -------------------------------------------------------------------------
  server.tool(
    "create_table",
    "Create a new table in the specified database.",
    {
      database: z.string().describe("Target database name"),
      table_name: z.string().describe("Name of the table to create"),
      column_definitions: z
        .string()
        .describe(
          "SQL column definitions fragment, e.g. 'id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL'"
        ),
      if_not_exists: z
        .boolean()
        .optional()
        .describe("Add IF NOT EXISTS clause (default: false)"),
    },
    async ({ database, table_name, column_definitions, if_not_exists }) => {
      const clause = if_not_exists ? "IF NOT EXISTS " : "";
      const sql = `CREATE TABLE ${clause}\`${database}\`.\`${table_name}\` (${column_definitions})`;

      const check = checkSql(sql);
      if (!check.allowed) {
        return errorResponse(check.reason ?? "SQL blocked by security filter");
      }

      try {
        const conn = await pool.getConnection();
        try {
          await conn.execute(sql);
          return queryResultResponse({
            rows: [],
            message: `Table \`${database}\`.\`${table_name}\` created`,
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
  // drop_table
  // -------------------------------------------------------------------------
  server.tool(
    "drop_table",
    "Drop a table from the specified database. Requires ALLOW_DESTRUCTIVE_DDL=true environment variable.",
    {
      database: z.string().describe("Target database name"),
      table_name: z.string().describe("Name of the table to drop"),
      if_exists: z
        .boolean()
        .optional()
        .describe("Add IF EXISTS clause (default: false)"),
    },
    async ({ database, table_name, if_exists }) => {
      if (!ALLOW_DESTRUCTIVE) {
        return errorResponse(
          "drop_table is disabled. Set ALLOW_DESTRUCTIVE_DDL=true to enable destructive DDL operations."
        );
      }

      const clause = if_exists ? "IF EXISTS " : "";
      const sql = `DROP TABLE ${clause}\`${database}\`.\`${table_name}\``;

      const check = checkSql(sql);
      if (!check.allowed) {
        return errorResponse(check.reason ?? "SQL blocked by security filter");
      }

      try {
        const conn = await pool.getConnection();
        try {
          await conn.execute(sql);
          return queryResultResponse({
            rows: [],
            message: `Table \`${database}\`.\`${table_name}\` dropped`,
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
  // alter_table
  // -------------------------------------------------------------------------
  server.tool(
    "alter_table",
    "Alter an existing table (add/modify/drop columns, rename, add indexes, etc.).",
    {
      database: z.string().describe("Target database name"),
      table_name: z.string().describe("Name of the table to alter"),
      alter_clauses: z
        .string()
        .describe(
          "SQL ALTER TABLE clauses, e.g. 'ADD COLUMN email VARCHAR(255), DROP COLUMN old_col'"
        ),
    },
    async ({ database, table_name, alter_clauses }) => {
      const sql = `ALTER TABLE \`${database}\`.\`${table_name}\` ${alter_clauses}`;

      const check = checkSql(sql);
      if (!check.allowed) {
        return errorResponse(check.reason ?? "SQL blocked by security filter");
      }

      try {
        const conn = await pool.getConnection();
        try {
          await conn.execute(sql);
          return queryResultResponse({
            rows: [],
            message: `Table \`${database}\`.\`${table_name}\` altered`,
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
  // show_tables
  // -------------------------------------------------------------------------
  server.tool(
    "show_tables",
    "List all tables in the specified database.",
    {
      database: z.string().describe("Database name"),
    },
    async ({ database }) => {
      try {
        const conn = await pool.getConnection();
        try {
          const [rows] = await conn.execute(
            `SELECT TABLE_NAME as table_name, TABLE_TYPE as table_type
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = ?
             ORDER BY TABLE_NAME`,
            [database]
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
  // describe_table
  // -------------------------------------------------------------------------
  server.tool(
    "describe_table",
    "Show column definitions for a table.",
    {
      database: z.string().describe("Database name"),
      table_name: z.string().describe("Table name"),
    },
    async ({ database, table_name }) => {
      try {
        const conn = await pool.getConnection();
        try {
          const [rows] = await conn.execute(
            `SELECT COLUMN_NAME as column_name,
                    COLUMN_TYPE as column_type,
                    IS_NULLABLE as is_nullable,
                    COLUMN_KEY as column_key,
                    COLUMN_DEFAULT as column_default,
                    EXTRA as extra
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
             ORDER BY ORDINAL_POSITION`,
            [database, table_name]
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
}
