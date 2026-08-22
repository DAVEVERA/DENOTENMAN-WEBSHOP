export const LEGAL_LAST_UPDATED = "23 augustus 2026";
export const LEGAL_IDENTITY = {
  tradeName: "De Notenman",
  legalName: "De Notenman",
  attention: "Fedor",
  businessDescription: "Ambulante handel in noten en zuidvruchten.",
  registrationNumber: "75797003",
  establishmentNumber: "000043648762",
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
  returnAddress: "Oude Baan 7a, 5076 PJ Haaren",
  email: "info@denotenman.com",
  phoneDisplay: "+31 411 700 232",
  phoneHref: "+31411700232",
  website: "https://denotenman.com",
  vatIdentificationNumber: null,
} as const;

export const LEGAL_REVIEW_REQUIRED = ["btw-identificatienummer"] as const;
