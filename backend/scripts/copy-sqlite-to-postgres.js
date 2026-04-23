const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");
const { Client } = require("pg");

function qIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function buildConnectionString(urlString) {
  const parsed = new URL(urlString);
  if (!parsed.searchParams.has("sslmode")) {
    parsed.searchParams.set("sslmode", "require");
  }
  parsed.searchParams.set("uselibpqcompat", "true");
  return parsed.toString();
}

function topoSortTables(tables, fkEdges) {
  const inDegree = new Map();
  const graph = new Map();

  for (const t of tables) {
    inDegree.set(t, 0);
    graph.set(t, new Set());
  }

  for (const { parent, child } of fkEdges) {
    if (!inDegree.has(parent) || !inDegree.has(child)) continue;
    if (graph.get(parent).has(child)) continue;
    graph.get(parent).add(child);
    inDegree.set(child, inDegree.get(child) + 1);
  }

  const queue = [];
  for (const [table, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(table);
  }

  const order = [];
  while (queue.length > 0) {
    const cur = queue.shift();
    order.push(cur);
    for (const next of graph.get(cur)) {
      inDegree.set(next, inDegree.get(next) - 1);
      if (inDegree.get(next) === 0) queue.push(next);
    }
  }

  if (order.length < tables.length) {
    const remaining = tables.filter((t) => !order.includes(t)).sort((a, b) => a.localeCompare(b));
    return [...order, ...remaining];
  }

  return order;
}

async function getTargetColumns(client, schema, table) {
  const result = await client.query(
    `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
      ORDER BY ordinal_position
    `,
    [schema, table]
  );
  return result.rows;
}

function normalizeValueForPostgres(value, dataType) {
  if (value === null || value === undefined) return value;

  const isTimestamp =
    dataType === "timestamp without time zone" ||
    dataType === "timestamp with time zone" ||
    dataType === "date";

  if (!isTimestamp) return value;

  if (typeof value === "number") {
    if (value > 1000000000000 || value > 1000000000) {
      return new Date(value).toISOString();
    }
    return new Date(value * 1000).toISOString();
  }

  if (typeof value === "string" && /^\d{10,13}$/.test(value)) {
    const n = Number(value);
    if (Number.isNaN(n)) return value;
    if (value.length >= 13) {
      return new Date(n).toISOString();
    }
    return new Date(n * 1000).toISOString();
  }

  return value;
}

function getSqliteColumns(db, table) {
  const escaped = String(table).replace(/"/g, '""');
  const res = db.exec(`PRAGMA table_info("${escaped}")`);
  if (res.length === 0) return [];
  const cols = res[0].values.map((row) => row[1]);
  return cols;
}

function getSqliteRows(db, table, columns) {
  const escapedTable = String(table).replace(/"/g, '""');
  const columnSql = columns.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(", ");
  const res = db.exec(`SELECT ${columnSql} FROM "${escapedTable}"`);
  if (res.length === 0) return [];

  const values = res[0].values;
  return values.map((row) => {
    const obj = {};
    for (let i = 0; i < columns.length; i++) {
      obj[columns[i]] = row[i];
    }
    return obj;
  });
}

async function copyTable({ sqliteDb, pgClient, targetSchema, table }) {
  const sqliteColumns = getSqliteColumns(sqliteDb, table);
  const targetColumns = await getTargetColumns(pgClient, targetSchema, table);

  const commonColumns = targetColumns.filter((c) => sqliteColumns.includes(c.column_name));
  if (commonColumns.length === 0) {
    return { table, copied: 0, skipped: true };
  }

  const commonColumnNames = commonColumns.map((c) => c.column_name);
  const rows = getSqliteRows(sqliteDb, table, commonColumnNames);
  if (rows.length === 0) {
    return { table, copied: 0, skipped: false };
  }

  const chunkSize = 200;
  const quotedCols = commonColumnNames.map(qIdent).join(", ");
  const dataTypeMap = new Map(commonColumns.map((c) => [c.column_name, c.data_type]));

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const placeholders = [];
    const values = [];
    let p = 1;

    for (const row of chunk) {
      const ph = [];
      for (const col of commonColumnNames) {
        values.push(normalizeValueForPostgres(row[col], dataTypeMap.get(col)));
        ph.push(`$${p++}`);
      }
      placeholders.push(`(${ph.join(", ")})`);
    }

    const sql = `
      INSERT INTO ${qIdent(targetSchema)}.${qIdent(table)} (${quotedCols})
      VALUES ${placeholders.join(", ")}
    `;

    await pgClient.query(sql, values);
  }

  return { table, copied: rows.length, skipped: false };
}

async function syncSequences(client, schema, table) {
  const serialCols = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
        AND column_default LIKE 'nextval(%'
    `,
    [schema, table]
  );

  for (const row of serialCols.rows) {
    const col = row.column_name;
    const setvalSql = `
      SELECT setval(
        pg_get_serial_sequence('${qIdent(schema)}.${qIdent(table)}', '${col}'),
        COALESCE((SELECT MAX(${qIdent(col)}) FROM ${qIdent(schema)}.${qIdent(table)}), 0) + 1,
        false
      )
    `;
    await client.query(setvalSql);
  }
}

async function main() {
  const sqlitePath = process.env.SOURCE_SQLITE_PATH || path.resolve(__dirname, "../prisma/prisma/dev.db");
  const targetUrl = process.env.TARGET_DB_URL || process.env.DATABASE_URL;

  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`SQLite source not found: ${sqlitePath}`);
  }
  if (!targetUrl) {
    throw new Error("Missing target DATABASE_URL/TARGET_DB_URL");
  }

  const targetParsed = new URL(targetUrl);
  const targetSchema = targetParsed.searchParams.get("schema") || "public";

  const SQL = await initSqlJs();
  const sqliteBytes = fs.readFileSync(sqlitePath);
  const sqliteDb = new SQL.Database(sqliteBytes);

  const sqliteTablesRes = sqliteDb.exec(`
    SELECT name
    FROM sqlite_master
    WHERE type='table'
      AND name NOT LIKE 'sqlite_%'
      AND name <> '_prisma_migrations'
    ORDER BY name
  `);

  const sqliteTables = sqliteTablesRes.length > 0 ? sqliteTablesRes[0].values.map((v) => v[0]) : [];
  if (sqliteTables.length === 0) {
    throw new Error("No source data tables found in SQLite.");
  }

  const pgClient = new Client({
    connectionString: buildConnectionString(targetUrl),
    ssl: { rejectUnauthorized: false },
  });

  await pgClient.connect();

  try {
    const targetTablesRes = await pgClient.query(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
      `,
      [targetSchema]
    );

    const targetTables = new Set(targetTablesRes.rows.map((r) => r.table_name));
    const copyTables = sqliteTables.filter((t) => targetTables.has(t));

    if (copyTables.length === 0) {
      throw new Error(`No matching target tables found in schema '${targetSchema}'.`);
    }

    const fkRes = await pgClient.query(
      `
      SELECT
        tc.table_name AS child,
        ccu.table_name AS parent
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
       AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1
        AND ccu.table_schema = $1
      `,
      [targetSchema]
    );

    const order = topoSortTables(
      copyTables,
      fkRes.rows.map((r) => ({ parent: r.parent, child: r.child }))
    );

    console.log("Starting SQLite -> PostgreSQL copy");
    console.log(`source=${sqlitePath}`);
    console.log(`targetSchema=${targetSchema}`);
    console.log(`tables=${order.join(", ")}`);

    await pgClient.query("BEGIN");

    const truncateSql = `
      TRUNCATE TABLE ${copyTables
        .map((t) => `${qIdent(targetSchema)}.${qIdent(t)}`)
        .join(", ")}
      RESTART IDENTITY CASCADE
    `;
    await pgClient.query(truncateSql);

    let total = 0;
    for (const table of order) {
      const result = await copyTable({
        sqliteDb,
        pgClient,
        targetSchema,
        table,
      });
      total += result.copied;
      console.log(`Copied ${result.copied} rows -> ${table}`);
    }

    for (const table of copyTables) {
      await syncSequences(pgClient, targetSchema, table);
    }

    await pgClient.query("COMMIT");
    console.log(`Done. Total rows copied: ${total}`);
  } catch (error) {
    await pgClient.query("ROLLBACK");
    throw error;
  } finally {
    sqliteDb.close();
    await pgClient.end();
  }
}

main().catch((e) => {
  console.error("Copy failed:", e.message);
  process.exit(1);
});
