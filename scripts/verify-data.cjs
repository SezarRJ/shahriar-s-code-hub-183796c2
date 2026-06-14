const { Client } = require('pg');
require('dotenv').config();

async function verify() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('--- DB VERIFICATION ---');

    const tenants = await client.query('SELECT * FROM tenants');
    console.log('Tenants count:', tenants.rowCount);
    console.log('Tenants:', tenants.rows);

    const users = await client.query('SELECT id, name, email, tenant_id, role FROM users');
    console.log('Users count:', users.rowCount);
    console.log('Users:', users.rows);

    const projects = await client.query('SELECT id, name, tenant_id FROM projects');
    console.log('Projects count:', projects.rowCount);
    console.log('Projects:', projects.rows);

    const zones = await client.query('SELECT count(*) FROM zones');
    console.log('Zones count:', zones.rows[0].count);

    const points = await client.query('SELECT count(*) FROM capture_points');
    console.log('Capture Points count:', points.rows[0].count);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}
verify();
