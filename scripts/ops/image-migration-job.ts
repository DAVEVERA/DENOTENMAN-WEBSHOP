/**
 * Cloud Run job entrypoint for the product image migration.
 *
 * The migration itself lives in `scripts/migrate-product-images.ts` and stays
 * the single source of truth; this wrapper only does the things a scheduled,
 * unattended run needs and a laptop run does not:
 *
 *   - fail fast, with a readable reason, when the job is misconfigured, rather
 *     than surfacing it as an opaque Prisma or Storage error an hour in;
 *   - refuse to write anything unless an explicit confirmation token matching
 *     the processing version is present, so `dry-run` is what a bare execution
 *     does and applying is always a deliberate act;
 *   - reach Postgres on its direct endpoint instead of the pooled one, because
 *     the runner holds advisory locks inside transactions;
 *   - persist the run's reports to object storage, since a job's filesystem is
 *     gone the moment the task ends.
 *
 * Re-running is always safe. `shouldSkipProcessedImage` skips any image whose
 * succeeded record still matches the current source generation, and every
 * success commits in its own transaction, so a cancelled or timed-out task
 * loses no completed work and the retry simply continues where it stopped.
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Storage } from "@google-cloud/storage";
import { IMAGE_PROCESSING_VERSION } from "../../lib/product-image-migration/config";

type JobMode = "dry-run" | "apply";

export type JobPlan = {
  mode: JobMode;
  force: boolean;
  limit?: number;
  productId?: string;
  reportPrefix: string;
  executionId: string;
};

const migrationScript = "scripts/migrate-product-images.ts";
const reportNames = ["report.json", "report.csv", "report.html"] as const;

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is not configured for this job`);
  return value;
}

/**
 * Mirrors `libpq_url` in scripts/ci/cloudsql-url.sh: Neon's pooled endpoint
 * multiplexes transactions, which does not suit a run that takes advisory
 * locks and holds a transaction per committed image.
 */
export function directDatabaseUrl(url: string): string {
  return url.replace(/[\s\r\n]+$/, "").replace("-pooler.", ".");
}

/**
 * Every write is gated on a token naming the processing version, so a token
 * copied from an older runbook cannot silently authorise a different pipeline.
 */
export function planFromEnvironment(
  environment: NodeJS.ProcessEnv,
  processingVersion: string = IMAGE_PROCESSING_VERSION
): JobPlan {
  const rawMode = (environment.IMAGE_MIGRATION_JOB_MODE ?? "dry-run").trim();
  if (rawMode !== "dry-run" && rawMode !== "apply") {
    throw new Error('IMAGE_MIGRATION_JOB_MODE must be either "dry-run" or "apply"');
  }
  const confirm = environment.IMAGE_MIGRATION_JOB_CONFIRM?.trim() ?? "";
  const force = (environment.IMAGE_MIGRATION_JOB_FORCE ?? "").trim() === "true";

  if (rawMode === "apply") {
    const expected = force ? `FORCE-${processingVersion}` : `APPLY-${processingVersion}`;
    if (confirm !== expected) {
      throw new Error(
        `Refusing to write: set IMAGE_MIGRATION_JOB_CONFIRM=${expected} to apply${force ? " with --force" : ""}`
      );
    }
  } else if (force) {
    throw new Error("IMAGE_MIGRATION_JOB_FORCE requires IMAGE_MIGRATION_JOB_MODE=apply");
  }

  const rawLimit = environment.IMAGE_MIGRATION_JOB_LIMIT?.trim();
  let limit: number | undefined;
  if (rawLimit) {
    limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
      throw new Error("IMAGE_MIGRATION_JOB_LIMIT must be an integer between 1 and 1000");
    }
  }

  const productId = environment.IMAGE_MIGRATION_JOB_PRODUCT_ID?.trim() || undefined;
  if (productId !== undefined && !/^[A-Za-z0-9_-]{1,160}$/.test(productId)) {
    throw new Error("IMAGE_MIGRATION_JOB_PRODUCT_ID contains invalid characters");
  }

  const reportPrefix = (environment.IMAGE_MIGRATION_JOB_REPORT_PREFIX ?? "ops/image-migration")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  const segments = reportPrefix.split("/");
  // Confined to the ops namespace on purpose: reports are written with no
  // generation precondition, so no configuration should be able to aim them at
  // products/ and overwrite a product image with a CSV.
  if (
    reportPrefix.length > 200 ||
    segments[0] !== "ops" ||
    segments.length < 2 ||
    segments.some((segment) => !/^[A-Za-z0-9._-]+$/.test(segment) || segment === "." || segment === "..")
  ) {
    throw new Error(
      "IMAGE_MIGRATION_JOB_REPORT_PREFIX must be an ops/<name> path of safe path segments"
    );
  }

  return {
    mode: rawMode,
    force,
    limit,
    productId,
    reportPrefix,
    // Grouping reports under the execution makes a report traceable back to
    // the exact task in Cloud Run logs; a local run just gets a timestamp.
    executionId:
      environment.CLOUD_RUN_EXECUTION?.trim() ||
      `local-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  };
}

export function migrationArguments(plan: JobPlan, reportPath: string): string[] {
  const args = [plan.mode === "apply" ? "--apply" : "--dry-run"];
  if (plan.force) args.push("--force");
  else if (plan.mode === "apply") args.push("--resume");
  if (plan.limit !== undefined) args.push(`--limit=${plan.limit}`);
  if (plan.productId) args.push(`--product-id=${plan.productId}`);
  args.push(`--report=${reportPath}`);
  return args;
}

/** Resolves with the child's exit code instead of throwing, so reports upload either way. */
function runMigration(args: string[], databaseUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", migrationScript, ...args],
      {
        stdio: "inherit",
        env: { ...process.env, DATABASE_URL: databaseUrl },
      }
    );

    // Cloud Run sends SIGTERM when a task is cancelled or times out. Passing it
    // on lets the runner stop between images; the in-flight image simply has no
    // record yet and is picked up by the next execution.
    const forward = (signal: NodeJS.Signals) => () => {
      if (!child.killed) child.kill(signal);
    };
    const onTerm = forward("SIGTERM");
    const onInt = forward("SIGINT");
    process.on("SIGTERM", onTerm);
    process.on("SIGINT", onInt);

    child.on("error", (error) => {
      process.off("SIGTERM", onTerm);
      process.off("SIGINT", onInt);
      reject(error);
    });
    child.on("close", (code, signal) => {
      process.off("SIGTERM", onTerm);
      process.off("SIGINT", onInt);
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}

async function uploadReports(
  bucketName: string,
  plan: JobPlan,
  reportDirectory: string
): Promise<string[]> {
  const bucket = new Storage().bucket(bucketName);
  const destinations: string[] = [];

  for (const name of reportNames) {
    const source = path.join(reportDirectory, name);
    let body: Buffer;
    try {
      body = await readFile(source);
    } catch {
      // A run that failed before writing has nothing to upload for that format.
      continue;
    }
    const destination = `${plan.reportPrefix}/${plan.executionId}/${name}`;
    await bucket.file(destination).save(body, {
      resumable: false,
      metadata: {
        contentType:
          name.endsWith(".json") ? "application/json"
          : name.endsWith(".csv") ? "text/csv"
          : "text/html",
        cacheControl: "private, max-age=0, no-store",
      },
    });
    destinations.push(`gs://${bucketName}/${destination}`);
  }

  return destinations;
}

