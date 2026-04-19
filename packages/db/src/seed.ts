import "dotenv/config";
import { getDbPool } from "./index.js";

async function main() {
  const pool = getDbPool();
  await pool.query("SELECT 1");
  await pool.end();
  console.log("Seed noop completed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
