import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

test("Design Studio exposes both CopyWriter page routes", () => {
  const pages = [
    "app/admin/(dashboard)/design-studio/copywriter/page.tsx",
    "app/admin/(dashboard)/design-studio/copywriter/[productId]/page.tsx",
  ];

  for (const page of pages) assert.equal(existsSync(join(process.cwd(), page)), true, `${page} ontbreekt`);
});

test("the dynamic CopyWriter page awaits Next 16 params", () => {
  const source = readFileSync(
    join(process.cwd(), "app/admin/(dashboard)/design-studio/copywriter/[productId]/page.tsx"),
    "utf8",
  );

  assert.match(source, /params: Promise<\{ productId: string \}>/);
  assert.match(source, /await params/);
});
