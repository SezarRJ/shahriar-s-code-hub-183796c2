const { Client } = require('pg');
require('dotenv').config();

async function debug() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to DB.');

    const tenants = await client.query('SELECT * FROM tenants');
    console.log('Tenants:', tenants.rows);

    const users = await client.query('SELECT id, name, email, tenant_id, role FROM users');
    console.log('Users:', users.rows);

    const projects = await client.query('SELECT id, name, tenant_id FROM projects');
    console.log('Projects:', projects.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}
debug();
