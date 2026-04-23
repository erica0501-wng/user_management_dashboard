const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

async function inspect(dbPath) {
  const SQL = await initSqlJs();
  const file = fs.readFileSync(dbPath);
  const db = new SQL.Database(file);

  const tableRes = db.exec(`
    SELECT name
    FROM sqlite_master
    WHERE type='table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);

  const tableNames = tableRes.length === 0 ? [] : tableRes[0].values.map((v) => v[0]);

  console.log(`\n== ${dbPath} ==`);
  console.log(`tables=${tableNames.length}`);

  for (const t of tableNames) {
    const escaped = String(t).replace(/"/g, '""');
    const countRes = db.exec(`SELECT COUNT(*) AS c FROM "${escaped}"`);
    const c = countRes[0]?.values?.[0]?.[0] ?? 0;
    console.log(`${t}: ${c}`);
  }

  db.close();
}

async function main() {
  const candidates = [
    path.resolve(__dirname, "../prisma/prisma/dev.db"),
    path.resolve(__dirname, "../prisma/prisma/prisma/dev.db"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      await inspect(p);
    } else {
      console.log(`missing: ${p}`);
    }
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
