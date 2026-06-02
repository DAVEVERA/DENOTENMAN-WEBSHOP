# Security Runbook

## Huidige Status

- Admin login gebruikt `ADMIN_EMAIL`, `ADMIN_PASSWORD` en `ADMIN_SESSION_SECRET`.
- Admin sessies staan in een gesigneerde httpOnly cookie.
- Product write-actions vragen server-side een geldige adminsessie.
- Supabase security advisor gaf na hardening `0` lints terug.

## Supabase

- Publieke catalogusdata is alleen bedoeld voor actieve producten.
- Private backup-tabellen en `orders` hebben RLS aan.
- `anon` en `authenticated` hebben geen select-rechten op private tabellen.
- `product-images` is publiek voor directe object-URL's, zonder brede `storage.objects` listing-policy.
- Admin media-writes blijven server-side via service-role. Browserrollen krijgen geen upload/update/delete policy op `product-images`.
- Nieuwe admin-tabellen gebruiken RLS met service-role beheerpolicies; publieke select policies bestaan alleen waar storefront reads nodig zijn, zoals actieve categorieen, producten, varianten, gewichten, gepubliceerde content en gepubliceerde reviews.
- Admin uploads blijven server-side via service-role.

## Secrets

Geroteerde productiegeheimen moeten in hosting/Supabase worden gezet, niet in git. Secrets die in chat of logs zijn beland moeten worden vervangen voordat productie live gaat.

## Open Punten

- Adminrollen zijn nu nog eenvoudig; later uitbreiden naar rollen/permissies.
- Customer auth en order-RLS moeten samen met checkout ontworpen worden.
- Migration-history mismatch (`MIGRATIONS_FAILED`) moet nog apart worden gerepareerd.
