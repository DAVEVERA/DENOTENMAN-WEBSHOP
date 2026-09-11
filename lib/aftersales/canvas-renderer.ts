import type {
  AftersalesBlock,
  AftersalesCanvas,
  AftersalesColumn,
  AftersalesFont,
  AftersalesFontSize,
  AftersalesRow,
} from "@/lib/aftersales/schema";
import { blockTextKey } from "@/lib/aftersales/schema";

export type AftersalesCanvasRenderOptions = {
  escapeText: (value: string) => string;
  resolveText: (key: string) => string;
  defaultActionUrl: string;
};

const FONT_STACKS: Record<AftersalesFont, string> = {
  SANS: "Arial,Helvetica,sans-serif",
  SERIF: "Georgia,'Times New Roman',serif",
  MODERN: "'Segoe UI',Verdana,sans-serif",
};

const FONT_SIZE_PX: Record<AftersalesFontSize, number> = {
  COMPACT: 14,
  STANDAARD: 16,
  GROOT: 22,
};

function renderTextBlock(block: Extract<AftersalesBlock, { type: "text" }>, options: AftersalesCanvasRenderOptions): string {
  const text = options.escapeText(options.resolveText(blockTextKey(block.id))).replaceAll("\n", "<br>");
  const style = [
    `margin:0 0 12px`,
    `font-family:${FONT_STACKS[block.font]}`,
    `font-size:${FONT_SIZE_PX[block.size]}px`,
    `color:${block.color}`,
    `text-align:${block.align}`,
    `font-weight:${block.bold ? 700 : 400}`,
    block.italic ? "font-style:italic" : "",
    "line-height:1.5",
  ].filter(Boolean).join(";");
  return `<p style="${style}">${text}</p>`;
}

function renderImageBlock(block: Extract<AftersalesBlock, { type: "image" }>): string {
  if (!block.mediaUrl) return "";
  const img = `<img src="${block.mediaUrl}" alt="${block.alt}" width="${block.width}" style="display:block;width:100%;max-width:${block.width}px;height:auto;margin:0 0 12px" />`;
  return block.linkUrl ? `<a href="${block.linkUrl}" style="text-decoration:none">${img}</a>` : img;
}

function renderButtonBlock(block: Extract<AftersalesBlock, { type: "button" }>, options: AftersalesCanvasRenderOptions): string {
  const label = options.escapeText(options.resolveText(blockTextKey(block.id)));
  const href = block.linkUrl ?? options.defaultActionUrl;
  const style = [
    "display:inline-block",
    "min-height:44px",
    "box-sizing:border-box",
    "padding:14px 22px",
    `border-radius:${block.borderRadius}px`,
    `background:${block.backgroundColor}`,
    `color:${block.textColor}`,
    "font-size:16px",
    "font-weight:700",
    "text-align:center",
    "text-decoration:none",
    "margin:6px 0",
  ].join(";");
  return `<a href="${href}" style="${style}">${label}</a>`;
}

function renderFooterBlock(block: Extract<AftersalesBlock, { type: "footer" }>, options: AftersalesCanvasRenderOptions): string {
  const text = options.escapeText(options.resolveText(blockTextKey(block.id))).replaceAll("\n", "<br>");
  return `<p style="margin:0;color:#6e675c;font-size:13px;line-height:1.5">${text}</p>`;
}

function renderSpacerBlock(block: Extract<AftersalesBlock, { type: "spacer" }>): string {
  if (!block.showDivider) return `<div style="height:${block.heightPx}px;line-height:${block.heightPx}px;font-size:0">&nbsp;</div>`;
  return `<div style="height:${block.heightPx}px;box-sizing:border-box;padding-top:${Math.floor(block.heightPx / 2)}px"><div style="border-top:1px solid #ded7ca;font-size:0;line-height:0">&nbsp;</div></div>`;
}

