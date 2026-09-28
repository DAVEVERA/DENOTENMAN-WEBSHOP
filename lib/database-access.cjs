// Public endpoint identity only. Credentials must never appear in diagnostics.
const PRODUCTION_DATABASE_HOST = 'ep-small-pond-b2su7ww7.c-6.eu-central-1.aws.neon.tech';
// Cloud SQL production target during and after the Neon migration.
const PRODUCTION_CLOUD_SQL_INSTANCE = 'project-5dc79156-4200-4528-bfc:europe-west4:denotenman-db';
const PRODUCTION_CLOUD_SQL_IP = '34.7.221.81';
const PRODUCTION_DATABASE_NAME = 'neondb';
// Loopback plus the Cloud SQL Auth Proxy container that Cloud Build steps use
// (scripts/ci/cloudsql-url.sh).
const PROXY_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', 'cloudsql-proxy']);

function isProductionTarget(target) {
  const hostname = target.hostname.toLowerCase().replace('-pooler.', '.');
  if (hostname === PRODUCTION_DATABASE_HOST || hostname === PRODUCTION_CLOUD_SQL_IP) return true;
  // Cloud Run and Prisma reach Cloud SQL through a unix socket: `?host=/cloudsql/<instance>`.
  const socketHost = (target.searchParams.get('host') || '').toLowerCase();
  if (socketHost.includes(PRODUCTION_CLOUD_SQL_INSTANCE)) return true;
  // A Cloud SQL Auth Proxy looks like any local host; the production database name gives it away.
  // Local development databases therefore use a different name (see docker-compose.dev.yml).
  const database = decodeURIComponent(target.pathname.replace(/^\//, '')).toLowerCase();
  return PROXY_HOSTS.has(hostname) && database === PRODUCTION_DATABASE_NAME;
}

function assertDatabaseAccess(env, operation = 'runtime') {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL ontbreekt. Configureer een aparte ontwikkel- of testdatabase; productie is geen lokale standaard.');
  }
  let target;
  try {
    target = new URL(env.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(target.protocol)) throw new Error();
  } catch {
    throw new Error('DATABASE_URL is geen geldige PostgreSQL-verbinding. De verbindingswaarde wordt niet getoond.');
  }
  if (!isProductionTarget(target)) return;

  const isTest = operation === 'test' || env.NODE_ENV === 'test' || Boolean(env.NODE_TEST_CONTEXT);
  const isDevelopment = ['development', 'seed', 'migrate-development'].includes(operation) || env.NODE_ENV === 'development';
  const isLiveRuntime = operation === 'runtime' && env.NODE_ENV === 'production'
    && env.K_SERVICE === 'denotenman-webshop'
    && /^denotenman-webshop-/.test(env.K_REVISION || '');
  const isControlledRelease = ['runtime', 'build', 'migrate-release'].includes(operation)
    && env.DATABASE_ACCESS_CONTEXT === 'release'
    && /^[0-9a-f]{40}$/.test(env.DEPLOYMENT_VERSION || '');

  if (!isTest && !isDevelopment && (isLiveRuntime || isControlledRelease)) return;
  throw new Error('PRODUCTIEDATABASE_GEBLOKKEERD: de productiedatabase (Neon of Cloud SQL) is uitsluitend voor de live webshop en gecontroleerde releases. Stel voor lokaal werken en tests een aparte DATABASE_URL in.');
}

module.exports = {
  assertDatabaseAccess,
  PRODUCTION_DATABASE_HOST,
  PRODUCTION_CLOUD_SQL_INSTANCE,
  PRODUCTION_CLOUD_SQL_IP,
};
