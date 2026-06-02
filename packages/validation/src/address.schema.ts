export type AddressInput = {
  firstName: string;
  lastName: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  country: string;
};

export function validateAddressInput(input: AddressInput) {
  const required: Array<keyof AddressInput> = [
    "firstName",
    "lastName",
    "street",
    "houseNumber",
    "postalCode",
    "city",
    "country",
  ];

  for (const key of required) {
    if (!input[key].trim()) throw new Error(`${key} is verplicht.`);
  }

  return input;
}
