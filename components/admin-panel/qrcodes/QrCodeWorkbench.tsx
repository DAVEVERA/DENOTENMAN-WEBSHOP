"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { QrCodeStatus, QrCodeTargetType } from "@prisma/client";
import {
  Archive,
  Download,
  FileDown,
  Printer,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { addCampaignParametersToOwnedUrl, campaignSlug } from "@/lib/campaign-urls";
import { cn } from "@/lib/cn";

type ProductOption = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  categoryLabel: string | null;
};

type CategoryOption = {
  id: string;
  label: string;
};

type QrCodeDesignRecord = {
  id: string;
  name: string;
  status: QrCodeStatus;
  targetType: QrCodeTargetType;
  targetConfig: unknown;
  designConfig: unknown;
  labelConfig: unknown;
};

type QRCodeStylingInstance = {
  append: (element: HTMLElement) => void;
  update: (options: Record<string, unknown>) => void;
  download: (options: { name: string; extension: "png" | "svg" }) => Promise<void>;
  getRawData: (extension: "png" | "svg") => Promise<Blob | null>;
};

type WorkbenchProps = {
  initialDesign?: QrCodeDesignRecord | null;
  products: ProductOption[];
  categories: CategoryOption[];
  siteUrl: string;
  brandLogoUrl: string;
};

type TargetConfig = {
  productId?: string;
  productSlug?: string;
  categorySlug?: string;
  url?: string;
  code?: string;
  phone?: string;
  message?: string;
  email?: string;
  subject?: string;
  body?: string;
  ssid?: string;
  password?: string;
  encryption?: "WPA" | "WEP" | "nopass";
  hidden?: boolean;
  text?: string;
};

type DesignConfig = {
  foreground: string;
  background: string;
  dotsType: "rounded" | "dots" | "classy" | "square";
  cornersSquareType: "extra-rounded" | "dot" | "square";
  cornersDotType: "dot" | "square";
  margin: number;
  size: number;
  logoEnabled: boolean;
  logoSize: number;
};

type LabelConfig = {
  title: string;
  subtitle: string;
  preset: string;
  labelWidthMm: number;
  labelHeightMm: number;
  columns: number;
  rows: number;
  gapMm: number;
  copies: number;
  showBorder: boolean;
};

const targetLabels: Record<QrCodeTargetType, string> = {
  product: "Product",
  category: "Categorie",
  discount: "Kortingsactie",
  whatsapp: "WhatsApp",
  email: "E-mail",
  wifi: "WiFi",
  url: "URL",
  text: "Tekst",
};

const labelPresets = [
  {
    id: "70x37-24",
    label: "70 x 37 mm - 24 labels",
    labelWidthMm: 70,
    labelHeightMm: 37,
    columns: 3,
    rows: 8,
    gapMm: 0,
    copies: 24,
  },
  {
    id: "63x38-21",
    label: "63,5 x 38,1 mm - 21 labels",
    labelWidthMm: 63.5,
    labelHeightMm: 38.1,
    columns: 3,
    rows: 7,
    gapMm: 0,
    copies: 21,
  },
  {
    id: "105x74-8",
    label: "105 x 74 mm - 8 labels",
    labelWidthMm: 105,
    labelHeightMm: 74,
    columns: 2,
    rows: 4,
    gapMm: 0,
    copies: 8,
  },
  {
    id: "custom",
    label: "Aangepast",
    labelWidthMm: 70,
    labelHeightMm: 37,
    columns: 3,
    rows: 8,
    gapMm: 0,
    copies: 24,
  },
];

const colorSwatches = [
  { label: "Groen", value: "#2f4f4f" },
  { label: "Goud", value: "#daa520" },
  { label: "Salie", value: "#7a9a7a" },
  { label: "Achtergrond", value: "#f7f3ec" },
  { label: "Wit", value: "#ffffff" },
  { label: "Muted", value: "#cbb899" },
];

const defaultDesignConfig: DesignConfig = {
  foreground: "#2f4f4f",
  background: "#ffffff",
  dotsType: "rounded",
  cornersSquareType: "extra-rounded",
  cornersDotType: "dot",
  margin: 10,
  size: 320,
  logoEnabled: false,
  logoSize: 0.22,
};