export async function main(environment: NodeJS.ProcessEnv = process.env): Promise<number> {
  // Checked before any work so a misconfigured job fails in seconds.
  const databaseUrl = required(environment, "DATABASE_URL");
  const bucketName = required(environment, "GCS_BUCKET");
  const cdnBaseUrl = required(environment, "CDN_BASE_URL");
  try {
    new URL(cdnBaseUrl);
  } catch {
    throw new Error("CDN_BASE_URL is not an absolute URL");
  }
  if (required(environment, "DATABASE_ACCESS_CONTEXT") !== "release") {
    throw new Error("DATABASE_ACCESS_CONTEXT must be 'release' for this job");
  }
  if (!/^[0-9a-f]{40}$/.test(required(environment, "DEPLOYMENT_VERSION"))) {
    throw new Error("DEPLOYMENT_VERSION must be the 40-character commit SHA this image was built from");
  }

  const plan = planFromEnvironment(environment);
  const reportDirectory = await mkdtemp(path.join(tmpdir(), "image-migration-"));

  console.log(
    JSON.stringify({
      event: "image-migration-job.start",
      mode: plan.mode,
      force: plan.force,
      processingVersion: IMAGE_PROCESSING_VERSION,
      limit: plan.limit ?? null,
      productId: plan.productId ?? null,
      executionId: plan.executionId,
      reportDestination: `gs://${bucketName}/${plan.reportPrefix}/${plan.executionId}/`,
    })
  );

  let exitCode: number;
  try {
    exitCode = await runMigration(
      migrationArguments(plan, path.join(reportDirectory, "report.json")),
      directDatabaseUrl(databaseUrl)
    );
  } finally {
    // Reports are uploaded even when the migration exits non-zero: a failed run
    // is exactly when its report matters most.
    try {
      const uploaded = await uploadReports(bucketName, plan, reportDirectory);
      console.log(
        JSON.stringify({ event: "image-migration-job.reports", uploaded })
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "image-migration-job.reports-failed",
          reason: error instanceof Error ? error.message : String(error),
        })
      );
    }
    await rm(reportDirectory, { recursive: true, force: true }).catch(() => undefined);
  }

  console.log(
    JSON.stringify({ event: "image-migration-job.finish", mode: plan.mode, exitCode })
  );
  return exitCode;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      // Never echo the environment: DATABASE_URL lives there.
      console.error(
        JSON.stringify({
          event: "image-migration-job.misconfigured",
          reason: error instanceof Error ? error.message : String(error),
        })
      );
      process.exitCode = 2;
    });
}
