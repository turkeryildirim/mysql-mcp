# mysql-mcp

A Model Context Protocol (MCP) server that gives AI agents direct access to MySQL databases.

## What It Can Do

### Data Query & Mutation
- `execute_query` — Run SELECT, INSERT, UPDATE, or DELETE statements with parameterized query support (`?` placeholders)
- `execute_transaction` — Execute multiple statements as an atomic batch; if any statement fails the entire transaction is automatically rolled back

### Schema Management
- `create_table` — Create a new table
- `alter_table` — Add/drop columns, rename columns, add indexes, and more
- `drop_table` — Drop a table (requires `ALLOW_DESTRUCTIVE_DDL=true`)
- `show_tables` — List all tables in a database
- `describe_table` — Show column structure of a table

### Database Management
- `list_databases` — List all user databases (system databases excluded)
- `create_database` — Create a new database with optional charset and collation
- `drop_database` — Drop a database (requires `ALLOW_DESTRUCTIVE_DDL=true`)

### Introspection
- `ping` — Check MySQL connection health
- `show_columns` — Show detailed column information for a table
- `get_server_info` — Return MySQL version, character set, and collation (read-only)

### Multi-Database Support
Every tool accepts a `database` parameter. You can query different databases within the same session without any extra configuration.

---

## What It Cannot Do

The following operations are permanently blocked by the security filter and cannot be bypassed under any circumstances:

| Category | Blocked Commands |
|---|---|
| MySQL settings | `SET GLOBAL`, `SET @@global.*`, `SET @@SESSION.sql_mode` |
| User management | `CREATE USER`, `DROP USER`, `ALTER USER`, `RENAME USER` |
| Privilege management | `GRANT`, `REVOKE` |
| System commands | `FLUSH`, `KILL`, `SHUTDOWN` |
| Replication | `RESET MASTER/REPLICA`, `START/STOP SLAVE/REPLICA`, `CHANGE MASTER` |
| File access | `LOAD DATA INFILE`, `SELECT INTO OUTFILE/DUMPFILE` |
| Plugins | `INSTALL PLUGIN`, `UNINSTALL PLUGIN` |

Additional constraints:
- **Multiple statements** separated by `;` in a single call are not allowed — use `execute_transaction` instead
- **`drop_table` and `drop_database`** are disabled by default and will return an error unless `ALLOW_DESTRUCTIVE_DDL=true` is set
- **Query results** are capped at `MAX_ROWS` rows (default: 1000); add a `LIMIT` clause for large tables

---

## Installation

**Requirements:** Node.js 20+

```bash
git clone https://github.com/turkeryildirim/mysql-mcp
cd mysql-mcp
npm install
npm run build
```

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=mcp_user
MYSQL_PASSWORD=your_password

# Optional
MYSQL_DATABASE=default_db
MYSQL_POOL_SIZE=10
MAX_ROWS=1000
ALLOW_DESTRUCTIVE_DDL=false
```

### Creating a Dedicated MySQL User (Recommended)

Create a least-privilege MySQL user for the MCP server:

```sql
CREATE USER 'mcp_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX
  ON *.* TO 'mcp_user'@'localhost';
FLUSH PRIVILEGES;
```

> Do **not** grant `SUPER`, `FILE`, `RELOAD`, or `GRANT OPTION`.

---

## Claude Desktop Integration

Open the Claude Desktop config file:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

Add the following block under `mcpServers`:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "node",
      "args": ["/absolute/path/to/mysql-mcp/dist/index.js"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "mcp_user",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "",
        "MAX_ROWS": "1000",
        "ALLOW_DESTRUCTIVE_DDL": "false"
      }
    }
  }
}
```

Restart Claude Desktop. You should see the `mysql` server listed in the tools panel.

---

## Claude CLI Integration

### Option 1: `.mcp.json` — Project-scoped (Recommended)

Create a `.mcp.json` file in your project root:

```json
{
  "mcpServers": {
    "mysql": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/mysql-mcp/dist/index.js"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "mcp_user",
        "MYSQL_PASSWORD": "your_password",
        "ALLOW_DESTRUCTIVE_DDL": "false"
      }
    }
  }
}
```

The server loads automatically whenever you run `claude` from that directory.

### Option 2: Global configuration

```bash
claude mcp add mysql -- node /absolute/path/to/mysql-mcp/dist/index.js
```

To include environment variables:

```bash
claude mcp add mysql \
  -e MYSQL_HOST=localhost \
  -e MYSQL_USER=mcp_user \
  -e MYSQL_PASSWORD=your_password \
  -- node /absolute/path/to/mysql-mcp/dist/index.js
```

Verify the setup:

```bash
claude mcp list
claude mcp get mysql
```

---

## Example Prompts

Once connected, you can instruct the agent in natural language:

```
Show me the structure of the users table in testdb
Fetch the last 10 orders from testdb.orders
Create a products table in testdb with id, name, price, and stock columns
Run the following two INSERTs as a single transaction: ...
```

---

## Development

```bash
npm run dev        # Watch mode (rebuilds on change)
npm test           # Unit tests (no MySQL connection required)
npm run build      # Production build → dist/
```
