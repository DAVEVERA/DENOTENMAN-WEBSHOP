"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Archive,
  Download,
  FileDown,
  Printer,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import {
  archiveQrCodeAction,
  deleteQrCodeAction,
  restoreQrCodeAction,
  saveQrCodeAction,
} from "../../actions/qrcode.actions";
import type { QrCodeDesign, QrCodeTargetType } from "../../lib/qrcodes";

type ProductOption = {
  id: number;
  name: string;
  slug: string;
  category: string;
  categoryLabel: string | null;
};

type CategoryOption = {
  id: string;
  label: string;
};

type QRCodeStylingInstance = {
  append: (element: HTMLElement) => void;
  update: (options: Record<string, unknown>) => void;
  download: (options: { name: string; extension: "png" | "svg" }) => Promise<void>;
  getRawData: (extension: "png" | "svg") => Promise<Blob | null>;
};

type WorkbenchProps = {
  initialDesign?: QrCodeDesign | null;
  products: ProductOption[];
  categories: CategoryOption[];
  siteUrl: string;
  brandLogoUrl: string;
};

type TargetConfig = {
  productId?: number;
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

function createTargetPayload(targetType: QrCodeTargetType, config: TargetConfig, siteUrl: string) {
  const baseUrl = normalizeSiteUrl(siteUrl || "https://www.denotenman.nl");

  switch (targetType) {
    case "product":
      return config.productSlug ? `${baseUrl}/winkel/${config.productSlug}` : baseUrl;
    case "category":
      return config.categorySlug ? `${baseUrl}/categorie/${config.categorySlug}` : `${baseUrl}/categorie`;
    case "discount":
      return config.url || baseUrl;
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
        config.password,
      )};H:${hidden};;`;
    }
    case "text":
      return config.text || "De Notenman";
    case "url":
    default:
      return config.url || baseUrl;
  }
}

function createQrOptions(
  data: string,
  design: DesignConfig,
  brandLogoUrl: string,
): Record<string, unknown> {
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

export function QRCodeWorkbench({
  initialDesign,
  products,
  categories,
  siteUrl,
  brandLogoUrl,
}: WorkbenchProps) {
  const firstProduct = products[0];
  const firstCategory = categories[0];
  const [isPending, startTransition] = useTransition();
  const previewRef = useRef<HTMLDivElement | null>(null);
  const qrRef = useRef<QRCodeStylingInstance | null>(null);
  const [name, setName] = useState(initialDesign?.name ?? "Nieuwe QR-code");
  const [status, setStatus] = useState(initialDesign?.status ?? "active");
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
    getObjectValue(initialDesign?.designConfig, defaultDesignConfig),
  );
  const [labelConfig, setLabelConfig] = useState<LabelConfig>(() =>
    getObjectValue(initialDesign?.labelConfig, defaultLabelConfig),
  );
  const [labelImageUrl, setLabelImageUrl] = useState("");

  const qrPayload = useMemo(
    () => createTargetPayload(targetType, targetConfig, siteUrl),
    [targetType, targetConfig, siteUrl],
  );
  const qrOptions = useMemo(
    () => createQrOptions(qrPayload, designConfig, brandLogoUrl),
    [brandLogoUrl, designConfig, qrPayload],
  );
  const persistedTargetConfig = useMemo(() => {
    if (targetType !== "wifi") {
      return targetConfig;
    }

    const { password: _password, ...safeConfig } = targetConfig;
    return safeConfig;
  }, [targetConfig, targetType]);
  const labelCount = Math.min(
    80,
    Math.max(1, Number(labelConfig.copies) || labelConfig.columns * labelConfig.rows),
  );
  const printLabels = useMemo(
    () => Array.from({ length: labelCount }, (_, index) => index),
    [labelCount],
  );

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

  function handleProductChange(productId: number) {
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

  return (
    <div className="qr-workbench">
      <section className="qr-panel qr-panel--controls" aria-label="QR-code instellingen">
        <form className="qr-save-form" action={saveQrCodeAction}>
          <input type="hidden" name="id" value={initialDesign?.id ?? ""} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetConfig" value={JSON.stringify(persistedTargetConfig)} />
          <input type="hidden" name="designConfig" value={JSON.stringify(designConfig)} />
          <input type="hidden" name="labelConfig" value={JSON.stringify(labelConfig)} />

          <div className="qr-control-grid">
            <label>
              Naam
              <input
                type="text"
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>

            <label>
              Doel
              <select
                value={targetType}
                onChange={(event) => setTargetType(event.target.value as QrCodeTargetType)}
              >
                {Object.entries(targetLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="qr-target-box">{renderTargetFields()}</div>

          <div className="qr-tool-section">
            <h2>Ontwerp</h2>
            <div className="qr-control-grid">
              <label>
                QR-stijl
                <select
                  value={designConfig.dotsType}
                  onChange={(event) =>
                    updateDesignConfig({ dotsType: event.target.value as DesignConfig["dotsType"] })
                  }
                >
                  <option value="rounded">Rond</option>
                  <option value="dots">Stippen</option>
                  <option value="classy">Klassiek</option>
                  <option value="square">Vierkant</option>
                </select>
              </label>

              <label>
                Hoeken
                <select
                  value={designConfig.cornersSquareType}
                  onChange={(event) =>
                    updateDesignConfig({
                      cornersSquareType: event.target.value as DesignConfig["cornersSquareType"],
                    })
                  }
                >
                  <option value="extra-rounded">Extra rond</option>
                  <option value="dot">Rond</option>
                  <option value="square">Vierkant</option>
                </select>
              </label>

              <label>
                Marge
                <input
                  type="number"
                  min="0"
                  max="40"
                  value={designConfig.margin}
                  onChange={(event) => updateDesignConfig({ margin: Number(event.target.value) })}
                />
              </label>

              <label>
                Formaat
                <input
                  type="number"
                  min="180"
                  max="680"
                  step="20"
                  value={designConfig.size}
                  onChange={(event) => updateDesignConfig({ size: Number(event.target.value) })}
                />
              </label>
            </div>

            <div className="qr-swatch-group" aria-label="QR-kleur">
              <span>QR-kleur</span>
              {colorSwatches.map((color) => (
                <button
                  key={`foreground-${color.value}`}
                  type="button"
                  className="qr-swatch"
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
              />
            </div>

            <div className="qr-swatch-group" aria-label="Achtergrondkleur">
              <span>Achtergrond</span>
              {colorSwatches.map((color) => (
                <button
                  key={`background-${color.value}`}
                  type="button"
                  className="qr-swatch"
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
              />
            </div>

            <label className="qr-checkbox">
              <input
                type="checkbox"
                checked={designConfig.logoEnabled}
                onChange={(event) => updateDesignConfig({ logoEnabled: event.target.checked })}
              />
              De Notenman logo in QR-code
            </label>
          </div>

          <div className="qr-tool-section">
            <h2>Stickerlabels</h2>
            <div className="qr-control-grid">
              <label>
                Titel
                <input
                  type="text"
                  value={labelConfig.title}
                  onChange={(event) => updateLabelConfig({ title: event.target.value })}
                />
              </label>

              <label>
                Subtitel
                <input
                  type="text"
                  value={labelConfig.subtitle}
                  onChange={(event) => updateLabelConfig({ subtitle: event.target.value })}
                />
              </label>

              <label>
                A4 preset
                <select value={labelConfig.preset} onChange={(event) => applyPreset(event.target.value)}>
                  {labelPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Aantal labels
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
                />
              </label>

              <label>
                Breedte mm
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
                />
              </label>

              <label>
                Hoogte mm
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
                />
              </label>
            </div>

            <label className="qr-checkbox">
              <input
                type="checkbox"
                checked={labelConfig.showBorder}
                onChange={(event) => updateLabelConfig({ showBorder: event.target.checked })}
              />
              Snijrand tonen
            </label>
          </div>

          <div className="qr-command-row">
            <button className="admin-button" type="submit">
              <Save size={18} aria-hidden="true" />
              Opslaan
            </button>
            <button
              className="admin-button admin-button--secondary"
              type="button"
              onClick={() => void downloadQr("svg")}
            >
              <FileDown size={18} aria-hidden="true" />
              SVG
            </button>
            <button
              className="admin-button admin-button--secondary"
              type="button"
              onClick={() => void downloadQr("png")}
            >
              <Download size={18} aria-hidden="true" />
              PNG
            </button>
            <button className="admin-button admin-button--ghost" type="button" onClick={printLabelsSheet}>
              <Printer size={18} aria-hidden="true" />
              Print labels
            </button>
          </div>
        </form>

        {initialDesign ? (
          <div className="qr-record-actions">
            <form
              action={(formData) => {
                startTransition(() => {
                  if (status === "archived") {
                    void restoreQrCodeAction(formData);
                    setStatus("active");
                    return;
                  }

                  void archiveQrCodeAction(formData);
                  setStatus("archived");
                });
              }}
            >
              <input type="hidden" name="id" value={initialDesign.id} />
              <button className="admin-button admin-button--secondary" type="submit" disabled={isPending}>
                {status === "archived" ? (
                  <RotateCcw size={18} aria-hidden="true" />
                ) : (
                  <Archive size={18} aria-hidden="true" />
                )}
                {status === "archived" ? "Herstellen" : "Archiveren"}
              </button>
            </form>

            <form action={deleteQrCodeAction}>
              <input type="hidden" name="id" value={initialDesign.id} />
              <button className="admin-button admin-button--ghost" type="submit">
                <Trash2 size={18} aria-hidden="true" />
                Verwijderen
              </button>
            </form>
          </div>
        ) : null}
      </section>

      <aside className="qr-panel qr-preview-panel" aria-label="QR-code preview">
        <div className="qr-preview-card">
          <div className="qr-preview" ref={previewRef} />
          <div>
            <h2>{name}</h2>
            <p>{targetLabels[targetType]}</p>
            <code>{qrPayload}</code>
          </div>
        </div>

        {targetType === "wifi" && !targetConfig.password ? (
          <p className="qr-warning">
            WiFi-wachtwoorden worden niet opgeslagen. Vul het wachtwoord opnieuw in voor herprinten.
          </p>
        ) : null}
      </aside>

      <section className="qr-print-area" aria-label="A4 stickerlabels">
        <div
          className="qr-sheet"
          style={{
            gridTemplateColumns: `repeat(${labelConfig.columns}, ${labelConfig.labelWidthMm}mm)`,
            gridAutoRows: `${labelConfig.labelHeightMm}mm`,
            gap: `${labelConfig.gapMm}mm`,
          }}
        >
          {printLabels.map((index) => (
            <article
              key={index}
              className={labelConfig.showBorder ? "qr-label qr-label--bordered" : "qr-label"}
            >
              {labelImageUrl ? <img src={labelImageUrl} alt="" /> : null}
              <div>
                <strong>{labelConfig.title}</strong>
                <span>{labelConfig.subtitle}</span>
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
          <div className="qr-control-grid">
            <label>
              Product
              <select
                value={targetConfig.productId ?? ""}
                onChange={(event) => handleProductChange(Number(event.target.value))}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Productslug
              <input
                type="text"
                value={targetConfig.productSlug ?? ""}
                onChange={(event) => updateTargetConfig({ productSlug: event.target.value })}
              />
            </label>
          </div>
        );
      case "category":
        return (
          <label>
            Categorie
            <select
              value={targetConfig.categorySlug ?? ""}
              onChange={(event) => updateTargetConfig({ categorySlug: event.target.value })}
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
          <div className="qr-control-grid">
            <label>
              Actie URL
              <input
                type="url"
                value={targetConfig.url ?? ""}
                onChange={(event) => updateTargetConfig({ url: event.target.value })}
                placeholder={`${normalizeSiteUrl(siteUrl)}/kortingen`}
              />
            </label>
            <label>
              Kortingscode
              <input
                type="text"
                value={targetConfig.code ?? ""}
                onChange={(event) => updateTargetConfig({ code: event.target.value })}
              />
            </label>
          </div>
        );
      case "whatsapp":
        return (
          <div className="qr-control-grid">
            <label>
              Telefoonnummer
              <input
                type="tel"
                value={targetConfig.phone ?? ""}
                onChange={(event) => updateTargetConfig({ phone: event.target.value })}
                placeholder="316..."
              />
            </label>
            <label>
              Bericht
              <input
                type="text"
                value={targetConfig.message ?? ""}
                onChange={(event) => updateTargetConfig({ message: event.target.value })}
              />
            </label>
          </div>
        );
      case "email":
        return (
          <div className="qr-control-grid">
            <label>
              E-mailadres
              <input
                type="email"
                value={targetConfig.email ?? ""}
                onChange={(event) => updateTargetConfig({ email: event.target.value })}
              />
            </label>
            <label>
              Onderwerp
              <input
                type="text"
                value={targetConfig.subject ?? ""}
                onChange={(event) => updateTargetConfig({ subject: event.target.value })}
              />
            </label>
            <label className="qr-control-grid__wide">
              Bericht
              <textarea
                value={targetConfig.body ?? ""}
                onChange={(event) => updateTargetConfig({ body: event.target.value })}
              />
            </label>
          </div>
        );
      case "wifi":
        return (
          <div className="qr-control-grid">
            <label>
              Netwerknaam
              <input
                type="text"
                value={targetConfig.ssid ?? ""}
                onChange={(event) => updateTargetConfig({ ssid: event.target.value })}
              />
            </label>
            <label>
              Wachtwoord
              <input
                type="password"
                value={targetConfig.password ?? ""}
                onChange={(event) => updateTargetConfig({ password: event.target.value })}
                autoComplete="new-password"
              />
            </label>
            <label>
              Beveiliging
              <select
                value={targetConfig.encryption ?? "WPA"}
                onChange={(event) =>
                  updateTargetConfig({ encryption: event.target.value as TargetConfig["encryption"] })
                }
              >
                <option value="WPA">WPA/WPA2</option>
                <option value="WEP">WEP</option>
                <option value="nopass">Geen wachtwoord</option>
              </select>
            </label>
            <label className="qr-checkbox">
              <input
                type="checkbox"
                checked={Boolean(targetConfig.hidden)}
                onChange={(event) => updateTargetConfig({ hidden: event.target.checked })}
              />
              Verborgen netwerk
            </label>
          </div>
        );
      case "text":
        return (
          <label>
            Tekst
            <textarea
              value={targetConfig.text ?? ""}
              onChange={(event) => updateTargetConfig({ text: event.target.value })}
            />
          </label>
        );
      case "url":
      default:
        return (
          <label>
            URL
            <input
              type="url"
              value={targetConfig.url ?? ""}
              onChange={(event) => updateTargetConfig({ url: event.target.value })}
              placeholder={normalizeSiteUrl(siteUrl)}
            />
          </label>
        );
    }
  }
}
