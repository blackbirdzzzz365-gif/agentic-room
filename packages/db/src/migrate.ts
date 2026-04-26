import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDbPool } from "./index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

async function main() {
  const sqlDir = join(__dirname, "sql");
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = (await readdir(sqlDir)).filter((file) => file.endsWith(".sql")).sort();
  const appliedResult = await pool.query<{ version: string }>("SELECT version FROM schema_migrations");
  const applied = new Set(appliedResult.rows.map((row) => row.version));
  let appliedCount = 0;
  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = await readFile(join(sqlDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations(version) VALUES ($1) ON CONFLICT (version) DO NOTHING",
        [file]
      );
      await client.query("COMMIT");
      appliedCount += 1;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  await pool.end();
  console.log(`Applied ${appliedCount} migration(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
