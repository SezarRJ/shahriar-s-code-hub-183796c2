const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function migrate() {
  try {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    await client.connect();
    console.log('Connected to Supabase database via Connection Pooler (SSL enabled).');

    const sqlPath = path.join(__dirname, '../database/supabase/migrations/001_initial_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing migration: 001_initial_schema.sql...');
    await client.query(sql);
    console.log('Migration completed successfully!');
    await client.end();

  } catch (err) {
    console.error('Migration failed:');
    console.error(err);
    process.exit(1);
  }
}

migrate();
