# De Notenman Webshop - Admin Manual

Laatst bijgewerkt: 2026-05-15

Dit document is het centrale overdrachtspunt voor de bouw van de adminomgeving. De applicatie zit in scaffold- en stabilisatiefase: de routes en mappenstructuur staan grotendeels, maar veel domeinlogica, databasekoppelingen en integraties zijn nog placeholders.

## Huidige Status

De monorepo bevat drie apps:

- `apps/storefront`: publieke webshop.
- `apps/admin`: beheeromgeving.
- `apps/worker`: achtergrondtaken.

Daarnaast zijn er workspace packages voor onder meer commerce, database, validatie, Mollie, PostNL, e-mail, SEO, analytics, media, config en UI.

De eerste stabilisatiestap is afgerond:

- `@denotenman/admin` typecheckt succesvol.
- `@denotenman/storefront` typecheckt succesvol.
- `@denotenman/worker` typecheckt succesvol.
- De volledige workspace typecheckt succesvol via `pnpm typecheck` met 14/14 packages/apps groen.
- De eerder bekende blockers in `Modal.tsx`, `categorieen/nieuw`, `instellingen`, `CheckoutLayout` en `merken/[slug]` zijn hersteld.
- `@denotenman/config`, `@denotenman/validation`, `@denotenman/commerce`, `@denotenman/media` en `@denotenman/analytics` hebben nu echte TypeScript exports en eigen `tsconfig.json`.
- Worker jobs, queues en cronbestanden hebben nu contracten en veilige dry-run handlers.
- Tests bevatten eerste unit tests voor commerce en flowdoelen voor integratie/E2E.
- Documentatie buiten deze admin manual is gevuld met architectuur-, security-, deployment- en integratierunbooks.
- Storefront winkelwagen gebruikt nu een httpOnly cart-cookie en rekent totals via `@denotenman/commerce`.
- Checkout gebruikt nu een httpOnly checkout-cookie en valideert gegevens via `@denotenman/validation`.
- Checkout kan een order-draft voorbereiden zonder Mollie side effects.
- Checkout kan optioneel een Mollie testbetaling aanmaken en naar de Mollie checkout URL redirecten zodra `MOLLIE_ENABLE_PAYMENTS=true` staat en de API key met `test_` begint.
- Zonder die expliciete test-gate blijft checkout veilig in draftmodus.
- Mollie webhooks zijn beschermd tegen dubbele statusupdates en late non-terminal downgrades.
- De checkout succespagina toont server-side de actuele orderstatus en betaalstatus uit Supabase.
- Supabase heeft nu een Mollie-ready order draft basis:
  - `orders` is uitgebreid met ordernummer, cents-totalen, checkout-state en paymentstatus.
  - `order_items` bevat genormaliseerde orderregels.
  - `payments` bevat draft/payment records voor de latere Mollie-koppeling.
  - Browserrollen blijven geblokkeerd; service-role beheert deze private tabellen.
- Checkout draft smoke-test heeft testorder `DNM-20260515-65641` aangemaakt met status `pending` en paymentstatus `draft`.
- Mollie-disabled smoke-test heeft testorder `DNM-20260515-66974` aangemaakt met status `pending`, paymentstatus `draft`, provider `mollie` en zonder provider payment id.
- Succespagina smoke-test toont voor `DNM-20260515-66974` remote status `pending` en betaalstatus `draft`.

De database-baseline is gestart:

