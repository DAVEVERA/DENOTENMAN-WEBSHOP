import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_DIRECTORY = path.resolve(
  process.cwd(),
  "components",
  "home",
  "denotenman-hero-lepelpanorama"
);

const CONTENT_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
]);

function resolveSourceAsset(parts: string[]): string | null {
  if (parts.length < 1 || parts.length > 2) return null;
  if (parts.some((part) => !part || part === "." || part === ".." || part.includes("\0"))) {
    return null;
  }

  const candidate = path.resolve(SOURCE_DIRECTORY, ...parts);
  const sourcePrefix = `${SOURCE_DIRECTORY}${path.sep}`;

  if (!candidate.startsWith(sourcePrefix)) return null;
  if (!CONTENT_TYPES.has(path.extname(candidate).toLowerCase())) return null;

  return candidate;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ asset: string[] }> }
) {
  const { asset } = await params;
  const sourcePath = resolveSourceAsset(asset);

  if (!sourcePath) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const body = await readFile(/* turbopackIgnore: true */ sourcePath);
    const extension = path.extname(sourcePath).toLowerCase();
    const isHtml = extension === ".html";

    return new Response(new Uint8Array(body), {
      headers: {
        "Cache-Control": isHtml ? "no-store" : "private, max-age=3600",
        "Content-Security-Policy": isHtml
          ? "default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'"
          : "default-src 'none'",
        "Content-Type": CONTENT_TYPES.get(extension) ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    return new Response(code === "ENOENT" ? "Not found" : "Preview unavailable", {
      status: code === "ENOENT" ? 404 : 500,
    });
  }
}
