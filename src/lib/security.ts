import { Parser } from "node-sql-parser";

// ---------------------------------------------------------------------------
// Layer 1 — Regex blocklist (runs first, fast)
// ---------------------------------------------------------------------------

const BLOCKED_PATTERNS: RegExp[] = [
  /^\s*SET\s+@@?GLOBAL/i,
  /^\s*SET\s+@@?SESSION\.sql_mode/i,
  /^\s*GRANT\s+/i,
  /^\s*REVOKE\s+/i,
  /^\s*(CREATE|DROP|ALTER|RENAME)\s+USER/i,
  /^\s*FLUSH\s+/i,
  /^\s*KILL\s+/i,
  /^\s*SHUTDOWN/i,
  /^\s*RESET\s+(MASTER|REPLICA|SLAVE)/i,
  /^\s*(START|STOP)\s+(REPLICA|SLAVE)/i,
  /^\s*CHANGE\s+(MASTER|REPLICATION)/i,
  /^\s*LOAD\s+DATA/i,
  /INTO\s+OUTFILE/i,
  /INTO\s+DUMPFILE/i,
  /^\s*INSTALL\s+PLUGIN/i,
  /^\s*UNINSTALL\s+PLUGIN/i,
];

function checkBlocklist(sql: string): string | null {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(sql)) {
      return `Blocked by security filter: statement matches a forbidden pattern (${pattern.source})`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Layer 2 — AST whitelist (fail-closed: unknown = blocked)
// ---------------------------------------------------------------------------

const ALLOWED_STATEMENT_TYPES = new Set([
  "select",
  "insert",
  "update",
  "delete",
  "create",   // CREATE TABLE, CREATE DATABASE, CREATE INDEX
  "drop",     // DROP TABLE, DROP DATABASE, DROP INDEX
  "alter",    // ALTER TABLE
  "begin",
  "commit",
  "rollback",
  "show",     // SHOW TABLES, SHOW COLUMNS, SHOW DATABASES
  "desc",     // DESCRIBE / DESC
  "use",      // handled separately; blocked at tool level but parser may see it
]);

const parser = new Parser();

function checkAst(sql: string): string | null {
  let ast: ReturnType<Parser["astify"]>;

  try {
    ast = parser.astify(sql, { database: "MySQL" });
  } catch {
    // Fail-closed: if we cannot parse it, reject it
    return `Blocked by security filter: SQL could not be parsed — unknown or unsupported syntax`;
  }

  const statements = Array.isArray(ast) ? ast : [ast];

  for (const stmt of statements) {
    if (!stmt || typeof stmt !== "object") {
      return `Blocked by security filter: unexpected AST node`;
    }

    const type = (stmt as { type?: string }).type?.toLowerCase() ?? "";

    if (!ALLOWED_STATEMENT_TYPES.has(type)) {
      return `Blocked by security filter: statement type '${type || "(unknown)"}' is not permitted`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
}

export function checkSql(sql: string): SecurityCheckResult {
  const trimmed = sql.trim();

  if (!trimmed) {
    return { allowed: false, reason: "Empty SQL statement" };
  }

  const blocklistHit = checkBlocklist(trimmed);
  if (blocklistHit) {
    return { allowed: false, reason: blocklistHit };
  }

  const astHit = checkAst(trimmed);
  if (astHit) {
    return { allowed: false, reason: astHit };
  }

  return { allowed: true };
}
