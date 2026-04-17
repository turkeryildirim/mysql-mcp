import { describe, it, expect } from "vitest";
import { serializeRows } from "../../src/lib/errors.js";
import { errorResponse, successResponse, fromError } from "../../src/lib/errors.js";

describe("serializeRows", () => {
  it("converts BigInt to string", () => {
    const rows = [{ id: BigInt("9007199254740993"), name: "Alice" }];
    const result = serializeRows(rows as never);
    expect(result[0].id).toBe("9007199254740993");
  });

  it("converts Buffer to base64", () => {
    const buf = Buffer.from("hello");
    const rows = [{ data: buf }];
    const result = serializeRows(rows as never);
    expect(result[0].data).toBe(buf.toString("base64"));
  });

  it("converts Date to ISO string", () => {
    const d = new Date("2024-01-15T12:00:00.000Z");
    const rows = [{ created_at: d }];
    const result = serializeRows(rows as never);
    expect(result[0].created_at).toBe("2024-01-15T12:00:00.000Z");
  });

  it("passes through plain values unchanged", () => {
    const rows = [{ id: 1, name: "Bob", active: true, score: null }];
    const result = serializeRows(rows as never);
    expect(result[0]).toEqual({ id: 1, name: "Bob", active: true, score: null });
  });

  it("handles nested objects", () => {
    const rows = [{ meta: { count: BigInt(42) } }];
    const result = serializeRows(rows as never);
    expect((result[0].meta as Record<string, unknown>).count).toBe("42");
  });
});

describe("Response builders", () => {
  it("successResponse produces isError:false", () => {
    const r = successResponse({ rows: [] });
    expect(r.isError).toBe(false);
    expect(r.content[0].type).toBe("text");
  });

  it("errorResponse produces isError:true", () => {
    const r = errorResponse("something went wrong");
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe("something went wrong");
  });

  it("fromError extracts Error message", () => {
    const r = fromError(new Error("DB connection refused"));
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe("DB connection refused");
  });

  it("fromError handles non-Error throws", () => {
    const r = fromError("raw string error");
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe("raw string error");
  });
});
