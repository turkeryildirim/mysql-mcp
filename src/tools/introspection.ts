import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Pool } from "mysql2/promise";
import { z } from "zod";
import { fromError, queryResultResponse, serializeRows } from "../lib/errors.js";

export function registerIntrospectionTools(
  server: McpServer,
  pool: Pool
): void {
  // -------------------------------------------------------------------------
  // ping
  // -------------------------------------------------------------------------
  server.tool(
    "ping",
    "Check MySQL connection health. Returns 'pong' if the connection is alive.",
    {},
    async (_args) => {
      try {
        const conn = await pool.getConnection();
        try {
          await conn.ping();
          return queryResultResponse({ rows: [], message: "pong" });
        } finally {
          conn.release();
        }
      } catch (err) {
        return fromError(err);
      }
    }
  );

  // -------------------------------------------------------------------------
  // show_columns
  // -------------------------------------------------------------------------
  server.tool(
    "show_columns",
    "Show all columns for a given table.",
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
                    EXTRA as extra,
                    CHARACTER_MAXIMUM_LENGTH as max_length
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

  // -------------------------------------------------------------------------
  // get_server_info
  // -------------------------------------------------------------------------
  server.tool(
    "get_server_info",
    "Return read-only MySQL server metadata: version, character set, and collation.",
    {},
    async (_args) => {
      try {
        const conn = await pool.getConnection();
        try {
          const [rows] = await conn.execute(
            `SELECT VERSION() as version,
                    @@character_set_server as character_set,
                    @@collation_server as collation`
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
