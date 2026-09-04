export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export type GridBlockItem = {
  imageUrl: string | null;
  imageAlt: string;
  heading: string;
  body: string;
};

export function buildGridBlockHtml(items: GridBlockItem[]): string {
  const filtered = items.filter((item) => item.heading.trim() || item.body.trim() || item.imageUrl);
  if (filtered.length === 0) return "";
  const cells = filtered.map((item) => `
    <td width="50%" valign="top" style="padding:0 8px 16px 0">
      ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.imageAlt || item.heading)}" width="260" style="display:block;width:100%;max-width:260px;height:auto;border-radius:8px;margin:0 0 8px" />` : ""}
      ${item.heading ? `<p style="margin:0 0 4px;color:#141414;font-size:15px;font-weight:700">${escapeHtml(item.heading)}</p>` : ""}
      ${item.body ? `<p style="margin:0;color:#4f4a42;font-size:14px;line-height:1.5">${escapeHtml(item.body)}</p>` : ""}
    </td>`);
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(`<tr>${cells.slice(i, i + 2).join("")}</tr>`);
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 18px"><tbody>${rows.join("")}</tbody></table>`;
}

export function buildTableBlockHtml(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return "";
  const head = headers.length > 0
    ? `<tr>${headers.map((header) => `<th style="padding:8px 10px;border-bottom:2px solid #e0b200;text-align:left;color:#141414;font-size:13px;font-weight:700">${escapeHtml(header)}</th>`).join("")}</tr>`
    : "";
  const body = rows.map((cells) => `<tr>${cells.map((cell) => `<td style="padding:8px 10px;border-bottom:1px solid #e4dfd5;color:#333;font-size:14px">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 18px">${head ? `<thead>${head}</thead>` : ""}<tbody>${body}</tbody></table>`;
}
