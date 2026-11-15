const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test') });
const { Client } = require('pg');

async function run() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT) || 5432;
  const password = process.env.DB_PASSWORD || 'change_me_in_production';

  // Try connecting as configured user or erp_user
  let adminClient;
  const candidates = [process.env.DB_USER || 'postgres', 'erp_user', 'postgres'];
  for (const user of candidates) {
    try {
      const client = new Client({
        host,
        port,
        user,
        password,
        database: 'postgres',
      });
      await client.connect();
      console.log(`Connected to default postgres database as "${user}".`);
      adminClient = client;
      break;
    } catch {
      // try next
    }
  }

  if (!adminClient) {
    throw new Error('Could not connect to postgres database with provided credentials.');
  }

  // Ensure postgres role exists so that postgres user in DATABASE_URL works seamlessly
  try {
    const userCheck = await adminClient.query("SELECT 1 FROM pg_roles WHERE rolname = 'postgres'");
    if (userCheck.rowCount === 0) {
      await adminClient.query(`CREATE ROLE postgres WITH SUPERUSER LOGIN PASSWORD '${password}';`);
      console.log('Created "postgres" role with SUPERUSER privileges.');
    }
  } catch (err) {
    console.log('Postgres role check/creation:', err.message);
  }

  // Create sabir_plastic_erp_test database
  try {
    await adminClient.query('CREATE DATABASE sabir_plastic_erp_test;');
    console.log('Database "sabir_plastic_erp_test" created successfully.');
  } catch (err) {
    if (err.code === '42P04' || (err.message && err.message.includes('already exists'))) {
      console.log('Database "sabir_plastic_erp_test" already exists. Proceeding.');
    } else {
      console.error('Error creating database:', err);
      throw err;
    }
  } finally {
    await adminClient.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
