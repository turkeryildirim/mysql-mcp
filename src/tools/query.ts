import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Pool, ExecuteValues } from "mysql2/promise";
import { z } from "zod";
import { checkSql } from "../lib/security.js";
import {
  errorResponse,
  fromError,
  queryResultResponse,
  serializeRows,
} from "../lib/errors.js";

const MAX_ROWS = parseInt(process.env.MAX_ROWS ?? "1000", 10);

export function registerQueryTools(server: McpServer, pool: Pool): void {
  // -------------------------------------------------------------------------
  // execute_query
  // -------------------------------------------------------------------------
  server.tool(
    "execute_query",
    "Execute a SELECT, INSERT, UPDATE, or DELETE SQL statement against a MySQL database. " +
      "Use fully-qualified table names (e.g. mydb.users). " +
      "Results are capped at MAX_ROWS rows (default 1000).",
    {
      database: z.string().describe("Target database name"),
      sql: z.string().describe("SQL statement to execute"),
      params: z
        .array(z.unknown())
        .optional()
        .describe("Parameterized query values (? placeholders)"),
    },
    async ({ database, sql, params }) => {
      const check = checkSql(sql);
      if (!check.allowed) {
        return errorResponse(check.reason ?? "SQL blocked by security filter");
      }

      try {
        const conn = await pool.getConnection();
        try {
          await conn.changeUser({ database });
          const [result] = await conn.execute(
            sql,
            (params ?? []) as ExecuteValues
          );

          if (Array.isArray(result)) {
            const rows = result as Record<string, unknown>[];
            const serialized = serializeRows(rows);
            const truncated = serialized.slice(0, MAX_ROWS);
            return queryResultResponse({
              rows: truncated,
              ...(serialized.length > MAX_ROWS && {
                warning: `Result truncated to ${MAX_ROWS} rows (total: ${serialized.length})`,
              }),
            });
          }

          const header = result as { affectedRows: number; insertId: number };
          return queryResultResponse({
            rows: [],
            affectedRows: header.affectedRows,
            insertId: String(header.insertId),
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
  // execute_transaction
  // -------------------------------------------------------------------------
  server.tool(
    "execute_transaction",
    "Execute multiple SQL statements as an atomic transaction. " +
      "All statements are committed together; if any fails the entire transaction is rolled back. " +
      "Use this instead of calling BEGIN/COMMIT manually.",
    {
      database: z.string().describe("Target database name"),
      statements: z
        .array(
          z.object({
            sql: z.string().describe("SQL statement"),
            params: z
              .array(z.unknown())
              .optional()
              .describe("Parameterized values"),
          })
        )
        .min(1)
        .describe("Ordered list of statements to execute atomically"),
    },
    async ({ database, statements }) => {
      for (const { sql } of statements) {
        const check = checkSql(sql);
        if (!check.allowed) {
          return errorResponse(
            `SQL blocked by security filter: ${check.reason ?? ""}\nStatement: ${sql}`
          );
        }
      }

      const conn = await pool.getConnection();
      try {
        await conn.changeUser({ database });
        await conn.beginTransaction();

        for (const { sql, params } of statements) {
          await conn.execute(sql, (params ?? []) as ExecuteValues);
        }

        await conn.commit();

        return queryResultResponse({
          rows: [],
          message: `Transaction committed — ${statements.length} statement(s) executed`,
        });
      } catch (err) {
        await conn.rollback().catch(() => undefined);
        return fromError(err);
      } finally {
        conn.release();
      }
    }
  );
}
