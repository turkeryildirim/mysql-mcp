import { describe, it, expect } from "vitest";
import { checkSql } from "../../src/lib/security.js";

describe("Security filter — regex blocklist", () => {
  const blocked = [
    "SET GLOBAL max_connections = 200",
    "SET @@GLOBAL.max_connections = 200",
    "SET @@global.sql_mode = 'STRICT_ALL_TABLES'",
    "SET @@SESSION.sql_mode = 'NO_ZERO_DATE'",
    "GRANT ALL PRIVILEGES ON *.* TO 'x'@'%'",
    "REVOKE SELECT ON mydb.* FROM 'x'@'%'",
    "CREATE USER 'hacker'@'%' IDENTIFIED BY 'pw'",
    "DROP USER 'hacker'@'%'",
    "ALTER USER 'root'@'localhost' IDENTIFIED BY 'newpw'",
    "RENAME USER 'a'@'%' TO 'b'@'%'",
    "FLUSH PRIVILEGES",
    "FLUSH TABLES WITH READ LOCK",
    "KILL 42",
    "KILL QUERY 42",
    "SHUTDOWN",
    "RESET MASTER",
    "RESET REPLICA ALL",
    "RESET SLAVE",
    "START REPLICA",
    "START SLAVE",
    "STOP REPLICA",
    "STOP SLAVE",
    "CHANGE MASTER TO MASTER_HOST='x'",
    "CHANGE REPLICATION SOURCE TO SOURCE_HOST='x'",
    "LOAD DATA INFILE '/etc/passwd' INTO TABLE t",
    "SELECT * INTO OUTFILE '/tmp/dump.csv' FROM t",
    "SELECT * INTO DUMPFILE '/tmp/dump' FROM t",
    "INSTALL PLUGIN myplugin SONAME 'plugin.so'",
    "UNINSTALL PLUGIN myplugin",
  ];

  for (const sql of blocked) {
    it(`blocks: ${sql.slice(0, 60)}`, () => {
      const result = checkSql(sql);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });
  }
});

describe("Security filter — AST whitelist (allowed)", () => {
  const allowed = [
    "SELECT * FROM mydb.users",
    "SELECT id, name FROM mydb.orders WHERE status = 'active'",
    "INSERT INTO mydb.users (name, email) VALUES ('Alice', 'a@b.com')",
    "UPDATE mydb.users SET name = 'Bob' WHERE id = 1",
    "DELETE FROM mydb.users WHERE id = 99",
    "CREATE TABLE mydb.products (id INT PRIMARY KEY, name VARCHAR(255))",
    "ALTER TABLE mydb.products ADD COLUMN price DECIMAL(10,2)",
    "DROP TABLE IF EXISTS mydb.products",
    "CREATE DATABASE testdb",
    "DROP DATABASE IF EXISTS testdb",
    "SHOW TABLES",
    "SHOW DATABASES",
    // Note: DESCRIBE with db.table notation is handled by the describe_table tool
    // directly via information_schema — agents don't send raw DESCRIBE through execute_query
  ];

  for (const sql of allowed) {
    it(`allows: ${sql.slice(0, 60)}`, () => {
      const result = checkSql(sql);
      expect(result.allowed).toBe(true);
    });
  }
});

describe("Security filter — AST fail-closed", () => {
  it("blocks unparseable SQL", () => {
    const result = checkSql("THIS IS NOT VALID SQL $$##@@");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/could not be parsed/i);
  });

  it("blocks empty string", () => {
    const result = checkSql("   ");
    expect(result.allowed).toBe(false);
  });
});
