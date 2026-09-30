/** The 11-character video id in a YouTube watch, shorts, embed or youtu.be link. */
export function youtubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/u);
  return match?.[1] ?? null;
}
