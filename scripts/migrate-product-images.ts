import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { prisma } from "../lib/prisma";
import { resolveImageMigrationConfig } from "../lib/product-image-migration/config";
import {
  renderMigrationReportCsv,
  renderMigrationReportJson,
  renderMigrationReviewHtml,
  type ProductImageMigrationReport,
} from "../lib/product-image-migration/report";
import { runProductImageMigration } from "../lib/product-image-migration/runner";
import { ProductImageMigrationStorage } from "../lib/product-image-migration/storage";

loadEnvConfig(process.cwd());

type CliOptions = {
  dryRun: boolean;
  limit?: number;
  productId?: string;
  resume: boolean;
  force: boolean;
  reportPath?: string;
};

function optionValue(argument: string, name: string): string | undefined {
  const prefix = `--${name}=`;
  return argument.startsWith(prefix) ? argument.slice(prefix.length) : undefined;
}

export function parseMigrationArguments(arguments_: string[]): CliOptions {
  const knownFlags = new Set(["--dry-run", "--apply", "--resume", "--force"]);
  const unknown = arguments_.find(
    (argument) =>
      !knownFlags.has(argument) &&
      optionValue(argument, "limit") === undefined &&
      optionValue(argument, "product-id") === undefined &&
      optionValue(argument, "report") === undefined
  );
  if (unknown) throw new Error(`Unknown option: ${unknown}`);
  const dryRunFlag = arguments_.includes("--dry-run");
  const apply = arguments_.includes("--apply");
  if (dryRunFlag && apply) throw new Error("Choose either --dry-run or --apply, not both");
  const force = arguments_.includes("--force");
  const resume = arguments_.includes("--resume");
  if (force && resume) throw new Error("Choose either --resume or --force, not both");
  if (force && !apply) throw new Error("--force is only valid together with --apply");

  const rawLimit = arguments_.map((argument) => optionValue(argument, "limit")).find(Boolean);
  const limit = rawLimit === undefined ? undefined : Number(rawLimit);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 1_000)) {
    throw new Error("--limit must be an integer between 1 and 1000");
  }
  const productId = arguments_
    .map((argument) => optionValue(argument, "product-id"))
    .find((value): value is string => value !== undefined);
  if (productId !== undefined && !/^[A-Za-z0-9_-]{1,160}$/.test(productId)) {
    throw new Error("--product-id contains invalid characters");
  }
  const reportPath = arguments_
    .map((argument) => optionValue(argument, "report"))
    .find((value): value is string => value !== undefined);
  return {
    dryRun: !apply,
    limit,
    productId,
    resume,
    force,
    reportPath,
  };
}

function createRunId(): string {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${timestamp}-${randomBytes(4).toString("hex")}`;
}

async function writeReports(
  report: ProductImageMigrationReport,
  requestedPath: string | undefined
): Promise<{ json: string; csv: string; html: string }> {
  const defaultDirectory = path.join("output", "product-image-migration", report.runId);
  const resolved = path.resolve(requestedPath ?? path.join(defaultDirectory, "report.json"));
  const extension = path.extname(resolved).toLowerCase();
  const base = [".json", ".csv", ".html"].includes(extension)
    ? resolved.slice(0, -extension.length)
    : path.join(resolved, "report");
  const paths = { json: `${base}.json`, csv: `${base}.csv`, html: `${base}.html` };
  await mkdir(path.dirname(paths.json), { recursive: true });
  await Promise.all([
    writeFile(paths.json, renderMigrationReportJson(report), { encoding: "utf8", flag: "wx" }),
    writeFile(paths.csv, renderMigrationReportCsv(report), { encoding: "utf8", flag: "wx" }),
    writeFile(paths.html, renderMigrationReviewHtml(report, 10), { encoding: "utf8", flag: "wx" }),
  ]);
  return paths;
}

export async function main(): Promise<void> {
  const options = parseMigrationArguments(process.argv.slice(2));
  const config = resolveImageMigrationConfig();
  const runId = createRunId();
  const report = await runProductImageMigration(
    { prisma, storage: new ProductImageMigrationStorage(), config },
    { ...options, runId }
  );
  const paths = await writeReports(report, options.reportPath);
  const counts = Object.fromEntries(
    ["success", "skipped", "needs_manual_review", "failed"].map((status) => [
      status,
      report.results.filter((result) => result.status === status).length,
    ])
  );
  console.log(
    JSON.stringify(
      {
        mode: report.dryRun ? "dry-run" : "apply",
        processingVersion: report.processingVersion,
        runId: report.runId,
        processed: report.results.length,
        counts,
        reports: paths,
      },
      null,
      2
    )
  );
  if (report.results.some((result) => result.status === "failed")) {
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
