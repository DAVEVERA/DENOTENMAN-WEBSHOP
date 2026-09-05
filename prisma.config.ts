import { defineConfig } from "prisma/config";
import { loadEnvConfig } from "@next/env";
import { assertDatabaseAccess } from "./lib/database-access.cjs";

// Prisma 6.12 config is evaluated before any CLI command accesses the database.
// Keep generation/validation offline, but also protect direct `npx prisma` use.
const args = process.argv.slice(2);
const offlineCommands = new Set(["generate", "validate", "format", "version", "-v", "--version", "-h", "--help"]);
const command = args[0];
loadEnvConfig(process.cwd(), false);
if (command && offlineCommands.has(command) && !args.includes("--sql") && !process.env.DATABASE_URL) {
  // These operations parse the schema only; this inert URL is never connected.
  process.env.DATABASE_URL = "postgresql://offline:offline@127.0.0.1:1/offline";
}
if (command && (!offlineCommands.has(command) || args.includes("--sql")) && !args.includes("--help") && !args.includes("-h")) {
  const operation = command === "migrate" && args[1] === "deploy"
    ? "migrate-release"
    : "migrate-development";
  assertDatabaseAccess(process.env, operation);
  // Explicit URL overrides must obey the same boundary as DATABASE_URL.
  const urlFlags = ["--url", "--from-url", "--to-url", "--shadow-database-url"];
  for (let index = 0; index < args.length; index++) {
    for (const flag of urlFlags) {
      const value = args[index] === flag ? args[index + 1]
        : args[index].startsWith(`${flag}=`) ? args[index].slice(flag.length + 1) : null;
      if (value) assertDatabaseAccess({ ...process.env, DATABASE_URL: value }, operation);
    }
  }
}

export default defineConfig({ earlyAccess: true, schema: "prisma/schema.prisma" });
