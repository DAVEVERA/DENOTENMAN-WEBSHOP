# Transactionele e-mail

## Providerkeuze

De webshop kiest uitsluitend op de server één provider:

1. `MAILCHIMP_TRANSACTIONAL_API_KEY` — Mailchimp Transactional (Mandrill).
2. `RESEND_API_KEY` — Resend, alleen wanneer het ingestelde verzenddomein geverifieerd is.

`MAILCHIMP_API_KEY` is alleen voor Mailchimp Marketing, audiences en nieuwsbrieven. Deze key is niet geldig voor de Transactional API.

De afzender wordt bepaald door:

- `MAIL_FROM_NAME` (standaard `De Notenman`)
- `MAIL_FROM_EMAIL` (standaard `bestellingen@denotenman.com`)
- `MAIL_REPLY_TO` (optioneel)
- `ORDER_NOTIFICATION_EMAIL` (optioneel; standaard `info@denotenman.com`)

## Resend DNS voor denotenman.com

Het domein `denotenman.com` is in Resend aangemaakt in regio `eu-west-1` met verplichte TLS. Publiceer bij de DNS-provider exact deze records:

| Doel | Naam | Type | Prioriteit | Waarde |
| --- | --- | --- | ---: | --- |
| DKIM | `resend._domainkey` | TXT | — | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC2ybWbOcBrOksmshs+x7Ewj5bpiRBKy5/aUF7hRDb4Gr+ZxA+6QaLd8nS6HUlpswmzJ5T7l0kDl7dsmWvQSUtfMQJIFUjX8965LkgqLVhwz1TYv5XB3pbVF7ZcSdxEcPGfGzvjYURYBLt4hbe6W5ineUlsZE7DIGXGirnfPuTapwIDAQAB` |
| Bouncefeedback | `send` | MX | 10 | `feedback-smtp.eu-west-1.amazonses.com` |
| SPF | `send` | TXT | — | `v=spf1 include:amazonses.com ~all` |

Controleer na DNS-publicatie in `/admin/marketing/aftersales` of de status `Verzendklaar` toont. Activeer de flow pas daarna en verstuur eerst één testmail naar een intern adres.

## Productieconfiguratie

Secrets horen in Google Secret Manager en worden als runtime-secret aan Cloud Run gekoppeld. Zet nooit een API-key in Git of als publieke Next.js-variabele.

Voor Mailchimp Transactional:

```powershell
gcloud run services update denotenman-webshop `
  --project=project-5dc79156-4200-4528-bfc `
  --region=europe-west4 `
  --update-secrets=MAILCHIMP_TRANSACTIONAL_API_KEY=denotenman-mailchimp-transactional-api-key:latest
```

Voor de gecontroleerde Resend-route:

```powershell
gcloud run services update denotenman-webshop `
  --project=project-5dc79156-4200-4528-bfc `
  --region=europe-west4 `
  --update-secrets=RESEND_API_KEY=denotenman-resend-api-key:latest
```

## Verzendgaranties

- Bestel- en verzendmails gebruiken altijd het actuele `Order.contactEmail` uit de database.
- Een afwijkende ontvanger wordt vóór verzending geblokkeerd met `RECIPIENT_MISMATCH`.
- Iedere mail heeft een unieke idempotentiesleutel.
- Fedor ontvangt alleen `NEW_ORDER_NOTIFICATION`: precies eenmaal nadat Mollie de eerste betaalde status heeft bevestigd. Test-, verzend- en latere statuswijzigingen sturen deze interne mail niet opnieuw.
- Iedere poging wordt apart vastgelegd in `EmailDeliveryAttempt`.
- Onderwerp, HTML en tekst worden als verzendsnapshot opgeslagen in `EmailDeliveryLog`.
- `ACCEPTED` betekent dat de provider de mail heeft aangenomen; dit is niet hetzelfde als bewezen inboxaflevering.
- Alleen een mislukte mail kan handmatig opnieuw worden aangeboden.
- Bij een bestelling wordt een retry geblokkeerd wanneer het actuele klantadres afwijkt van de oorspronkelijke verzendsnapshot.
