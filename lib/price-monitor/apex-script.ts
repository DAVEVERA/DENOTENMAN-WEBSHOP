import "server-only";

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertNoEmbeddedScriptSecrets } from "@/lib/price-monitor/script-secret-scan";
import type { PriceMonitorApexScriptInfo } from "@/lib/price-monitor/types";

const APEX_SCRIPT_FILE = "app/admin/(dashboard)/prijsmonitor/apex.py";
const MAX_SCRIPT_BYTES = 100_000;

export function getApexScriptInfo(): PriceMonitorApexScriptInfo {
  const scriptPath = join(process.cwd(), ...APEX_SCRIPT_FILE.split("/"));
  const content = readFileSync(scriptPath, "utf8");
  if (Buffer.byteLength(content, "utf8") > MAX_SCRIPT_BYTES) {
    throw new Error("APEX_SCRIPT_TOO_LARGE");
  }
  assertNoEmbeddedScriptSecrets(content);
  return {
    filename: APEX_SCRIPT_FILE,
    content,
    sha256: createHash("sha256").update(content, "utf8").digest("hex"),
  };
}
