# Mollie Integratie

Status: technisch voorbereid, nog niet live getest met Mollie testbetalingen.

Gebouwd:

1. Payment create server-side via `@denotenman/mollie`.
2. Pending order koppelen aan Mollie payment id en checkout URL.
3. Webhook-handler haalt paymentstatus opnieuw op bij Mollie.
4. Paymentstatus wordt vertaald naar interne payment- en orderstatus.
5. Refund-helper is aanwezig in het package.
6. Dubbele webhooks en late non-terminal downgrades worden genegeerd.
7. Checkout succespagina toont actuele order- en betaalstatus uit Supabase.

Nog te testen:

1. Zet een echte Mollie test-key in `MOLLIE_API_KEY`.
2. Zet `MOLLIE_ENABLE_PAYMENTS=true`.
3. Gebruik een publieke `NEXT_PUBLIC_SITE_URL` zodat `/api/mollie/webhook` bereikbaar is.
4. Doorloop checkout en controleer de redirect naar Mollie.
5. Rond een testbetaling af en controleer webhook-updates in `payments` en `orders`.

## Randvoorwaarden

- Geen Mollie secrets naar client sturen.
- Webhook event-logging toevoegen voor productie-observability.
- Orderbedragen altijd server-side herberekenen.
- Alleen testbetalingen toestaan zolang de livegang niet expliciet is goedgekeurd.
