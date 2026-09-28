import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertDatabaseAccess,
  PRODUCTION_CLOUD_SQL_INSTANCE,
  PRODUCTION_CLOUD_SQL_IP,
  PRODUCTION_DATABASE_HOST,
} from '../lib/database-access.cjs';
const production = { DATABASE_URL: `postgresql://user:secret@${PRODUCTION_DATABASE_HOST}/neondb` };
const release = { ...production, DATABASE_ACCESS_CONTEXT: 'release', DEPLOYMENT_VERSION: 'a'.repeat(40) };

test('production refuses local defaults, starts, seeds, migrations and tests', () => {
  for (const operation of ['runtime', 'development', 'seed', 'migrate-development', 'test', 'build']) {
    assert.throws(() => assertDatabaseAccess(production, operation), /PRODUCTIEDATABASE_GEBLOKKEERD/);
  }
});
test('pooled endpoint and different database names do not bypass production protection', () => {
  const pooled = PRODUCTION_DATABASE_HOST.replace('.', '-pooler.');
  assert.throws(() => assertDatabaseAccess({ DATABASE_URL: `postgresql://u:p@${pooled}/other` }), /PRODUCTIEDATABASE_GEBLOKKEERD/);
});
test('release access requires an explicit context and complete commit identity', () => {
  for (const operation of ['build', 'migrate-release', 'runtime']) assert.doesNotThrow(() => assertDatabaseAccess(release, operation));
  assert.throws(() => assertDatabaseAccess({ ...release, DEPLOYMENT_VERSION: 'short' }, 'build'));
  assert.throws(() => assertDatabaseAccess({ ...production, NODE_ENV: 'production' }));
});
test('live Cloud Run runtime is accepted, other services and local starts are refused', () => {
  const live = { ...production, NODE_ENV: 'production', K_SERVICE: 'denotenman-webshop', K_REVISION: 'denotenman-webshop-00170-rz8' };
  assert.doesNotThrow(() => assertDatabaseAccess(live));
  assert.throws(() => assertDatabaseAccess({ ...live, K_SERVICE: 'other-service' }));
  assert.throws(() => assertDatabaseAccess({ ...live, K_REVISION: undefined }));
});
test('tests and development cannot use release context to access production', () => {
  for (const operation of ['test', 'development', 'seed', 'migrate-development']) assert.throws(() => assertDatabaseAccess(release, operation));
  assert.throws(() => assertDatabaseAccess({ ...release, NODE_TEST_CONTEXT: 'child-v8' }));
  assert.throws(() => assertDatabaseAccess({ ...release, NODE_ENV: 'test' }));
  assert.throws(() => assertDatabaseAccess({ ...release, NODE_ENV: 'development' }));
});
test('every route to the Cloud SQL production instance is treated as production', () => {
  const targets = [
    `postgresql://webshop:secret@localhost/neondb?host=/cloudsql/${PRODUCTION_CLOUD_SQL_INSTANCE}&connection_limit=3`,
    `postgresql://webshop:secret@localhost/other?host=/cloudsql/${PRODUCTION_CLOUD_SQL_INSTANCE}`,
    `postgresql://webshop:secret@${PRODUCTION_CLOUD_SQL_IP}:5432/neondb`,
    'postgresql://webshop:secret@127.0.0.1:54329/neondb',
    'postgresql://webshop:secret@localhost:5432/NEONDB',
    'postgresql://webshop:secret@[::1]:5432/neondb',
    'postgresql://webshop:secret@cloudsql-proxy:5432/neondb?connection_limit=3',
  ];
  for (const DATABASE_URL of targets) {
    for (const operation of ['runtime', 'development', 'seed', 'migrate-development', 'test', 'build']) {
      assert.throws(() => assertDatabaseAccess({ DATABASE_URL }, operation), /PRODUCTIEDATABASE_GEBLOKKEERD/);
    }
    const releaseTarget = { DATABASE_URL, DATABASE_ACCESS_CONTEXT: 'release', DEPLOYMENT_VERSION: 'b'.repeat(40) };
    for (const operation of ['build', 'migrate-release', 'runtime']) {
      assert.doesNotThrow(() => assertDatabaseAccess(releaseTarget, operation));
    }
    const live = { DATABASE_URL, NODE_ENV: 'production', K_SERVICE: 'denotenman-webshop', K_REVISION: 'denotenman-webshop-00200-abc' };
    assert.doesNotThrow(() => assertDatabaseAccess(live));
  }
});
test('the local Docker development database is not mistaken for production', () => {
  assert.doesNotThrow(() => assertDatabaseAccess({ DATABASE_URL: 'postgresql://denotenman:denotenman@127.0.0.1:15432/denotenman_dev' }, 'test'));
  assert.doesNotThrow(() => assertDatabaseAccess({ DATABASE_URL: 'postgresql://denotenman:denotenman@localhost:15432/denotenman_dev' }, 'development'));
});
test('separate development targets work and invalid URLs never reveal credentials', () => {
  for (const host of ['127.0.0.1:5432', 'localhost:5432', 'development.example.test']) {
    assert.doesNotThrow(() => assertDatabaseAccess({ DATABASE_URL: `postgresql://u:p@${host}/test` }, 'test'));
  }
  assert.throws(() => assertDatabaseAccess({}), /DATABASE_URL ontbreekt/);
  assert.throws(() => assertDatabaseAccess({ DATABASE_URL: 'secret-value' }), error => !error.message.includes('secret-value'));
});
