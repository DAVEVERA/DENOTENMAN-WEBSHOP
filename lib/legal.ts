export const LEGAL_LAST_UPDATED = "23 augustus 2026";
export const LEGAL_IDENTITY = {
  tradeName: "De Notenman",
  attention: "Fedor",
  businessDescription: "Ambulante handel in noten en zuidvruchten.",
  registrationNumber: "75797003",
  establishmentNumber: "000043648762",
  vatNumber: "NL005289527B87",
  sbiRegistrations: [
    {
      source: "SBI (KVK)",
      code: "47279",
      description: "Gespecialiseerde detailhandel in overige voedings- en genotmiddelen (rest)",
    },
    {
      source: "SBI (CI)",
      code: "47210",
      description: "Detailhandel in aardappelen, groenten en fruit",
    },
  ],
  address: "Oude Baan 7a, 5076 PJ Haaren",
  /**
   * The same address in parts, for schema.org PostalAddress. Kept beside the
   * display string rather than parsed out of it; a test asserts the two stay
   * in agreement.
   */
  postalAddress: {
    streetAddress: "Oude Baan 7a",
    postalCode: "5076 PJ",
    addressLocality: "Haaren",
    addressCountry: "NL",
  },
  returnAddress: "Oude Baan 7a, 5076 PJ Haaren",
  email: "info@denotenman.com",
  website: "https://denotenman.com",
  /** Public profiles, emitted as schema.org sameAs. */
  socialProfiles: [
    "https://www.instagram.com/de_notenman",
    "https://www.facebook.com/denotenman",
  ],
} as const;
