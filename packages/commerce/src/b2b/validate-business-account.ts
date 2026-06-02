export type BusinessAccountInput = {
  companyName: string;
  email: string;
  kvkNumber?: string | null;
  vatNumber?: string | null;
};

export function validateBusinessAccount(input: BusinessAccountInput) {
  if (!input.companyName.trim()) throw new Error("Bedrijfsnaam is verplicht.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error("E-mailadres is ongeldig.");
  return input;
}
