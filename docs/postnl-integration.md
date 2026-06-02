# PostNL Integratie

Nog niet actief gebouwd. Beoogde stappen:

1. Verzendmethodes en pakketdata vastleggen.
2. Label aanmaken vanuit worker/admin action.
3. Track & trace opslaan op shipment.
4. Verzendbevestiging mailen.
5. Retourlabel-flow toevoegen.

## Randvoorwaarden

- PostNL API key server-only houden.
- Labelgeneratie idempotent maken per shipment.
- Fouten zichtbaar maken in admin orderdetail.
