export const LEGAL_LAST_UPDATED = "21 augustus 2026";
export const LEGAL_IDENTITY = {
  tradeName: "De Notenman",
  legalName: "[Juridische naam invullen]",
  registrationNumber: "[KvK-nummer invullen]",
  vatNumber: "[Btw-nummer invullen]",
  address: "[Vestigingsadres invullen]",
  returnAddress: "[Retouradres invullen]",
  email: "info@denotenman.com",
  phoneDisplay: "+31 411 700 232",
  phoneHref: "+31411700232",
  website: "https://denotenman.com",
} as const;

export const LEGAL_REVIEW_REQUIRED = [
  "juridische naam",
  "vestigings- en retouradres",
  "KvK-nummer",
  "btw-nummer",
] as const;
