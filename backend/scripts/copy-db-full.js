const { Client } = require("pg");

function getSchemaFromUrl(urlString, fallback = "public") {
  const parsed = new URL(urlString);
  return parsed.searchParams.get("schema") || fallback;
}

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
    const current = queue.shift();
    order.push(current);
    for (const next of graph.get(current)) {
      inDegree.set(next, inDegree.get(next) - 1);
      if (inDegree.get(next) === 0) queue.push(next);
    }
  }

  if (order.length < tables.length) {
    const remaining = tables.filter((t) => !order.includes(t));
    return [...order, ...remaining.sort((a, b) => a.localeCompare(b))];
  }

  return order;
}

async function getTableColumns(client, schema, table) {
  const sql = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
    ORDER BY ordinal_position ASC
  `;
  const result = await client.query(sql, [schema, table]);
  return result.rows.map((r) => r.column_name);
}

async function copyTableData({ sourceClient, targetClient, sourceSchema, targetSchema, table }) {
  const columns = await getTableColumns(sourceClient, sourceSchema, table);
  if (columns.length === 0) {
    return { table, copied: 0 };
  }

  const selectSql = `SELECT ${columns.map(qIdent).join(", ")} FROM ${qIdent(sourceSchema)}.${qIdent(table)}`;
  const sourceRows = await sourceClient.query(selectSql);

  if (sourceRows.rows.length === 0) {
    return { table, copied: 0 };
  }

  const chunkSize = 200;
  const quotedColumns = columns.map(qIdent).join(", ");

  for (let i = 0; i < sourceRows.rows.length; i += chunkSize) {
    const chunk = sourceRows.rows.slice(i, i + chunkSize);
    const values = [];
    const placeholders = [];
    let p = 1;

    for (const row of chunk) {
      const rowPlaceholders = [];
      for (const col of columns) {
        values.push(row[col]);
        rowPlaceholders.push(`$${p++}`);
      }
      placeholders.push(`(${rowPlaceholders.join(", ")})`);
    }

    const insertSql = `
      INSERT INTO ${qIdent(targetSchema)}.${qIdent(table)} (${quotedColumns})
      VALUES ${placeholders.join(", ")}
    `;

    await targetClient.query(insertSql, values);
  }

  return { table, copied: sourceRows.rows.length };
}

async function syncSequences(client, schema, table) {
  const serialColsSql = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = $2
      AND column_default LIKE 'nextval(%'
  `;

  const serialCols = await client.query(serialColsSql, [schema, table]);

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
  const sourceUrl = process.env.SOURCE_DB_URL || process.env.AWS_DATABASE_URL;
  const targetUrl = process.env.TARGET_DB_URL || process.env.DATABASE_URL;

  if (!sourceUrl) {
    throw new Error("Missing source database URL. Set SOURCE_DB_URL or AWS_DATABASE_URL.");
  }
  if (!targetUrl) {
    throw new Error("Missing target database URL. Set TARGET_DB_URL or DATABASE_URL.");
  }
  if (sourceUrl === targetUrl) {
    throw new Error("Source and target DB URLs are identical. Aborting.");
  }

  const sourceSchema = process.env.SOURCE_DB_SCHEMA || getSchemaFromUrl(sourceUrl, "public");
  const targetSchema = process.env.TARGET_DB_SCHEMA || getSchemaFromUrl(targetUrl, "public");

  const sourceClient = new Client({
    connectionString: buildConnectionString(sourceUrl),
    ssl: { rejectUnauthorized: false },
  });
  const targetClient = new Client({
    connectionString: buildConnectionString(targetUrl),
    ssl: { rejectUnauthorized: false },
  });

  console.log("Starting full copy:");
  console.log(`Source schema: ${sourceSchema}`);
  console.log(`Target schema: ${targetSchema}`);

  await sourceClient.connect();
  await targetClient.connect();

  try {
    const tablesResult = await sourceClient.query(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
      `,
      [sourceSchema]
    );

    const tables = tablesResult.rows.map((r) => r.table_name);

    if (tables.length === 0) {
      throw new Error(`No tables found in source schema '${sourceSchema}'.`);
    }

    const fkResult = await sourceClient.query(
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
      [sourceSchema]
    );

    const orderedTables = topoSortTables(
      tables,
      fkResult.rows.map((r) => ({ parent: r.parent, child: r.child }))
    );

    console.log(`Found ${tables.length} tables.`);

    await targetClient.query("BEGIN");

    const truncateSql = `
      TRUNCATE TABLE ${tables
        .map((t) => `${qIdent(targetSchema)}.${qIdent(t)}`)
        .join(", ")}
      RESTART IDENTITY CASCADE
    `;
    await targetClient.query(truncateSql);

    let totalRows = 0;
    for (const table of orderedTables) {
      const result = await copyTableData({
        sourceClient,
        targetClient,
        sourceSchema,
        targetSchema,
        table,
      });
      totalRows += result.copied;
      console.log(`Copied ${result.copied} rows -> ${table}`);
    }

    for (const table of tables) {
      await syncSequences(targetClient, targetSchema, table);
    }

    await targetClient.query("COMMIT");
    console.log(`Done. Total copied rows: ${totalRows}`);
  } catch (error) {
    await targetClient.query("ROLLBACK");
    throw error;
  } finally {
    await sourceClient.end();
    await targetClient.end();
  }
}

main().catch((error) => {
  console.error("Copy failed:", error.message);
  process.exit(1);
});
