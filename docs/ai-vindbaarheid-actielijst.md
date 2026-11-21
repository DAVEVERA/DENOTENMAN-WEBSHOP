# De Notenman | AI Vindbaarheid: actielijst

Status: werkdocument, 21 november 2026. Geen automatische wijzigingen aan productfeiten.

## P0 - verifiëren vóór corrigeren

- [ ] **Productgegevens ontbreken mogelijk:** controleer voor "Amandelen Wit Gebrand Gezouten" de ingrediënten op de publieke NL-pagina tegen de brongegevens. Leg product-ID, URL, taal, veld en ruwe server-HTML vast. Alleen als afwezigheid bevestigd is: broninformatie laten aanvullen; nooit ingrediënten genereren.
- [ ] **Taalvermenging:** controleer de gerapporteerde Nederlandse ingrediënt-/allergenenteksten op EN- en FR-productpagina's. Bepaal of het om onvertaalde bronvelden, fallbacks of template-labels gaat. Corrigeer alleen geverifieerde vertaalfouten.
- [ ] **Voedingswaarden:** vergelijk voedingswaarden van hetzelfde product en dezelfde variant tussen NL, EN en FR, inclusief eenheden en portiebasis. Repareer uitsluitend afwijkingen ten opzichte van betrouwbare productgegevens.
- [ ] **Categorievertalingen:** controleer gemelde Nederlandse productnamen/beschrijvingen in FR-categorieoverzichten en verifieer vertaaldekking en fallbacks.

Deze vier punten zijn vooralsnog **auditmeldingen uit een beperkte steekproef**, geen catalogusbrede vastgestelde defecten.

## P1 - technische crawlers en indexeerbaarheid

- [ ] Vergelijk ruwe initiële HTTP-HTML (zonder JavaScript) met browserweergave voor representatieve NL/EN/FR-productpagina's.
- [ ] Valideer HTTP-status, robots/noindex, canonical, hreflang, H1, producttitel, zichtbare beschrijving en Product JSON-LD per URL.
- [ ] Vergelijk openbare prijs, beschikbaarheid, valuta en variantinformatie met JSON-LD en de betrouwbare productbron.
- [ ] Controleer categoriepagina's, sitemapdekking, interne links en pagina's zonder canonieke productroute.
- [ ] Sla bewijs vast per URL, taal, testtijd en exacte controle; voorkom dat één fout voor de gehele catalogus wordt gegeneraliseerd.

## P1 - beheer en veilige fixes

- [x] Metadata-fixes via OWNER/ADMIN-permissies en transactionele auditlogging (PR #3).
- [x] Vijf regressietests en TypeScript-check geslaagd in GitHub Actions-run 44952438978.
- [ ] Bouw een bevindingenoverzicht met status: te verifiëren / bevestigd / opgelost / opnieuw getest.
- [ ] Alleen deterministische fixes op basis van gecontroleerde brongegevens automatiseren.
- [ ] Zorg dat inhoudelijke wijzigingen en verschillen in voedingswaarden handmatige bronvalidatie vereisen.
- [ ] Voer na iedere correctie opnieuw een publieke storefront-controle uit.

## P2 - AI-zichtbaarheid

- [ ] Definieer representatieve koopvragen per productcategorie.
- [ ] Meet vermeldingen, bronlinks en feitelijke juistheid met herhaalde reproduceerbare metingen.
- [ ] Houd GEO-resultaten gescheiden van technische crawlbaarheid; geen onbewezen totaalscore.

## Releasevoorwaarden

Geen merge of productie-uitrol vóór geslaagde relevante tests, bevestigde HTTP-crawlresultaten en een gecontroleerde review van de wijzigingen.
