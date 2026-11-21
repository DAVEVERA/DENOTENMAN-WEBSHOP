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


## P1 - Dashboardwidgets op de adminvoorpagina

De bestaande dashboard-widgetbouwer (lib/dashboard/schema.ts, sources.ts en AdminDashboardWorkspace)
wordt hergebruikt. Geen los dashboardsysteem maken.

Gewenste optionele widgets, elk met link naar /admin/ai-vindbaarheid:
- **Auditvoortgang:** aantal unieke actieve producten met een geldige laatste audit / alle actieve producten. Toon teller, noemer en meetdatum.
- **Datavolledigheid:** ingevulde verplichte velden / verwachte verplichte velden bij gecontroleerde producten. Regels en toepasselijkheid per product vastleggen.
- **Datakwaliteit:** gemiddelde deterministische productauditscore (0–100) van gecontroleerde producten, nooit presenteren als catalogusbrede score zolang dekking < 100%.
- **Openstaande bevindingen:** totaal uit laatste audits, uitsplitsing op ernst; sla status open/bevestigd/opgelost/hercontrole apart op.
- **Taaldekking:** complete NL/EN/FR-vertalingen / verwachte talen voor gecontroleerde producten, met afzonderlijk inzicht per taal.

Implementatievolgorde:
1. [x] Pure aggregatie met expliciete nulls voor onbekende waarden en regressietests.
2. [ ] Auditresultaten per product en locale persistent opslaan met auditversie, tijd, bron, status en betrouwbare noemer. Voeg stale-detectie en hercontrole toe.
3. [ ] Registry-bronnen en adapter voor bovenstaande metrics toevoegen, met products:read rechten.
4. [ ] Optioneel toevoegen/verbergen/verplaatsen via de bestaande widgetbouwer, zonder standaard extra dashboardbelasting.
5. [ ] Trendmeting pas inschakelen wanneer historische snapshots betrouwbaar worden opgeslagen.

**Geen fictieve nullen:** ontbrekende metingen tonen als 'Nog niet gemeten'. Auditdekking mag 0% zijn als de totale actieve catalogus bekend is. KPI's vermelden altijd waarop ze betrekking hebben.


## P1 - AI meertalige feitenharmonisatie (NL/EN/FR)

Doel: per product **en variant** één aantoonbaar correcte feitenbron, met begrijpelijke vertaling en consistente presentatie over de drie talen. Het feit dat twee taalversies hetzelfde melden bewijst niet dat die inhoud klopt.

Bestaande architectuur: ingrediënten, allergenen, sporen en voedingswaarden staan hoofdzakelijk als gedeelde ProductAttribute-waarden in de databron; de storefront presenteert deze waarden deels ongewijzigd in meerdere talen. De oorzaak is dus niet per definitie drie verschillende waarden in de database. Houd brontaal, feitelijke betekenis en vertaalde presentatietekst strikt gescheiden.

1. [x] Read-only triage met statussen **vertaal geverifieerde bron**, **controleer tegenstrijdige bronnen** en **start online brononderzoek**. Geen automatische publicatie (lib/ai-vindbaarheid/fact-reconciliation.ts).
2. [ ] Bouw de vergelijking tussen de feitelijke bron, productvarianten en de zichtbare NL/EN/FR-pagina's. Vergelijk ook eenheden, voedingswaardebasis (bijv. per 100 g), bereidingswijze en bijbehorende SKU.
3. [ ] Integreer een online onderzoeksstap met zoekopdrachten op SKU, leverancier, merk, variant, gewicht, ingrediënten/allergenen en productblad. Bewaar URL, opgehaalde tekst, datum, bronklasse, exacte-match-bewijs en controleer conflicten. Begin bij fabrikant/leverancier en productetiket, gebruik secundaire winkels alleen als ondersteunend bewijs.
4. [ ] Integreer een AI-voorstelgenerator voor taalcorrecte formuleringen van **geverifieerde** gegevens. Toon bron, productvariant, huidige en voorgestelde waarde per taal en uitleg van het verschil.
5. [ ] Zorg voor review en akkoord per veld en product, met OWNER/ADMIN-rechten, optimistic concurrency, auditlog en rollbackmogelijkheid. Niets wijzigen bij alleen een audit.
6. [ ] Hercontroleer de drie publieke taalpagina's na expliciete toepassing.
7. [ ] Voeg aan het admin-dashboard statistieken toe: aantal taalconflicten, aantal ontbrekende bronwaarden, AI-voorstellen in afwachting, goedgekeurde verbeteringen en hercontrole-resultaten.

