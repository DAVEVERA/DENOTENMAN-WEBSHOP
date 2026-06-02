export type CustomerInput = {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
};

export function validateCustomerInput(input: CustomerInput) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new Error("E-mailadres is ongeldig.");
  }
  if (!input.firstName.trim() || !input.lastName.trim()) {
    throw new Error("Voornaam en achternaam zijn verplicht.");
  }
  return input;
}
