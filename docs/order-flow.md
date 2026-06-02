# Order Flow

## Statussen

De commerce package gebruikt deze statussen:

- `pending`
- `paid`
- `processing`
- `shipped`
- `completed`
- `cancelled`
- `refunded`

## Worker Taken

- Paymentstatus synchroniseren.
- Factuur genereren.
- Orderbevestiging sturen.
- PostNL label aanmaken.
- Verzendbevestiging sturen.

## Security

Orders blijven gesloten voor browserrollen totdat klant-auth, adminrollen en checkout-RLS samen zijn ontworpen.
