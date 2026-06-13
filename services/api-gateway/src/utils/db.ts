import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error', err);
  process.exit(-1);
});

export interface TenantContext {
  tenant_id: string;
  role: string;
  user_id: string;
}

/**
 * Get a database client with tenant context set for RLS.
 * Remember to call client.release() after use.
 */
export async function getClientWithContext(context: TenantContext) {
  const client = await pool.connect();
  await client.query(`SET app.current_tenant_id = '${context.tenant_id}'`);
  await client.query(`SET app.current_user_role = '${context.role}'`);
  await client.query(`SET app.current_user_id = '${context.user_id}'`);
  return client;
}

export default pool;