const defaultLabelConfig: LabelConfig = {
  title: "Scan voor meer informatie",
  subtitle: "De Notenman",
  preset: "70x37-24",
  labelWidthMm: 70,
  labelHeightMm: 37,
  columns: 3,
  rows: 8,
  gapMm: 0,
  copies: 24,
  showBorder: true,
};

function getObjectValue<T extends Record<string, unknown>>(value: unknown, fallback: T): T {
  return value && typeof value === "object" && !Array.isArray(value)
    ? ({ ...fallback, ...(value as Record<string, unknown>) } as T)
    : fallback;
}

function normalizeSiteUrl(value: string) {
  return value.replace(/\/+$/g, "");
}

function encodeWifiValue(value = "") {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/:/g, "\\:");
}

function normalizePhone(value = "") {
  return value.replace(/[^\d+]/g, "").replace(/^\+/, "");
}

function createTargetPayload(
  targetType: QrCodeTargetType,
  config: TargetConfig,
  siteUrl: string,
  campaignName: string
) {
  const baseUrl = normalizeSiteUrl(siteUrl || "https://www.denotenman.nl");
  const trackOwnedTarget = (target: string) =>
    addCampaignParametersToOwnedUrl(target, baseUrl, {
      source: "qr_code",
      medium: "offline",
      campaign: campaignSlug(campaignName),
      content: targetType,
    });

  switch (targetType) {
    case "product":
      return trackOwnedTarget(
        config.productSlug ? `${baseUrl}/winkel/${config.productSlug}` : baseUrl
      );
    case "category":
      return trackOwnedTarget(
        config.categorySlug
          ? `${baseUrl}/categorie/${config.categorySlug}`
          : `${baseUrl}/categorie`
      );
    case "discount":
      return trackOwnedTarget(config.url || baseUrl);
    case "whatsapp": {
      const phone = normalizePhone(config.phone);
      const message = config.message ? `?text=${encodeURIComponent(config.message)}` : "";
      return phone ? `https://wa.me/${phone}${message}` : "https://wa.me/";
    }
    case "email": {
      const params = new URLSearchParams();
      if (config.subject) params.set("subject", config.subject);
      if (config.body) params.set("body", config.body);
      const query = params.toString();
      return `mailto:${config.email ?? ""}${query ? `?${query}` : ""}`;
    }
    case "wifi": {
      const encryption = config.encryption ?? "WPA";
      const hidden = config.hidden ? "true" : "false";
      return `WIFI:T:${encryption};S:${encodeWifiValue(config.ssid)};P:${encodeWifiValue(
        config.password
      )};H:${hidden};;`;
    }
    case "text":
      return config.text || "De Notenman";
    case "url":
    default:
      return trackOwnedTarget(config.url || baseUrl);
  }
}

function createQrOptions(data: string, design: DesignConfig, brandLogoUrl: string): Record<string, unknown> {
  return {
    width: design.size,
    height: design.size,
    type: "svg",
    data,
    margin: design.margin,
    qrOptions: {
      errorCorrectionLevel: design.logoEnabled ? "H" : "Q",
    },
    image: design.logoEnabled ? brandLogoUrl : undefined,
    imageOptions: {
      crossOrigin: "anonymous",
      margin: 6,
      imageSize: design.logoSize,
      hideBackgroundDots: true,
    },
    dotsOptions: {
      color: design.foreground,
      type: design.dotsType,
    },
    backgroundOptions: {
      color: design.background,
    },
    cornersSquareOptions: {
      color: design.foreground,
      type: design.cornersSquareType,
    },
    cornersDotOptions: {
      color: design.foreground,
      type: design.cornersDotType,
    },
  };
}

function createFileName(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "de-notenman-qr-code"
  );
}

const inputClass =
  "mt-1 w-full rounded-button border border-border bg-surface px-3 py-2 text-body-md text-text focus:border-border-hover focus:outline-none";
