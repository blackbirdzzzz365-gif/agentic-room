import { Pool, type PoolClient } from "pg";

let pool: Pool | null = null;

export function getDbPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  return pool;
}

export async function withTransaction<T>(handler: (client: PoolClient) => Promise<T>) {
  const activePool = getDbPool();
  const client = await activePool.connect();
  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
