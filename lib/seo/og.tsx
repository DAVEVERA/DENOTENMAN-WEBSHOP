import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BRAND_NAME, OG_IMAGE_SIZE } from "@/lib/seo/metadata";

/** Brand palette, mirrored from app/globals.css (oker on creme). */
const CREAM = "#F6F3EE";
const OKER = "#E0B200";
const OKER_INK = "#806600";
const NEAR_BLACK = "#141414";

/**
 * Satori reads ttf/otf/woff but not woff2, so a static Dosis 700 is vendored
 * under assets/fonts. next.config.ts force-includes it in the standalone
 * output, which file tracing cannot infer from a runtime path.
 */
let dosisPromise: Promise<Buffer> | undefined;

function loadDosis(): Promise<Buffer> {
  dosisPromise ??= readFile(join(process.cwd(), "assets/fonts/Dosis-Bold.woff"));
  return dosisPromise;
}

async function respond(element: React.ReactElement): Promise<ImageResponse> {
  const dosis = await loadDosis();

  return new ImageResponse(element, {
    ...OG_IMAGE_SIZE,
    fonts: [{ name: "Dosis", data: dosis, weight: 700, style: "normal" }],
  });
}

/** Shared frame: creme field, oker rule along the bottom, generous padding. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: CREAM,
        fontFamily: "Dosis",
      }}
    >
      {children}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 18,
          backgroundColor: OKER,
        }}
      />
    </div>
  );
}

function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: OKER,
          display: "flex",
        }}
      />
      <div style={{ fontSize: 38, color: OKER_INK, letterSpacing: 1 }}>{BRAND_NAME}</div>
    </div>
  );
}

/** Long product names have to shrink or they overflow the card. */
function titleSize(title: string): number {
  if (title.length > 70) return 54;
  if (title.length > 45) return 68;
  if (title.length > 28) return 82;
  return 96;
}

/** The default card for any page without a photo of its own. */
export function renderBrandCard({
  title,
  claim,
}: {
  title: string;
  claim: string;
}): Promise<ImageResponse> {
  return respond(
    <Frame>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          width: "100%",
        }}
      >
        <Wordmark />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: titleSize(title),
              lineHeight: 1.05,
              color: NEAR_BLACK,
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
          <div style={{ marginTop: 24, fontSize: 36, color: OKER_INK, maxWidth: 900 }}>
            {claim}
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** Product card: name on the left, the actual product photo filling the right. */
export function renderProductCard({
  title,
  claim,
  imageUrl,
}: {
  title: string;
  claim: string;
  imageUrl?: string;
}): Promise<ImageResponse> {
  if (!imageUrl) {
    return renderBrandCard({ title, claim });
  }

  return respond(
    <Frame>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          width: 660,
        }}
      >
        <Wordmark />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: titleSize(title),
              lineHeight: 1.05,
              color: NEAR_BLACK,
            }}
          >
            {title}
          </div>
          <div style={{ marginTop: 20, fontSize: 32, color: OKER_INK }}>{claim}</div>
        </div>
      </div>
      <div style={{ display: "flex", width: 540, height: "100%" }}>
        {/* Satori rasterises this to a PNG at build/request time; next/image
            has no meaning inside an ImageResponse tree. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          width={540}
          height={OG_IMAGE_SIZE.height}
          style={{ width: 540, height: "100%", objectFit: "cover" }}
        />
      </div>
    </Frame>
  );
}
