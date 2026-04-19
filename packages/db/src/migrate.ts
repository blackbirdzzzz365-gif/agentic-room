import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDbPool } from "./index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

async function main() {
  const sqlDir = join(__dirname, "sql");
  const pool = getDbPool();

  const files = (await readdir(sqlDir)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await readFile(join(sqlDir, file), "utf8");
    await pool.query(sql);
    await pool.query(
      "INSERT INTO schema_migrations(version) VALUES ($1) ON CONFLICT (version) DO NOTHING",
      [file]
    );
  }

  await pool.end();
  console.log(`Applied ${files.length} migration(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
