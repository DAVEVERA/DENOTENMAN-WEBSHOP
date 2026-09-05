// Public endpoint identity only. Credentials must never appear in diagnostics.
const PRODUCTION_DATABASE_HOST = 'ep-small-pond-b2su7ww7.c-6.eu-central-1.aws.neon.tech';

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
  const hostname = target.hostname.toLowerCase().replace('-pooler.', '.');
  if (hostname !== PRODUCTION_DATABASE_HOST) return;

  const isTest = operation === 'test' || env.NODE_ENV === 'test' || Boolean(env.NODE_TEST_CONTEXT);
  const isDevelopment = ['development', 'seed', 'migrate-development'].includes(operation) || env.NODE_ENV === 'development';
  const isLiveRuntime = operation === 'runtime' && env.NODE_ENV === 'production'
    && env.K_SERVICE === 'denotenman-webshop'
    && /^denotenman-webshop-/.test(env.K_REVISION || '');
  const isControlledRelease = ['runtime', 'build', 'migrate-release'].includes(operation)
    && env.DATABASE_ACCESS_CONTEXT === 'release'
    && /^[0-9a-f]{40}$/.test(env.DEPLOYMENT_VERSION || '');

  if (!isTest && !isDevelopment && (isLiveRuntime || isControlledRelease)) return;
  throw new Error('PRODUCTIEDATABASE_GEBLOKKEERD: de huidige Neon-database is uitsluitend voor de live webshop en gecontroleerde releases. Stel voor lokaal werken en tests een aparte DATABASE_URL in.');
}

module.exports = { assertDatabaseAccess, PRODUCTION_DATABASE_HOST };
