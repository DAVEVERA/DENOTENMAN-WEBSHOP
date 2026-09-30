// Where the admin came from when a tool sends them to the product editor.
// Only internal CopyWriter pages are accepted, so the link can never point elsewhere.
const copywriterReturnPattern = /^\/admin\/design-studio\/copywriter(?:\/[A-Za-z0-9_-]{1,100})?(?:\?[A-Za-z0-9=&%._+-]{0,300})?$/u;

export function safeCopywriterReturnTo(value: string | string[] | null | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !copywriterReturnPattern.test(candidate)) return null;
  return candidate;
}

export function productEditorHref(productId: string, returnTo?: string): string {
  const base = `/admin/producten/${encodeURIComponent(productId)}`;
  const safe = safeCopywriterReturnTo(returnTo);
  return safe ? `${base}?terug=${encodeURIComponent(safe)}` : base;
}
