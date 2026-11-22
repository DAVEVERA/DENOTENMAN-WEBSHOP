# De Notenman: GEO-auditgeschiedenis en automatische planning

## Werkingsprincipe
- De bestaande Cloud Scheduler roept iedere **vijf minuten** via een beveiligde POST `/api/cron/geo-audit` aan.
- De scheduler start alleen een nieuwe volledige cataloguscyclus wanneer de vorige cyclus minstens **zeven dagen** geleden is afgerond.
- Eén aanroep controleert **maximaal zes actieve producten** (alle beschikbare NL/EN/FR-productpagina's).
- De database bewaart per cyclus een voortgangscursor, HTTP-status, controlescore, controle-uitkomsten en bevindingen per product/taal.
- De lease op `GeoAuditScheduler` voorkomt dat gelijktijdige aanroepen dubbel verwerken.
- Als een batch faalt, blijft de cursor behouden; een volgende cronaanroep probeert diezelfde batch opnieuw.
- De wijzigingen zijn alleen-lezen voor de productcatalogus. Er worden **geen** SEO- of productgegevens automatisch geschreven.

## Voorwaarden vóór activering
1. Laat de GitHub Actions checks en de reguliere applicatiebuild slagen.
2. Draai `prisma migrate deploy` via de bestaande **release-pipeline** tegen de daarvoor bedoelde database. Gebruik geen lokale productie-DB-credentials.
3. Deploy de branch pas na review en gecontroleerde merge.
4. Stel `GEO_AUDIT_CRON_SECRET` als geheim in op de Cloud Run-service (een ander geheim dan de overige cronjobs). Gebruik een lang, willekeurig token.
5. Maak in de bestaande Google Cloud Scheduler een HTTP-taak:
   - Naam: `denotenman-geo-audit`
   - Frequentie: `*/5 * * * *` in `Europe/Amsterdam`
   - Methode: `POST`
   - URL: `https://denotenman.com/api/cron/geo-audit`
   - Header: `Authorization: Bearer <GEO_AUDIT_CRON_SECRET>`
   - Time-out: minimaal de tijd die nodig is voor één batch; maximaal de Cloud Run-time-out.
6. Controleer dat `SITE_URL` daadwerkelijk een publieke HTTPS-origin is en niet de lokale fallback.
7. Trigger eenmaal handmatig vanuit Cloud Scheduler en controleer respons en geschiedenis in `/admin/ai-vindbaarheid`.

## Foutafhandeling en verwachtingen
- HTTP **503**: de vereiste `GEO_AUDIT_CRON_SECRET` ontbreekt.
- HTTP **401**: geen of onjuist Bearer-geheim.
- Status `busy`: een andere worker heeft de actieve lease.
- Status `not_due`: de volgende wekelijkse cyclus is nog niet aan de beurt.
- Status `running`: een batch verwerkt; in het admin zie je product- en paginatellers.
- Status `completed`: de volledige cataloguscyclus is afgerond.
- HTTP **500**: interne fout; laatste fout wordt bij de lopende cyclus opgeslagen en de volgende aanroep kan opnieuw proberen.
- De geschiedenis en detailpagina zijn zichtbaar via het bestaande adminportaal; er wordt **geen** extra openbaar endpoint met auditdata geopend.

## Technische grenzen
- De handmatige volledige audit in het admin-tabblad blijft een aparte, tijdelijke scan; alleen de croncyclus maakt duurzame snapshots.
- Scores meten technische crawlbaarheid en ontvangen HTML, **niet** daadwerkelijke AI-aanbevelingen.
- Nieuwe/uitgeschakelde producten tijdens een cyclus kunnen de aanvankelijke noemer beïnvloeden; dat maakt een run geen onveranderlijke exportsnapshot.
- De auditgeschiedenis groeit met het aantal producten, talen en cycli. Retentie/archivering is nog niet geïmplementeerd.
- Zet een schema-migratie en cronjob nooit omgekeerd aan: eerst migratie en release, daarna de geplande aanroepen.

## Terugdraaien
Schakel de Cloud Scheduler-taak uit om nieuwe batches direct te stoppen. Bestaande auditrecords blijven beschikbaar.
Verwijder de auditdatabase-tabellen niet bij een reguliere applicatie-rollback; bewaar de historie totdat een afzonderlijk migratieplan is vastgesteld.
