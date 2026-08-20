export const MIGRATION_STATUSES = [
  "success",
  "skipped",
  "needs_manual_review",
  "failed",
] as const;

export type ProductImageMigrationStatus = (typeof MIGRATION_STATUSES)[number];

export interface ProductImageDetectionMetadata {
  readonly centerX: number;
  readonly centerY: number;
  readonly radius: number;
  readonly confidence: number;
  readonly candidateCount?: number;
}

export interface ProductImageCropMetadata {
  readonly left: number;
  readonly top: number;
  readonly size: number;
  readonly marginPixels: number;
  readonly sourceWidth?: number;
  readonly sourceHeight?: number;
}

export type ProductImageVariantKind = "master" | "thumbnail" | "card" | "product";
export type ProductImageVariantFormat = "webp" | "avif";

export interface ProductImageVariantMetadata {
  readonly kind: ProductImageVariantKind;
  readonly format: ProductImageVariantFormat;
  readonly width: number;
  readonly height: number;
  readonly url: string;
  readonly byteLength?: number;
}

interface ProductImageMigrationResultBase {
  readonly productId: string;
  readonly imageId: string;
  readonly name?: string;
  readonly slug?: string;
  readonly originalUrl: string;
  readonly sourceSha256?: string;
  readonly sourceGeneration?: string;
  readonly detection?: ProductImageDetectionMetadata;
  readonly crop?: ProductImageCropMetadata;
  readonly variants?: readonly ProductImageVariantMetadata[];
}

export type ProductImageMigrationResult = ProductImageMigrationResultBase &
  (
    | {
        readonly status: "success";
        readonly previewUrl: string;
        readonly reason?: string;
      }
    | {
        readonly status: Exclude<ProductImageMigrationStatus, "success">;
        readonly previewUrl?: string;
        readonly reason: string;
      }
  );

export interface ProductImageMigrationReport {
  readonly generatedAt: string;
  readonly processingVersion: string;
  readonly runId: string;
  readonly dryRun: boolean;
  readonly results: readonly ProductImageMigrationResult[];
}

const CSV_COLUMNS = [
  "generatedAt",
  "processingVersion",
  "runId",
  "dryRun",
  "status",
  "productId",
  "imageId",
  "name",
  "slug",
  "originalUrl",
  "sourceSha256",
  "sourceGeneration",
  "previewUrl",
  "reason",
  "detectionCenterX",
  "detectionCenterY",
  "detectionRadius",
  "detectionConfidence",
  "detectionCandidateCount",
  "cropLeft",
  "cropTop",
  "cropSize",
  "cropMarginPixels",
  "cropSourceWidth",
  "cropSourceHeight",
  "variants",
] as const;

const STATUS_LABELS: Record<ProductImageMigrationStatus, string> = {
  success: "Succes",
  skipped: "Overgeslagen",
  needs_manual_review: "Handmatige controle",
  failed: "Mislukt",
};

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableJsonValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, stableJsonValue(entry)]),
    );
  }

  return value;
}