**Veiligheidsregel productfeiten:** als ingrediënten, allergenen, sporen of voedingswaarden bij **alle** taalversies ontbreken, mag AI bronnen zoeken, vergelijken en een voorstel met herkomst voorbereiden. Er wordt **nooit** een ingrediënt of voedingswaarde uit alleen een productnaam, algemene kennis of meerderheid van de vertalingen afgeleid. Eerst betrouwbare productspecifieke leverancier-/etiket-/productsheetgegevens voor de exacte variant, daarna pas vertaling en publicatie na akkoord.

**Geen stilzwijgend lege velden:** ieder ontbrekend feit krijgt een verplichte onderzoekstaak en een zichtbaar voortgangslabel. Een uitgeputte zoekactie eindigt als 'bron nog niet vastgesteld' met zoeklog, niet als verzonnen feit. Een inhoudelijk veld mag pas gevuld worden als de exacte productspecificatie betrouwbaar is bevestigd.

Status: triagelogica stuurt ontbrekende bronfeiten nu naar online onderzoek; daadwerkelijke internetzoekconnector, wachtrij, AI-generatie, bronkoppeling, review-UI, opslag en verwerking zijn nog niet gebouwd.


### Nieuwe onderzoeksvoorbereiding (22 november 2026)

- [x] Automatische product- en SKU-specifieke zoekopdrachten voor ontbrekende feiten in `lib/ai-vindbaarheid/source-research.ts`, met regressietests.
- [x] Kandidaatbronnen worden gerangschikt op indicaties van match met SKU, productnaam en type bron; deze rangschikking is geen verificatie.
- [ ] Koppel een werkelijke server-side webzoekprovider (met geldige credentials, limieten, retries en bronlog) aan de onderzoeksstap. De huidige code voert nog geen zoekopdrachten op internet uit.
- [ ] Haal concrete productdocumenten veilig op, inclusief bewijs van SKU en variant, en leg bron en tijdstip vast.
- [ ] Sluit brononderzoek aan op het adminportaal, de AI-vertaalvoorstellen en de expliciete goedkeuringsworkflow.


### Zoekconnector en admin-API (22 november 2026)

- [x] Server-side Brave Search-adapter gebouwd met maximaal twee gerichte zoekopdrachten per expliciete aanvraag, korte time-outs, URL-validatie, deduplicatie en onzekere bronnen als kandidaat, **niet** als bevestigd feit.
- [x] Beveiligd POST-endpoint toegevoegd: `/api/admin/ai-vindbaarheid/research`, alleen OWNER/ADMIN met geldige sessie en origincontrole. Request: `{ "productId": "...", "variantId": "...", "field": "ingredients" }`. De server haalt SKU en productnaam uit de database; geen vrije zoekopdrachten door de browser.
- [x] Nieuwe connector- en regressietests toegevoegd.
- [ ] Configureer `BRAVE_SEARCH_API_KEY` uitsluitend server-side in de deploymentomgeving. Zonder sleutel retourneert het endpoint HTTP 503 met status `not_configured` en worden geen zoekacties uitgevoerd.
- [ ] Bouw de zichtbare onderzoeksknop en kandidatenlijst in AI Vindbaarheid met waarschuwing 'nog niet geverifieerd'.
- [ ] Bouw extractie uit concrete productdatasheets met veiligheidscontroles en een gecontroleerde bron-naar-feit-verificatie.
- [ ] Koppel brononderzoek aan duurzame onderzoekstaken, quota/rate limiting, auditlogging en goedkeuringsworkflow; verstuur nooit automatisch productwijzigingen.

De connector vraagt een externe dienst aan en kan kosten veroorzaken; de route is daarom alleen expliciet via POST en beperkt tot één productvariant en één feitenveld.
