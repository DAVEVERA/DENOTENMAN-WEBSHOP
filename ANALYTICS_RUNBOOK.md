# GA4 omzet- en checkoutmeting

Deze implementatie meet alleen nadat de bezoeker analyticscookies heeft toegestaan. Testbestellingen (`Order.isTest`) worden bewust niet als omzet naar GA4 gestuurd.

## Events en bron van waarheid

| Event | Moment | Belangrijkste parameters |
| --- | --- | --- |
| `page_view` | Na een definitieve Next.js-route en bijgewerkte metadata | `page_title`, `page_location` |
| `begin_checkout` | Bij het openen van checkout met een gevulde winkelwagen | `value`, `currency`, `coupon`, `items` |
| `add_payment_info` | Nadat de server de Mollie-checkout heeft aangemaakt, vlak voor de redirect | `payment_type`, `value`, `currency`, `items` |
| `checkout_error` | Bij een geweigerde checkoutaanvraag of netwerk/clientfout | `error_code`, `delivery_method`, `payment_provider` |
| `checkout_payment_status` | Op de retourpagina na servercontrole bij Mollie | `transaction_id`, `payment_status`, `payment_method`, `payment_provider` |
| `purchase` | Alleen als `syncOrderPaymentStatus` de bestelling als `PAID`/`FULFILLED` bevestigt | `transaction_id`, `value`, `currency`, `shipping`, `coupon`, `items` |

`purchase.value` bevat de productwaarde na orderkorting en sluit verzendkosten uit. Verzendkosten staan afzonderlijk in `shipping`. De order-ID is de unieke `transaction_id`; de browser bewaart bovendien een verzendmarkering per transactie om dubbele events na vernieuwen te voorkomen.

## GA4-beheerinstellingen (opgeslagen op 23 augustus 2026)

In webstream `G-5YW8C6Y7F4` zijn de volgende productie-instellingen opgeslagen:

- browsegeschiedenis-gebaseerde automatische paginaweergaven zijn uitgeschakeld; de webshop verstuurt zelf pas na de definitieve Next.js-route een `page_view`;
- ongewenste verwijzer: **verwijzend domein bevat** `mollie.com`;
- cross-domain bevat Mollie niet. De getoonde Cloud Run-previewdomeinen zijn evenmin toegevoegd.

Mollie is een externe betaalprovider, geen eigen domein. Configureer Mollie daarom niet als cross-domain-domein. De return-URL blijft op dezelfde webshopbasis (`/{locale}/order/{orderId}`). De code geeft bij de eerste tagconfiguratie en bij events die direct van een Mollie-referrer terugkomen aanvullend `ignore_referrer: true` mee. Historische sessies worden niet met terugwerkende kracht aangepast.

Officiële documentatie: [ongewenste verwijzingen in GA4](https://support.google.com/analytics/answer/10327750), [GA4 aanbevolen events](https://developers.google.com/analytics/devguides/collection/ga4/reference/events) en [e-commercemeting](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce).

## Uitval analyseren

De volgende zes gebeurtenisgebonden aangepaste dimensies zijn in GA4 aanwezig en op 23 augustus 2026 opnieuw gecontroleerd:

- `payment_status`
- `payment_method`
- `payment_provider`
- `delivery_method`
- `error_code`
- `checkout_stage`

Apparaatcategorie is al een ingebouwde GA4-dimensie. `payment_method` komt rechtstreeks uit de gecontroleerde Mollie-payment wanneer Mollie deze waarde levert; anders is de waarde `unknown`. `payment_status` bewaart waar mogelijk de precieze Mollie-status, waaronder `paid`, `failed`, `expired`, `canceled`, `open` of `pending`.

Bouw daarna een verkenning met `begin_checkout` > `add_payment_info` > `checkout_payment_status` > `purchase` en splits op apparaatcategorie, `payment_method`, `payment_status` en `error_code`.

Browsermeting blijft terecht afhankelijk van geldige analytics-toestemming en een terugkeer naar de webshop. Een server-side `purchase` voor bezoekers die niet terugkeren vereist een aparte Measurement Protocol-secret, een consent-snapshot en een privacy-goedgekeurde client-/sessiekoppeling. Maak die secret niet aan zonder afzonderlijke beheer- en privacygoedkeuring.

## Campagneparameters

- Nieuwe of bijgewerkte Mailchimp-campagnes gebruiken Mailchimps eigen Google Analytics-linktracking met campagnenaam `denotenman_<titel>`. Voeg aan dezelfde Mailchimp-links niet ook handmatig UTM-parameters toe.
- Interne URL-, product-, categorie- en kortings-QR-codes krijgen automatisch `utm_source=qr_code`, `utm_medium=offline`, `utm_campaign=<qr-naam>` en `utm_content=<doeltype>`.
- Gebruik voor handmatige WhatsApp-links `utm_source=whatsapp&utm_medium=message&utm_campaign=<campagne>`.
- Gebruik voor organische sociallinks bijvoorbeeld `utm_source=instagram&utm_medium=social&utm_campaign=<campagne>` of dezelfde vorm met `facebook`.

Mailchimp-documentatie: [Google Analytics koppelen aan Mailchimp](https://mailchimp.com/help/integrate-google-analytics-with-mailchimp/).

## Controle na uitrol

1. Open Tag Assistant/GA4 DebugView en geef analytics-toestemming.
2. Navigeer zonder volledige paginavernieuwing tussen minstens drie routes en controleer per route precies één `page_view` met titel en volledige URL.
3. Doorloop checkout en controleer `begin_checkout` en `add_payment_info` inclusief `items`.
4. Gebruik voor een omzetcontrole een aparte testproperty of debug-sessie; laat testorders niet als productieomzet registreren.
5. Controleer bij een bevestigde echte betaling precies één `purchase` met dezelfde order-ID en de verwachte productwaarde.
6. Controleer na verwerking in GA4 dat nieuwe Mollie-retours de oorspronkelijke bron behouden. Historische attributie wordt niet met terugwerkende kracht herschreven.