function csvCell(value: unknown): string {
  const rawValue = value === undefined || value === null ? "" : String(value);
  const stringValue = /^[=+\-@]/.test(rawValue) ? `'${rawValue}` : rawValue;
  return /[",\r\n]/.test(stringValue)
    ? `"${stringValue.replaceAll('"', '""')}"`
    : stringValue;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeImageUrl(value: string): string | null {
  if (/^data:image\/(?:avif|gif|jpe?g|png|webp);base64,[a-z0-9+/=\s]+$/i.test(value)) {
    return value;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

function renderImage(url: string | undefined, label: string, productName: string): string {
  const safeUrl = url ? safeImageUrl(url) : null;
  const media = safeUrl
    ? `<img src="${escapeHtml(safeUrl)}" alt="${escapeHtml(`${label}: ${productName}`)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`
    : `<p class="media-placeholder">Geen veilige voorbeeldafbeelding beschikbaar.</p>`;

  return `<figure class="comparison-item">
            <figcaption>${escapeHtml(label)}</figcaption>
            <div class="media-frame">${media}</div>
          </figure>`;
}

function displayName(result: ProductImageMigrationResult): string {
  return result.name || result.slug || `Product ${result.productId}`;
}

function renderMetadata(result: ProductImageMigrationResult): string {
  const rows: Array<[string, string | number]> = [
    ["Product-ID", result.productId],
    ["Afbeelding-ID", result.imageId],
  ];

  if (result.slug) rows.push(["Slug", result.slug]);
  if (result.reason) rows.push(["Reden", result.reason]);
  if (result.detection) {
    rows.push(
      ["Middelpunt", `${result.detection.centerX}, ${result.detection.centerY}`],
      ["Straal", result.detection.radius],
      ["Betrouwbaarheid", result.detection.confidence],
    );
  }

  return rows
    .map(
      ([term, description]) =>
        `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(description)}</dd></div>`,
    )
    .join("");
}

export function renderMigrationReportJson(report: ProductImageMigrationReport): string {
  return `${JSON.stringify(stableJsonValue(report), null, 2)}\n`;
}

export function renderMigrationReportCsv(report: ProductImageMigrationReport): string {
  const rows = report.results.map((result) => {
    const values: Record<(typeof CSV_COLUMNS)[number], unknown> = {
      generatedAt: report.generatedAt,
      processingVersion: report.processingVersion,
      runId: report.runId,
      dryRun: report.dryRun,
      status: result.status,
      productId: result.productId,
      imageId: result.imageId,
      name: result.name,
      slug: result.slug,
      originalUrl: result.originalUrl,
      sourceSha256: result.sourceSha256,
      sourceGeneration: result.sourceGeneration,
      previewUrl: result.previewUrl,
      reason: result.reason,
      detectionCenterX: result.detection?.centerX,
      detectionCenterY: result.detection?.centerY,
      detectionRadius: result.detection?.radius,
      detectionConfidence: result.detection?.confidence,
      detectionCandidateCount: result.detection?.candidateCount,
      cropLeft: result.crop?.left,
      cropTop: result.crop?.top,
      cropSize: result.crop?.size,
      cropMarginPixels: result.crop?.marginPixels,
      cropSourceWidth: result.crop?.sourceWidth,
      cropSourceHeight: result.crop?.sourceHeight,
      variants: result.variants
        ? JSON.stringify(stableJsonValue(result.variants))
        : undefined,
    };

    return CSV_COLUMNS.map((column) => csvCell(values[column])).join(",");
  });

  return [CSV_COLUMNS.join(","), ...rows].join("\r\n") + "\r\n";
}

export function renderMigrationReviewHtml(
  report: ProductImageMigrationReport,
  maxItems = 10,
): string {
  const reviewLimit = Math.max(0, Math.min(10, Math.floor(maxItems)));
  const visibleResults = report.results.slice(0, reviewLimit);
  const statusCounts = Object.fromEntries(
    MIGRATION_STATUSES.map((status) => [
      status,
      report.results.filter((result) => result.status === status).length,
    ]),
  ) as Record<ProductImageMigrationStatus, number>;

  const cards = visibleResults
    .map((result) => {
      const title = displayName(result);
      return `<article class="migration-card" data-migration-card="${escapeHtml(result.productId)}" data-image-id="${escapeHtml(result.imageId)}" data-status="${escapeHtml(result.status)}">
        <header class="card-header">
          <div>
            <p class="eyebrow">Productafbeelding</p>
            <h2>${escapeHtml(title)}</h2>
          </div>
          <span class="status status--${escapeHtml(result.status)}">${escapeHtml(STATUS_LABELS[result.status])}</span>
        </header>
        <div class="comparison-grid">
          ${renderImage(result.originalUrl, "Origineel", title)}
          ${renderImage(result.previewUrl, "Nieuw", title)}
        </div>
        <dl class="metadata">${renderMetadata(result)}</dl>
      </article>`;
    })
    .join("\n");

  const summary = MIGRATION_STATUSES.map(
    (status) =>
      `<li><span>${escapeHtml(STATUS_LABELS[status])}</span><strong>${statusCounts[status]}</strong></li>`,
  ).join("");

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; connect-src 'none'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
  <title>Controle productafbeeldingen · ${escapeHtml(report.runId)}</title>
  <style>
    :root {
      color-scheme: light;
      --canvas: #F6F3EE;
      --ink: #333333;
      --accent: #E0B200;
      --surface: #FFFFFF;
      --border: #E4DFD5;
      --muted: #6E675C;
    }
    * { box-sizing: border-box; }
    html { background: var(--canvas); color: var(--ink); font-family: Arial, Helvetica, sans-serif; }
    body { margin: 0; min-width: 320px; }
    main { width: min(1120px, 100%); margin-inline: auto; padding: 24px 16px 48px; }
    .report-header { border-block: 4px solid var(--accent); padding-block: 24px; }
    .eyebrow { margin: 0 0 8px; color: var(--muted); font-size: .75rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    h1, h2 { margin: 0; line-height: 1.15; overflow-wrap: anywhere; }
    h1 { max-width: 18ch; font-family: Georgia, 'Times New Roman', serif; font-size: clamp(2rem, 7vw, 4.5rem); }
    .run-details { margin: 16px 0 0; color: var(--muted); overflow-wrap: anywhere; }
    .summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; margin: 24px 0; padding: 1px; background: var(--border); list-style: none; }
    .summary li { display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 14px; background: var(--surface); }
    .summary span { color: var(--muted); font-size: .75rem; overflow-wrap: anywhere; }
    .summary strong { font-family: Georgia, 'Times New Roman', serif; font-size: 1.75rem; }
    .cards { display: grid; gap: 20px; }
    .migration-card { min-width: 0; padding: 18px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); box-shadow: 0 12px 36px rgb(51 51 51 / .06); }
    .card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    .card-header > div { min-width: 0; }
    .card-header h2 { font-family: Georgia, 'Times New Roman', serif; font-size: clamp(1.35rem, 5vw, 2rem); }
    .status { flex: 0 0 auto; max-width: 45%; padding: 6px 9px; border-radius: 999px; background: var(--canvas); color: var(--muted); font-size: .7rem; font-weight: 700; text-align: center; }
    .status--success { background: #EEF5E9; color: #3E6433; }
    .status--needs_manual_review { background: #FFF7D6; color: #806600; }
    .status--failed { background: #F9E8E5; color: #8B3B31; }
    .comparison-grid { display: grid; gap: 12px; }
    .comparison-item { min-width: 0; margin: 0; }
    .comparison-item figcaption { margin-bottom: 7px; color: var(--muted); font-size: .75rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .media-frame { display: grid; aspect-ratio: 1; place-items: center; overflow: hidden; border: 1px solid var(--border); border-radius: 10px; background: var(--canvas); }
    .media-frame img { display: block; width: 100%; height: 100%; object-fit: contain; }
    .media-placeholder { max-width: 22ch; margin: 0; padding: 16px; color: var(--muted); font-size: .85rem; text-align: center; }
    .metadata { display: grid; gap: 8px; margin: 18px 0 0; padding-top: 16px; border-top: 1px solid var(--border); }
    .metadata div { display: grid; grid-template-columns: minmax(90px, .45fr) minmax(0, 1fr); gap: 10px; }
    .metadata dt { color: var(--muted); font-size: .75rem; }
    .metadata dd { min-width: 0; margin: 0; font-size: .82rem; overflow-wrap: anywhere; }
    .empty { padding: 32px; border: 1px dashed var(--border); color: var(--muted); text-align: center; }
    @media (min-width: 760px) {
      main { padding: 40px 28px 64px; }
      .summary { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .migration-card { padding: 24px; }
      .comparison-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    }
  </style>
</head>
<body>
  <main>
    <header class="report-header">
      <p class="eyebrow">De Notenman · lokale migratiecontrole</p>
      <h1>Origineel naast nieuw</h1>
      <p class="run-details">Run ${escapeHtml(report.runId)} · versie ${escapeHtml(report.processingVersion)} · ${escapeHtml(report.generatedAt)} · ${report.dryRun ? "dry-run" : "proefrun"}</p>
    </header>
    <ul class="summary" aria-label="Uitkomsten">${summary}</ul>
    <section class="cards" aria-label="Beoordeelde productafbeeldingen">
      ${cards || '<p class="empty">Geen productafbeeldingen om te beoordelen.</p>'}
    </section>
  </main>
</body>
</html>
`;
}
