export type ImageSize = {
  width: number;
  suffix: string;
};

export const defaultProductImageSizes: ImageSize[] = [
  { width: 320, suffix: "sm" },
  { width: 640, suffix: "md" },
  { width: 960, suffix: "lg" },
  { width: 1280, suffix: "xl" },
];

export function generateImageSizes(originalWidth: number, sizes = defaultProductImageSizes) {
  return sizes.filter((size) => size.width <= originalWidth);
}
