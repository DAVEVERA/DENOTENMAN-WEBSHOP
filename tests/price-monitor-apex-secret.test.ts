import assert from "node:assert/strict";
import test from "node:test";
import { assertNoEmbeddedScriptSecrets } from "../lib/price-monitor/script-secret-scan";

test("downloadable APEX scripts reject embedded OpenAI secrets", () => {
  assert.throws(
    () => assertNoEmbeddedScriptSecrets(`OPENAI_API_KEY = "${"sk-"}${"proj-"}exampleSecretValue123456789"`),
    /APEX_SCRIPT_CONTAINS_EMBEDDED_SECRET/
  );
  assert.throws(
    () => assertNoEmbeddedScriptSecrets(`API_KEY = "${"literal-"}secret-value-123456789"`),
    /APEX_SCRIPT_CONTAINS_EMBEDDED_SECRET/
  );
});

test("downloadable APEX scripts may read a secret from the environment", () => {
  assert.doesNotThrow(() => assertNoEmbeddedScriptSecrets(
    'OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()'
  ));
});