const labelClass = "block text-body-sm font-semibold text-text";
const sectionClass = "mt-8 border-t border-border pt-6";
const gridClass = "mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2";
const primaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-button border border-accent bg-accent px-5 font-heading text-body-md font-semibold text-contrast shadow-button transition-colors duration-hover-fast hover:border-accent-hover hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-button border border-border bg-surface px-4 font-heading text-body-sm font-semibold text-text transition-colors duration-hover-fast hover:border-border-hover disabled:cursor-not-allowed disabled:opacity-60";
const ghostButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-button px-4 font-heading text-body-sm font-semibold text-muted transition-colors duration-hover-fast hover:text-text disabled:cursor-not-allowed disabled:opacity-60";

export function QrCodeWorkbench({ initialDesign, products, categories, siteUrl, brandLogoUrl }: WorkbenchProps) {
  const router = useRouter();
  const firstProduct = products[0];
  const firstCategory = categories[0];
  const previewRef = useRef<HTMLDivElement | null>(null);
  const qrRef = useRef<QRCodeStylingInstance | null>(null);

  const [name, setName] = useState(initialDesign?.name ?? "Nieuwe QR-code");
  const [status, setStatus] = useState<QrCodeStatus>(initialDesign?.status ?? "active");
  const [targetType, setTargetType] = useState<QrCodeTargetType>(initialDesign?.targetType ?? "url");
  const [targetConfig, setTargetConfig] = useState<TargetConfig>(() => {
    const fallback: TargetConfig = {
      productId: firstProduct?.id,
      productSlug: firstProduct?.slug,
      categorySlug: firstCategory?.id,
      url: normalizeSiteUrl(siteUrl || "https://www.denotenman.nl"),
      phone: "316",
      encryption: "WPA",
      text: "De Notenman",
    };

    return getObjectValue(initialDesign?.targetConfig, fallback);
  });
  const [designConfig, setDesignConfig] = useState<DesignConfig>(() =>
    getObjectValue(initialDesign?.designConfig, defaultDesignConfig)
  );
  const [labelConfig, setLabelConfig] = useState<LabelConfig>(() =>
    getObjectValue(initialDesign?.labelConfig, defaultLabelConfig)
  );
  const [labelImageUrl, setLabelImageUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const qrPayload = useMemo(() => createTargetPayload(targetType, targetConfig, siteUrl, name), [
    name,
    targetType,
    targetConfig,
    siteUrl,
  ]);
  const qrOptions = useMemo(() => createQrOptions(qrPayload, designConfig, brandLogoUrl), [
    brandLogoUrl,
    designConfig,
    qrPayload,
  ]);
  const persistedTargetConfig = useMemo(() => {
    if (targetType !== "wifi") {
      return targetConfig;
    }

    const { password: _password, ...safeConfig } = targetConfig;
    return safeConfig;
  }, [targetConfig, targetType]);
  const labelCount = Math.min(80, Math.max(1, Number(labelConfig.copies) || labelConfig.columns * labelConfig.rows));
  const printLabels = useMemo(() => Array.from({ length: labelCount }, (_, index) => index), [labelCount]);

  useEffect(() => {
    let isMounted = true;

    async function mountQrCode() {
      const QRCodeStyling = (await import("qr-code-styling")).default;

      if (!isMounted || !previewRef.current) {
        return;
      }

      if (!qrRef.current) {
        qrRef.current = new QRCodeStyling(qrOptions) as QRCodeStylingInstance;
        previewRef.current.replaceChildren();
        qrRef.current.append(previewRef.current);
        return;
      }

      qrRef.current.update(qrOptions);
    }

    void mountQrCode();

    return () => {
      isMounted = false;
    };
  }, [qrOptions]);

  useEffect(() => {
    let isMounted = true;

    async function renderLabelImage() {
      if (!qrRef.current) {
        return;
      }

      const blob = await qrRef.current.getRawData("png");
      if (!blob || !isMounted) {
        return;
      }

      const nextUrl = URL.createObjectURL(blob);
      setLabelImageUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }
        return nextUrl;
      });
    }

    const timeout = window.setTimeout(() => void renderLabelImage(), 120);

    return () => {
      isMounted = false;
      window.clearTimeout(timeout);
    };
  }, [qrOptions]);

  useEffect(() => {
    return () => {
      if (labelImageUrl) {
        URL.revokeObjectURL(labelImageUrl);
      }
    };
  }, [labelImageUrl]);

  function updateTargetConfig(nextConfig: Partial<TargetConfig>) {
    setTargetConfig((currentConfig) => ({ ...currentConfig, ...nextConfig }));
  }

  function updateDesignConfig(nextConfig: Partial<DesignConfig>) {
    setDesignConfig((currentConfig) => ({ ...currentConfig, ...nextConfig }));
  }

  function updateLabelConfig(nextConfig: Partial<LabelConfig>) {
    setLabelConfig((currentConfig) => ({ ...currentConfig, ...nextConfig }));
  }

  function applyPreset(presetId: string) {
    const preset = labelPresets.find((item) => item.id === presetId) ?? labelPresets[0];
    updateLabelConfig({
      preset: preset.id,
      labelWidthMm: preset.labelWidthMm,
      labelHeightMm: preset.labelHeightMm,
      columns: preset.columns,
      rows: preset.rows,
      gapMm: preset.gapMm,
      copies: preset.copies,
    });
  }

  function handleProductChange(productId: string) {
    const product = products.find((item) => item.id === productId);
    updateTargetConfig({
      productId,
      productSlug: product?.slug,
    });
  }

  async function downloadQr(extension: "png" | "svg") {
    if (!qrRef.current) {
      return;
    }

    await qrRef.current.download({
      name: createFileName(name),
      extension,
    });
  }

  function printLabelsSheet() {
    window.print();
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    const payload = {
      name,
      status,
      targetType,
      targetConfig: persistedTargetConfig,
      designConfig,
      labelConfig,
    };

    try {
      const response = initialDesign
        ? await fetch(`/api/admin/qrcodes/${initialDesign.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/qrcodes", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Opslaan is niet gelukt.");
      }

      setMessage("QR-code opgeslagen.");
      router.refresh();

      if (!initialDesign && body?.design?.id) {
        router.push(`/admin/qrcodes/${body.design.id}`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Opslaan is niet gelukt.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchiveToggle() {
    if (!initialDesign) return;
    setIsArchiving(true);
    setError(null);
    setMessage(null);

    const isArchived = status === "archived";
    const endpoint = isArchived ? "restore" : "archive";

    try {
      const response = await fetch(`/api/admin/qrcodes/${initialDesign.id}/${endpoint}`, {
        method: "POST",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Actie is niet gelukt.");
      }

      setStatus(isArchived ? "active" : "archived");
      setMessage(isArchived ? "QR-code hersteld." : "QR-code gearchiveerd.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Actie is niet gelukt.");
    } finally {
      setIsArchiving(false);
    }
  }

  async function handleDelete() {
    if (!initialDesign) return;
    if (!window.confirm(`QR-code “${initialDesign.name}” definitief verwijderen?`)) return;

    setIsDeleting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/qrcodes/${initialDesign.id}`, { method: "DELETE" });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Verwijderen is niet gelukt.");
      }

      router.push("/admin/qrcodes");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Verwijderen is niet gelukt.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-label="QR-code instellingen" className="rounded-panel border border-border bg-surface p-5">
        <div className={gridClass}>
          <label>
            <span className={labelClass}>Naam</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className={inputClass}
            />
          </label>

          <label>
            <span className={labelClass}>Doel</span>
            <select
              value={targetType}
              onChange={(event) => setTargetType(event.target.value as QrCodeTargetType)}
              className={inputClass}
            >
              {Object.entries(targetLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4">{renderTargetFields()}</div>

        <div className={sectionClass}>
          <h2 className="font-heading text-heading-lg text-text">Ontwerp</h2>
          <div className={gridClass}>
            <label>
              <span className={labelClass}>QR-stijl</span>
              <select
                value={designConfig.dotsType}
                onChange={(event) => updateDesignConfig({ dotsType: event.target.value as DesignConfig["dotsType"] })}
                className={inputClass}
              >
                <option value="rounded">Rond</option>
                <option value="dots">Stippen</option>
                <option value="classy">Klassiek</option>
                <option value="square">Vierkant</option>
              </select>
            </label>

            <label>
              <span className={labelClass}>Hoeken</span>
              <select
                value={designConfig.cornersSquareType}
                onChange={(event) =>
                  updateDesignConfig({
                    cornersSquareType: event.target.value as DesignConfig["cornersSquareType"],
                  })
                }
                className={inputClass}
              >
                <option value="extra-rounded">Extra rond</option>
                <option value="dot">Rond</option>
                <option value="square">Vierkant</option>
              </select>
            </label>

            <label>
              <span className={labelClass}>Marge</span>
              <input
                type="number"
                min="0"
                max="40"
                value={designConfig.margin}
                onChange={(event) => updateDesignConfig({ margin: Number(event.target.value) })}
                className={inputClass}
              />
            </label>

            <label>
              <span className={labelClass}>Formaat</span>
              <input
                type="number"
                min="180"
                max="680"
                step="20"
                value={designConfig.size}
                onChange={(event) => updateDesignConfig({ size: Number(event.target.value) })}
                className={inputClass}
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="QR-kleur">
            <span className={cn(labelClass, "mr-1 w-full sm:w-auto")}>QR-kleur</span>
            {colorSwatches.map((color) => (
              <button
                key={`foreground-${color.value}`}
                type="button"
                className="h-11 w-11 rounded-full border border-border transition-colors duration-hover-fast hover:border-border-hover"
                style={{ backgroundColor: color.value }}
                aria-label={color.label}
                title={color.label}
                onClick={() => updateDesignConfig({ foreground: color.value })}
              />
            ))}
            <input
              type="color"
              value={designConfig.foreground}
              onChange={(event) => updateDesignConfig({ foreground: event.target.value })}
              className="h-11 w-11 rounded-button border border-border bg-surface"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Achtergrondkleur">
            <span className={cn(labelClass, "mr-1 w-full sm:w-auto")}>Achtergrond</span>
            {colorSwatches.map((color) => (
              <button
                key={`background-${color.value}`}
                type="button"
                className="h-11 w-11 rounded-full border border-border transition-colors duration-hover-fast hover:border-border-hover"
                style={{ backgroundColor: color.value }}
                aria-label={color.label}
                title={color.label}
                onClick={() => updateDesignConfig({ background: color.value })}
              />
            ))}
            <input
              type="color"
              value={designConfig.background}
              onChange={(event) => updateDesignConfig({ background: event.target.value })}
              className="h-11 w-11 rounded-button border border-border bg-surface"
            />
          </div>

          <label className="mt-4 flex items-center gap-2 text-body-sm text-text">
            <input
              type="checkbox"
              checked={designConfig.logoEnabled}
              onChange={(event) => updateDesignConfig({ logoEnabled: event.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            De Notenman logo in QR-code
          </label>
        </div>

        <div className={sectionClass}>
          <h2 className="font-heading text-heading-lg text-text">Stickerlabels</h2>
          <div className={gridClass}>
            <label>
              <span className={labelClass}>Titel</span>
              <input
                type="text"
                value={labelConfig.title}
                onChange={(event) => updateLabelConfig({ title: event.target.value })}
                className={inputClass}
              />
            </label>

            <label>
              <span className={labelClass}>Subtitel</span>
              <input
                type="text"
                value={labelConfig.subtitle}
                onChange={(event) => updateLabelConfig({ subtitle: event.target.value })}
                className={inputClass}
              />
            </label>

            <label>
              <span className={labelClass}>A4 preset</span>
              <select
                value={labelConfig.preset}
                onChange={(event) => applyPreset(event.target.value)}
                className={inputClass}
              >
                {labelPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className={labelClass}>Aantal labels</span>
              <input
                type="number"
                min="1"
                max="80"
                value={labelConfig.copies}
                onChange={(event) =>
                  updateLabelConfig({
                    preset: "custom",
                    copies: Number(event.target.value),
                  })
                }
                className={inputClass}
              />
            </label>

            <label>
              <span className={labelClass}>Breedte mm</span>
              <input
                type="number"
                min="20"
                max="210"
                step="0.1"
                value={labelConfig.labelWidthMm}
                onChange={(event) =>
                  updateLabelConfig({
                    preset: "custom",
                    labelWidthMm: Number(event.target.value),
                  })
                }
                className={inputClass}
              />
            </label>

            <label>
              <span className={labelClass}>Hoogte mm</span>
              <input
                type="number"
                min="20"
                max="297"
                step="0.1"
                value={labelConfig.labelHeightMm}
                onChange={(event) =>
                  updateLabelConfig({
                    preset: "custom",
                    labelHeightMm: Number(event.target.value),
                  })
                }
                className={inputClass}
              />
            </label>
          </div>

          <label className="mt-4 flex items-center gap-2 text-body-sm text-text">
            <input
              type="checkbox"
              checked={labelConfig.showBorder}
              onChange={(event) => updateLabelConfig({ showBorder: event.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            Snijrand tonen
          </label>
        </div>

        {error ? <p className="mt-6 text-body-sm text-red-600">{error}</p> : null}
        {message ? <p className="mt-6 text-body-sm text-text">{message}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => void handleSave()} disabled={isSaving} className={primaryButtonClass}>
            <Save size={18} aria-hidden="true" />
            {isSaving ? "Bezig…" : "Opslaan"}
          </button>
          <button type="button" onClick={() => void downloadQr("svg")} className={secondaryButtonClass}>
            <FileDown size={18} aria-hidden="true" />
            SVG
          </button>
          <button type="button" onClick={() => void downloadQr("png")} className={secondaryButtonClass}>
            <Download size={18} aria-hidden="true" />
            PNG
          </button>
          <button type="button" onClick={printLabelsSheet} className={ghostButtonClass}>
            <Printer size={18} aria-hidden="true" />
            Print labels
          </button>
        </div>

        {initialDesign ? (
          <div className="mt-4 flex flex-wrap gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => void handleArchiveToggle()}
              disabled={isArchiving}
              className={secondaryButtonClass}
            >
              {status === "archived" ? (
                <RotateCcw size={18} aria-hidden="true" />
              ) : (
                <Archive size={18} aria-hidden="true" />
              )}
              {status === "archived" ? "Herstellen" : "Archiveren"}
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              className={ghostButtonClass}
            >
              <Trash2 size={18} aria-hidden="true" />
              Verwijderen
            </button>
          </div>
        ) : null}
      </section>

      <aside aria-label="QR-code preview" className="flex flex-col gap-4">
        <div className="rounded-panel border border-border bg-surface p-5">
          <div ref={previewRef} className="mx-auto flex w-full max-w-[280px] items-center justify-center" />
          <div className="mt-4 text-center">
            <h2 className="font-heading text-heading-lg text-text">{name}</h2>
            <p className="text-body-sm text-muted">{targetLabels[targetType]}</p>
            <code className="mt-2 block break-all rounded-button bg-background px-2 py-1 text-xs text-muted">
              {qrPayload}
            </code>
          </div>
        </div>

        {targetType === "wifi" && !targetConfig.password ? (
          <p className="rounded-panel border border-border bg-background p-3 text-body-sm text-muted">
            WiFi-wachtwoorden worden niet opgeslagen. Vul het wachtwoord opnieuw in voor herprinten.
          </p>
        ) : null}
      </aside>

      <section aria-label="A4 stickerlabels" className="print:block hidden xl:col-span-2">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${labelConfig.columns}, ${labelConfig.labelWidthMm}mm)`,
            gridAutoRows: `${labelConfig.labelHeightMm}mm`,
            gap: `${labelConfig.gapMm}mm`,
          }}
        >
          {printLabels.map((index) => (
            <article
              key={index}
              className={cn(
                "flex items-center gap-2 overflow-hidden p-2",
                labelConfig.showBorder ? "border border-dashed border-border" : ""
              )}
            >
              {labelImageUrl ? <img src={labelImageUrl} alt="" className="h-full w-auto object-contain" /> : null}
              <div className="flex min-w-0 flex-col">
                <strong className="truncate text-xs text-text">{labelConfig.title}</strong>
                <span className="truncate text-xs text-muted">{labelConfig.subtitle}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );

  function renderTargetFields() {
    switch (targetType) {
      case "product":
        return (
          <div className={gridClass}>
            <label>
              <span className={labelClass}>Product</span>
              <select
                value={targetConfig.productId ?? ""}
                onChange={(event) => handleProductChange(event.target.value)}
                className={inputClass}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className={labelClass}>Productslug</span>
              <input
                type="text"
                value={targetConfig.productSlug ?? ""}
                onChange={(event) => updateTargetConfig({ productSlug: event.target.value })}
                className={inputClass}
              />
            </label>
          </div>
        );
      case "category":
        return (
          <label>
            <span className={labelClass}>Categorie</span>
            <select
              value={targetConfig.categorySlug ?? ""}
              onChange={(event) => updateTargetConfig({ categorySlug: event.target.value })}
              className={inputClass}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
        );
      case "discount":
        return (
          <div className={gridClass}>
            <label>
              <span className={labelClass}>Actie URL</span>
              <input
                type="url"
                value={targetConfig.url ?? ""}
                onChange={(event) => updateTargetConfig({ url: event.target.value })}
                placeholder={`${normalizeSiteUrl(siteUrl)}/kortingen`}
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>Kortingscode</span>
              <input
                type="text"
                value={targetConfig.code ?? ""}
                onChange={(event) => updateTargetConfig({ code: event.target.value })}
                className={inputClass}
              />
            </label>
          </div>
        );
      case "whatsapp":
        return (
          <div className={gridClass}>
            <label>
              <span className={labelClass}>Telefoonnummer</span>
              <input
                type="tel"
                value={targetConfig.phone ?? ""}
                onChange={(event) => updateTargetConfig({ phone: event.target.value })}
                placeholder="316..."
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>Bericht</span>
              <input
                type="text"
                value={targetConfig.message ?? ""}
                onChange={(event) => updateTargetConfig({ message: event.target.value })}
                className={inputClass}
              />
            </label>
          </div>
        );
      case "email":
        return (
          <div className={gridClass}>
            <label>
              <span className={labelClass}>E-mailadres</span>
              <input
                type="email"
                value={targetConfig.email ?? ""}
                onChange={(event) => updateTargetConfig({ email: event.target.value })}
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>Onderwerp</span>
              <input
                type="text"
                value={targetConfig.subject ?? ""}
                onChange={(event) => updateTargetConfig({ subject: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="sm:col-span-2">
              <span className={labelClass}>Bericht</span>
              <textarea
                value={targetConfig.body ?? ""}
                onChange={(event) => updateTargetConfig({ body: event.target.value })}
                className={cn(inputClass, "min-h-24")}
              />
            </label>
          </div>
        );
      case "wifi":
        return (
          <div className={gridClass}>
            <label>
              <span className={labelClass}>Netwerknaam</span>
              <input
                type="text"
                value={targetConfig.ssid ?? ""}
                onChange={(event) => updateTargetConfig({ ssid: event.target.value })}
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>Wachtwoord</span>
              <input
                type="password"
                value={targetConfig.password ?? ""}
                onChange={(event) => updateTargetConfig({ password: event.target.value })}
                autoComplete="new-password"
                className={inputClass}
              />
            </label>
            <label>
              <span className={labelClass}>Beveiliging</span>
              <select
                value={targetConfig.encryption ?? "WPA"}
                onChange={(event) =>
                  updateTargetConfig({ encryption: event.target.value as TargetConfig["encryption"] })
                }
                className={inputClass}
              >
                <option value="WPA">WPA/WPA2</option>
                <option value="WEP">WEP</option>
                <option value="nopass">Geen wachtwoord</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pt-6 text-body-sm text-text">
              <input
                type="checkbox"
                checked={Boolean(targetConfig.hidden)}
                onChange={(event) => updateTargetConfig({ hidden: event.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              Verborgen netwerk
            </label>
          </div>
        );
      case "text":
        return (
          <label>
            <span className={labelClass}>Tekst</span>
            <textarea
              value={targetConfig.text ?? ""}
              onChange={(event) => updateTargetConfig({ text: event.target.value })}
              className={cn(inputClass, "min-h-24")}
            />
          </label>
        );
      case "url":
      default:
        return (
          <label>
            <span className={labelClass}>URL</span>
            <input
              type="url"
              value={targetConfig.url ?? ""}
              onChange={(event) => updateTargetConfig({ url: event.target.value })}
              placeholder={normalizeSiteUrl(siteUrl)}
              className={inputClass}
            />
          </label>
        );
    }
  }
}