function renderHeroBlock(block: Extract<AftersalesBlock, { type: "hero" }>, options: AftersalesCanvasRenderOptions): string {
  const heading = options.escapeText(options.resolveText(blockTextKey(block.id, "heading")));
  const body = options.escapeText(options.resolveText(blockTextKey(block.id, "body"))).replaceAll("\n", "<br>");
  const buttonLabel = options.escapeText(options.resolveText(blockTextKey(block.id, "button")));
  const containerStyle = [
    `background:${block.backgroundColor}`,
    block.backgroundUrl ? `background-image:url('${block.backgroundUrl}')` : "",
    block.backgroundUrl ? "background-size:cover" : "",
    block.backgroundUrl ? "background-position:center" : "",
    "padding:40px 24px",
    "text-align:center",
  ].filter(Boolean).join(";");
  const buttonStyle = [
    "display:inline-block",
    "min-height:44px",
    "box-sizing:border-box",
    "padding:14px 22px",
    "border-radius:8px",
    `background:${block.buttonColor}`,
    `color:${block.buttonTextColor}`,
    "font-size:16px",
    "font-weight:700",
    "text-align:center",
    "text-decoration:none",
    "margin-top:12px",
  ].join(";");
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse"><tbody><tr><td style="${containerStyle}"><h2 style="margin:0 0 10px;color:#ffffff;font-size:26px;line-height:1.3">${heading}</h2><p style="margin:0 0 16px;color:#ffffff;font-size:16px;line-height:1.5">${body}</p><a href="${options.defaultActionUrl}" style="${buttonStyle}">${buttonLabel}</a></td></tr></tbody></table>`;
}

function renderBannerBlock(block: Extract<AftersalesBlock, { type: "banner" }>, options: AftersalesCanvasRenderOptions): string {
  const text = options.escapeText(options.resolveText(blockTextKey(block.id)));
  const style = [
    `background:${block.backgroundColor}`,
    block.backgroundUrl ? `background-image:url('${block.backgroundUrl}')` : "",
    block.backgroundUrl ? "background-size:cover" : "",
    "padding:16px 20px",
    "text-align:center",
    `color:${block.textColor}`,
    "font-size:15px",
    "font-weight:700",
  ].filter(Boolean).join(";");
  return `<div style="${style}">${text}</div>`;
}

function renderCustomHtmlBlock(block: Extract<AftersalesBlock, { type: "customHtml" }>, options: AftersalesCanvasRenderOptions): string {
  return options.resolveText(blockTextKey(block.id));
}

function renderBlock(block: AftersalesBlock, options: AftersalesCanvasRenderOptions): string {
  switch (block.type) {
    case "text":
      return renderTextBlock(block, options);
    case "image":
      return renderImageBlock(block);
    case "button":
      return renderButtonBlock(block, options);
    case "footer":
      return renderFooterBlock(block, options);
    case "spacer":
      return renderSpacerBlock(block);
    case "hero":
      return renderHeroBlock(block, options);
    case "banner":
      return renderBannerBlock(block, options);
    case "customHtml":
      return renderCustomHtmlBlock(block, options);
    case "table":
    case "grid":
      // Implemented in a later task; an unrecognized block simply renders nothing yet.
      return "";
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}

function renderColumn(column: AftersalesColumn, options: AftersalesCanvasRenderOptions): string {
  const inner = column.blocks.map((block) => renderBlock(block, options)).join("");
  const widthPercent = Math.round(column.widthFraction * 100);
  return `<td width="${widthPercent}%" valign="top" style="background-color:${column.backgroundColor};padding:${column.padding}px">${inner}</td>`;
}

function renderRow(row: AftersalesRow, options: AftersalesCanvasRenderOptions): string {
  const cells = row.columns.map((column) => renderColumn(column, options)).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;background-color:${row.backgroundColor}"><tbody><tr style="padding:${row.padding}px"><td style="padding:${row.padding}px" colspan="${row.columns.length}"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse"><tbody><tr>${cells}</tr></tbody></table></td></tr></tbody></table>`;
}

export function renderAftersalesCanvas(canvas: AftersalesCanvas, blockText: Record<string, string>, options: AftersalesCanvasRenderOptions): string {
  const resolveText = options.resolveText ?? ((key: string) => blockText[key] ?? "");
  const rowOptions: AftersalesCanvasRenderOptions = { ...options, resolveText };
  return canvas.rows.map((row) => renderRow(row, rowOptions)).join("");
}
