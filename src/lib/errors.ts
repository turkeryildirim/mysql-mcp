import type { ToolResponse, QueryResult } from "../types/index.js";

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

function serializeValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("base64");
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        serializeValue(v),
      ])
    );
  }
  return value;
}

export function serializeRows(
  rows: Record<string, unknown>[]
): Record<string, unknown>[] {
  return rows.map((row) => serializeValue(row) as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Response builders
// ---------------------------------------------------------------------------

export function successResponse(data: unknown): ToolResponse {
  return {
    isError: false,
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function errorResponse(message: string): ToolResponse {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

export function queryResultResponse(result: QueryResult): ToolResponse {
  return successResponse(result);
}

export function fromError(err: unknown): ToolResponse {
  const message =
    err instanceof Error ? err.message : String(err ?? "Unknown error");
  return errorResponse(message);
}
