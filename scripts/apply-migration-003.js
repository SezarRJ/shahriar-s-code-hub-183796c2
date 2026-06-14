const { Client } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function apply() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const sql = fs.readFileSync(path.join(__dirname, '..', 'database/supabase/migrations/003_ai_verification_and_health.sql'), 'utf8');
    await client.query(sql);
    console.log('Migration 003 applied successfully.');
  } catch (err) {
    console.error('Error applying migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}
apply();
