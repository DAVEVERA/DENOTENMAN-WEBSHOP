export const storefrontMenuRootOrder = [
  "noten",
  "gedroogd-fruit",
  "chocolade-zoet",
  "muesli-granen",
  "pitten-zaden",
  "snacks-zoutjes",
  "bakproducten",
  "honing-natuurvoeding",
] as const;

export const storefrontMenuParentSlug = {
  "gedroogd-fruit": null,
  "pitten-zaden": null,
  pitten: "pitten-zaden",
  zaden: "pitten-zaden",
} as const;
