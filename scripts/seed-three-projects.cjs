const { Client } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function seed() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const sql = fs.readFileSync(path.join(__dirname, '..', 'database/supabase/seeds/three_demo_projects.sql'), 'utf8');
    await client.query(sql);
    console.log('Three demo projects seeded successfully!');
  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}
seed();
