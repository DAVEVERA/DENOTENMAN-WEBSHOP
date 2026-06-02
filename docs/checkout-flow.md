# Checkout Flow

Checkout is nog niet productie-klaar. De beoogde flow:

1. Klant vult winkelwagen.
2. Cart totals komen uit `@denotenman/commerce`.
3. Checkout input wordt gevalideerd via `@denotenman/validation`.
4. Server maakt een pending order aan.
5. Mollie payment wordt aangemaakt.
6. Webhook bevestigt betaling.
7. Voorraad wordt definitief afgeboekt.
8. Worker stuurt orderbevestiging en triggert verzending/factuur.

## Belangrijk

Remote `orders` bevat nog baseline-pariteit met `stripe_payment_intent_id`. De richting blijft Mollie; pas het schema pas aan wanneer payment create/webhook tegelijk wordt gebouwd.
