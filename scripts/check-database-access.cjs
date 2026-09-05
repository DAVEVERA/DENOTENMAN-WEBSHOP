const { loadEnvConfig } = require('@next/env');
const { assertDatabaseAccess } = require('../lib/database-access.cjs');

const operation = process.argv[2] || 'development';
loadEnvConfig(process.cwd(), operation === 'development');
try {
  assertDatabaseAccess(process.env, operation);
  console.log(`Databasecontrole geslaagd (${operation}).`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