- Remote Supabase-project `luablfcmhzykjnxmtlqh` heet `nutty` en draait Postgres 17.6.
- Remote catalogus bevat 77 actieve producten, 129 varianten en 98 productgewichten.
- Lokale migrations beschrijven nu de bestaande remote catalogustabellen.
- `packages/db` bevat eerste producttypes en queryhelpers voor storefront/admin gebruik.
- `@denotenman/db`, `@denotenman/storefront` en `@denotenman/admin` typechecken succesvol na deze stap.
- Storefront `/winkel`, `/categorie/[slug]` en `/winkel/[slug]` lezen nu remote Supabase catalogusdata.
- Lokale smoke-test is uitgevoerd op `http://localhost:3000/winkel` en een echte productdetailpagina.
- Admin `/producten`, `/producten/nieuw`, `/producten/[id]` en `/producten/[id]/media` zijn gekoppeld aan remote Supabase catalogusdata.
- Admin kan server-side producten opslaan en productfoto's uploaden naar `product-images` via een service-role server action.
- Productmedia ondersteunt nu een galerij via `product_media` en `media_assets`; de primaire foto synchroniseert terug naar `products.image` voor storefront-compatibiliteit.
- Admin `/producten/[id]/varianten` beheert productgewichten, varianten, SKU's, prijzen en voorraadlabels.
- Producten kunnen vanuit de detailpagina veilig verborgen of opnieuw zichtbaar gemaakt worden zonder hard delete.
- Lokale smoke-test is uitgevoerd op `http://localhost:3001/producten` en een echte productdetailpagina.
- Admin login is toegevoegd met een gesigneerde httpOnly sessie-cookie.
- Admin routes worden beschermd via Next.js `proxy.ts`; zonder sessie redirect `/producten` naar `/login?next=%2Fproducten`.
- Product write-actions vereisen server-side een geldige adminsessie voordat Supabase-mutaties of foto-uploads worden uitgevoerd.
- Supabase security hardening is remote toegepast:
  - `public.image_backup_products`, `public.image_backup_product_variants`, `public.backup_products_image` en `public.orders` hebben RLS aan.
  - `anon` en `authenticated` hebben geen select-rechten op deze private tabellen.
  - Alleen `service_role` heeft beheerpolicies voor deze private tabellen.
  - `product-images` heeft geen brede `storage.objects` listing-policy.
  - `public.rls_auto_enable()` is niet meer uitvoerbaar voor `anon` of `authenticated`.
- Supabase security advisor-check geeft momenteel `0` lints terug.
- Admin-login env vars staan lokaal in `.env.prod` voor verificatie.
- Admin productbeheer is end-to-end getest via browser:
  - Testproduct: `1077`, slug `test-product-1778856205084`.
  - Product is bewust verborgen (`is_active = false`) zodat het niet publiek in de winkel verschijnt.
  - Foto-upload naar `product-images` is gelukt.
  - Gewicht `100g test` en variant `Testvariant` zijn opgeslagen.
  - Admin detailroute blijft beschermd en redirect zonder sessie naar login.
  - Storefront `/winkel` toont het testproduct niet; `/winkel/test-product-1778856205084` rendert als 404.
- Admin dashboard, bestellingen, betalingen, klanten, voorraad, categorieen, media, audit-log, CMS-lijsten, marketinglijsten, reviews, shipment-labels, retouren en refund-requests zijn nu gekoppeld aan echte Supabase-data.
- Admin orderdetail toont echte klantgegevens, orderregels, betalingen en totalen.
- Admin orderstatus kan via beveiligde server action worden aangepast.
- Admin order-subpagina's voor verzending, factuur en retour tonen echte orderdata en geen voorbeeldrecords meer.
- Admin Mollie/refunds-pagina's tonen echte configuratie/paymentdata zonder fake records.
- Admin B2B-pagina's gebruiken B2B-tabellen zodra migrations zijn toegepast; zolang tabellen ontbreken tonen ze een expliciete configuratiestatus.
- Admin zakelijke facturenpagina gebruikt echte orders als factuurbasis.
- Admin instellingenpagina's tonen echte server-side configuratiestatus zonder secrets en kunnen algemene/e-mailinstellingen opslaan in `admin_settings`.
- Admin verzendingsoverzichten, labels, retouren en reviews tonen geen fake records meer.
- Admin product-SEO gebruikt echte productdata.

## Empty-File Audit

Er zijn momenteel 184 lege bestanden buiten `node_modules`, `.next`, `.turbo` en `.git`. Dat is geen directe compile-fout, maar blijft bouwschuld.

Belangrijkste clusters:

- `apps/storefront`: lege actions, libs en meerdere component-placeholders.
- `apps/admin`: de eerder lege core actions voor categorieen, CMS, klanten, media en instellingen zijn gevuld; enkele B2B component-placeholders blijven nog presentatiewerk.
- `packages/postnl`, `packages/email`, `packages/seo` en `packages/ui`: nog veel lege bronbestanden.
- `database-map/*`: documentatie is grotendeels leeg.
- Integratie- en E2E-tests hebben doelen, maar nog geen volledige runnerconfiguratie.

Conclusie: de codebase is nu compile-stabiel voor de hoofdapps, maar nog niet functioneel compleet.

## Risico-Indeling

Hoog risico:

- Supabase branch `main` meldt remote `MIGRATIONS_FAILED`; lokale en remote migration history lopen niet gelijk.
- Remote `public.orders` bevat nog legacy kolom `stripe_payment_intent_id`; deze is nullable gemaakt, maar pas later opruimen na volledige Mollie-livegang.
- Mollie is technisch voorbereid voor create-payment, webhookstatus en refund-helper, maar nog niet live getest met een echte Mollie test-key en publieke webhook-URL.
- PostNL/e-mail packages zijn nog grotendeels placeholders; verzending en e-mail draaien nog niet echt.
- Worker handlers zijn nu contractueel gevuld, maar doen nog geen echte externe side effects.
- Integratie/E2E tests zijn nog niet gekoppeld aan een runner en fixtures.

Middel risico:

- Storefront en admin gebruiken nog veel hardcoded demo-inhoud.
- Admin restmodules hebben nu basistabellen en read/write-routes voor de belangrijkste beheerflows; resterend werk zit vooral in rijke UI, validatieregels per domein, externe side effects en E2E-dekking.
- Admin login vereist nog productie-env vars: `ADMIN_EMAIL`, `ADMIN_PASSWORD` en `ADMIN_SESSION_SECRET`.
- Integratiedocumentatie voor Mollie, PostNL, deployment en security bestaat nu op hoofdlijnen, maar moet bij implementatie worden verdiept.

Laag risico:

- Lege marketing/docs/assets placeholders die niet in runtime flows zitten.
- UI package placeholders zolang de apps eigen lokale UI-componenten gebruiken.

## Voortzettingsstrategie

We bouwen vanaf nu per verticale flow. Elke flow moet aan het einde typecheckbaar zijn en waar mogelijk visueel of functioneel verifieerbaar.

Voorgestelde volgorde:

1. Database basis
   - Vul Supabase schema voor profielen, klanten, categorieen, producten, varianten, voorraad, carts, orders, payments en shipments.
   - Voeg minimale RLS policies toe.
   - Voeg seeddata toe voor lokale/demo-verificatie.

2. Storefront core
   - Productoverzicht, categoriefilter en productdetail koppelen aan data.
   - Winkelwagen-state en totals werkend maken.
   - Checkout validatie en order-aanmaak implementeren.

3. Admin core
   - Producten, categorieen, voorraad, bestellingen en instellingen beheerbaar maken.
   - Admin acties koppelen aan `packages/db` en validatie.

4. Integraties
   - Mollie payment create/webhook/refund.
   - PostNL label/status/retourlabel.
   - E-mailtemplates en worker jobs.

5. Tests en deployment
   - Unit tests voor pricing, cart, inventory en checkout.
   - Integratietests voor order-flow, Mollie webhook en PostNL label.
   - E2E tests voor homepage, product, cart, checkout, account en admin.
   - Deployment-, security- en runbook-documentatie vullen.

## Werkafspraken

Voor elke nieuwe stap:

- Eerst relevante bestanden lezen.
- Daarna klein en gericht implementeren.
- Geen grote refactor zonder noodzaak.
- Na wijzigingen minimaal de relevante typecheck draaien.
- Bij frontendwijzigingen daarna lokaal openen en visueel controleren zodra een devserver draait.
- Nieuwe functionaliteit pas aan integraties koppelen nadat de interne flow lokaal klopt.

## Eerstvolgende Aanbevolen Stap

De beste volgende stap voor de adminomgeving is de resterende adminmodules productieklaar maken:

- Zakelijk/B2B vervangen door echte Supabase-tabellen of expliciete "nog niet ingericht" beheerstatus.
- CMS/marketing/kortingen/reviews voorzien van echte opslag, actions en validatie.
- Verzendingsoverzichten koppelen aan PostNL/shipment-tabellen zodra het shipment-schema staat.
- Instellingen-subpagina's opslaan in een echte `admin_settings`/configuratietabel.
- Audit-log koppelen aan echte admin actions.

De beste volgende stap voor Mollie blijft testmodus end-to-end activeren:

- Zet een echte Mollie test-key in `MOLLIE_API_KEY`.
- Zet lokaal of op preview `MOLLIE_ENABLE_PAYMENTS=true`.
- Gebruik een publieke URL voor de webhook, bijvoorbeeld Vercel preview of tijdelijk via tunnel.
- Doorloop checkout en controleer dat `payments.provider_payment_id`, `payments.checkout_url` en Mollie redirect gevuld worden.
- Laat Mollie webhook terugkomen en controleer dat `payments.status`, `orders.payment_status` en `orders.status` worden bijgewerkt.
- Voeg daarna webhook event-logging en integratietests toe voordat live keys gebruikt worden.

Parallel blijft de migration-history mismatch (`MIGRATIONS_FAILED`) een aparte Supabase onderhoudstaak.
