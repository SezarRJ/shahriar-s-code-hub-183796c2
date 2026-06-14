const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function seed() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    const sqlPath = path.join(__dirname, '..', 'database/supabase/seeds/demo_projects.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing seed script...');
    await client.query(sql);
    console.log('Seed successfully applied!');
  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
