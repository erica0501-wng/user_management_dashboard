const { spawnSync } = require("child_process");

function runStep(name, command, args) {
  console.log(`\n=== ${name} ===`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error(`${name} failed with exit code ${result.status}`);
  }
}

function main() {
  runStep(
    "Inspect local SQLite candidates",
    "node",
    ["scripts/inspect-sqlite.js"]
  );

  runStep(
    "Copy SQLite data to current DATABASE_URL",
    "node",
    ["-r", "dotenv/config", "scripts/copy-sqlite-to-postgres.js"]
  );

  runStep(
    "Verify target row counts",
    "node",
    ["-r", "dotenv/config", "scripts/count-target-rows.js"]
  );

  console.log("\nMigration pipeline completed successfully.");
}

try {
  main();
} catch (error) {
  console.error(`\nMigration pipeline failed: ${error.message}`);
  process.exit(1);
}
