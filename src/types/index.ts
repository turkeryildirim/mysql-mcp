import type { ExecuteValues } from "mysql2/promise";

export interface QueryResult {
  rows: Record<string, unknown>[];
  fields?: string[];
  affectedRows?: number;
  insertId?: number | string;
  warning?: string;
  message?: string;
}

export interface TransactionStatement {
  sql: string;
  params?: ExecuteValues;
}

// Compatible with @modelcontextprotocol/sdk CallToolResult
export interface ToolResponse {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}
