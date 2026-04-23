const { Client } = require("pg");

async function main() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("Missing DATABASE_URL");

  const parsed = new URL(rawUrl);
  const schema = parsed.searchParams.get("schema") || "public";
  if (!parsed.searchParams.has("sslmode")) parsed.searchParams.set("sslmode", "require");
  parsed.searchParams.set("uselibpqcompat", "true");

  const client = new Client({
    connectionString: parsed.toString(),
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  const tableResult = await client.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `,
    [schema]
  );

  console.log(`schema=${schema}, tables=${tableResult.rows.length}`);

  for (const row of tableResult.rows) {
    const table = row.table_name;
    const sql = `SELECT COUNT(*)::int AS c FROM "${schema}"."${table}"`;
    const count = await client.query(sql);
    console.log(`${table}: ${count.rows[0].c}`);
  }

  await client.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
