import mysql from "mysql2/promise";
import "dotenv/config";

function getEnvInt(key: string, fallback: number): number {
  const val = process.env[key];
  if (!val) return fallback;
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : n;
}

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export function createPool(): mysql.Pool {
  return mysql.createPool({
    host: process.env.MYSQL_HOST ?? "localhost",
    port: getEnvInt("MYSQL_PORT", 3306),
    user: requireEnv("MYSQL_USER"),
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE || undefined,
    connectionLimit: getEnvInt("MYSQL_POOL_SIZE", 10),
    // Security: prevent statement smuggling via multi-statement batches
    multipleStatements: false,
    // Force UTC for all DATETIME values
    timezone: "Z",
    // Return BigInt as string to avoid JSON serialization failures
    supportBigNumbers: true,
    bigNumberStrings: true,
  });
}

export const pool = createPool();
