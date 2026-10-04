/** The 11-character video id in a YouTube watch, shorts, embed or youtu.be link. */
export function youtubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/u);
  return match?.[1] ?? null;
}

/** Shapes a newsletter video still can take; "original" keeps the source's own proportions. */
export const VIDEO_THUMBNAIL_ASPECTS = ["16:9", "1:1", "4:5", "original"] as const;
export type VideoThumbnailAspect = (typeof VIDEO_THUMBNAIL_ASPECTS)[number];

export const VIDEO_THUMBNAIL_ASPECT_LABELS: Record<VideoThumbnailAspect, string> = {
  "16:9": "Breed (16:9)",
  "1:1": "Vierkant (1:1)",
  "4:5": "Staand (4:5)",
  original: "Zoals het beeld",
};
