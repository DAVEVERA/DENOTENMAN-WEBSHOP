export const CUSTOMER_SERVICE_WHATSAPP_NUMBER = "31411700232";
export const CUSTOMER_SERVICE_WHATSAPP_URL = `https://wa.me/${CUSTOMER_SERVICE_WHATSAPP_NUMBER}`;
export const CUSTOMER_SERVICE_PHONE_E164 = "+31411700232";
export const CUSTOMER_SERVICE_PHONE_DISPLAY = "+31 411 700 232";

export const CUSTOMER_SERVICE_MARKET_VISITS = [
  { id: "hilvarenbeek", weekday: 4, location: "Hilvarenbeek", opensAt: "08:00", closesAt: "12:00" },
  { id: "uden", weekday: 5, location: "Uden", opensAt: "08:00", closesAt: "12:30" },
  { id: "antwerpen", weekday: 6, location: "Antwerpen", opensAt: "08:00", closesAt: "16:00" },
] as const;

export const CUSTOMER_SERVICE_PHONE_HOURS = [
  { weekday: 1, opensAt: "11:00", closesAt: "15:00" },
  { weekday: 2, opensAt: "11:00", closesAt: "15:00" },
  { weekday: 3, opensAt: "11:00", closesAt: "15:00" },
  { weekday: 4, opensAt: "11:00", closesAt: "15:00" },
  { weekday: 5, opensAt: "11:00", closesAt: "15:00" },
  { weekday: 6, opensAt: null, closesAt: null },
  { weekday: 0, opensAt: null, closesAt: null },
] as const;
