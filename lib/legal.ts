export const LEGAL_LAST_UPDATED = "21 augustus 2026";
export const LEGAL_IDENTITY = {
  tradeName: 'De Notenman',
  legalName: 'De Notenman',
  registrationNumber: '75797003',

  address: 'Oude Baan 7a 5076PJ Haaren',
  returnAddress: 'Oude Baan 7a, 5076PJ Haaren',
  email: 'info@denotenman.com',
  phoneDisplay: '+31 411 700 232',
  phoneHref: '+31411700232',
  website: 'https://denotenman.com',
} as const;

export const LEGAL_REVIEW_REQUIRED = [
  "juridische naam",
  "vestigings- en retouradres",
  "KvK-nummer",
  "btw-nummer",
] as const;
