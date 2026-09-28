// Read-only comparison of two PostgreSQL databases after a dump/restore.
// Compares per table: row count and a content checksum; plus sequences and
// applied Prisma migrations. Exits 1 on any difference.
//
// Usage: SOURCE_DATABASE_URL=... TARGET_DATABASE_URL=... node scripts/compare-databases.cjs
// Both URLs pass the production guard as a release step, so production is only
// reachable with DATABASE_ACCESS_CONTEXT=release and a full DEPLOYMENT_VERSION.
const { Client } = require("pg");
const { assertDatabaseAccess } = require("../lib/database-access.cjs");

const quoteIdent = (name) => `"${String(name).replace(/"/g, '""')}"`;

async function snapshot(label, connectionString) {
  assertDatabaseAccess({ ...process.env, DATABASE_URL: connectionString }, "migrate-release");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const tables = await client.query(
      "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name"
    );
    const result = { tables: {}, sequences: {}, migrations: [], collation: null };
    for (const { table_name: table } of tables.rows) {
      const ident = `public.${quoteIdent(table)}`;
      const row = await client.query(
        `select count(*)::bigint as rows, coalesce(md5(string_agg(t::text, '|' order by t::text)), '') as checksum from ${ident} t`
      );
      result.tables[table] = { rows: row.rows[0].rows, checksum: row.rows[0].checksum };
    }
    const sequences = await client.query(
      "select sequencename, last_value from pg_sequences where schemaname = 'public' order by sequencename"
    );
    for (const sequence of sequences.rows) {
      // last_value is null until the sequence is first used.
      result.sequences[sequence.sequencename] = String(sequence.last_value ?? "ongebruikt");
    }
    if (result.tables._prisma_migrations) {
      const migrations = await client.query(
        "select migration_name from public._prisma_migrations where finished_at is not null and rolled_back_at is null order by migration_name"
      );
      result.migrations = migrations.rows.map((migration) => migration.migration_name);
    }
    const collation = await client.query("select datcollate from pg_database where datname = current_database()");
    result.collation = collation.rows[0].datcollate;
    await client.query("COMMIT");
    console.log(`${label}: ${Object.keys(result.tables).length} tabellen, ${Object.keys(result.sequences).length} sequences, ${result.migrations.length} migraties, collatie ${result.collation}`);
    return result;
  } finally {
    await client.end();
  }
}

function compare(source, target) {
  const differences = [];
  const tables = new Set([...Object.keys(source.tables), ...Object.keys(target.tables)]);
  for (const table of [...tables].sort()) {
    const a = source.tables[table];
    const b = target.tables[table];
    if (!a || !b) differences.push(`tabel ${table}: ontbreekt in ${a ? "doel" : "bron"}`);
    else if (a.rows !== b.rows) differences.push(`tabel ${table}: ${a.rows} rijen in bron, ${b.rows} in doel`);
    else if (a.checksum !== b.checksum) differences.push(`tabel ${table}: inhoud verschilt (zelfde aantal rijen)`);
  }
  const sequences = new Set([...Object.keys(source.sequences), ...Object.keys(target.sequences)]);
  for (const sequence of [...sequences].sort()) {
    if (source.sequences[sequence] !== target.sequences[sequence]) {
      differences.push(`sequence ${sequence}: bron ${source.sequences[sequence] ?? "ontbreekt"}, doel ${target.sequences[sequence] ?? "ontbreekt"}`);
    }
  }
  if (source.migrations.join(",") !== target.migrations.join(",")) {
    differences.push(`migraties verschillen: bron ${source.migrations.length}, doel ${target.migrations.length}`);
  }
  if (source.collation !== target.collation) {
    differences.push(`collatie verschilt: bron ${source.collation}, doel ${target.collation}`);
  }
  return differences;
}

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const targetUrl = process.env.TARGET_DATABASE_URL;
  if (!sourceUrl || !targetUrl) {
    throw new Error("Zet SOURCE_DATABASE_URL en TARGET_DATABASE_URL.");
  }
  const source = await snapshot("bron", sourceUrl);
  const target = await snapshot("doel", targetUrl);
  const differences = compare(source, target);
  const totalRows = Object.values(source.tables).reduce((sum, table) => sum + Number(table.rows), 0);
  if (differences.length > 0) {
    console.error(`VERSCHIL GEVONDEN (${differences.length}):`);
    for (const difference of differences) console.error(`- ${difference}`);
    process.exitCode = 1;
    return;
  }
  console.log(`GELIJK: ${Object.keys(source.tables).length} tabellen, ${totalRows} rijen, alle checksums, sequences en migraties identiek.`);
}

main().catch((error) => {
  // pg errors never contain the connection string; guard errors never echo it.
  console.error(`Vergelijking mislukt: ${error.message}`);
  process.exitCode = 1;
});
