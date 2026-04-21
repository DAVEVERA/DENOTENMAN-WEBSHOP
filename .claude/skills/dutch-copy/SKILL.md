---
name: dutch-copy
description: Use for any string that appears in the UI. Enforces Dutch language and the DeNotenman voice of brand — kort, feitelijk, direct, geen hype. Also the rule that identifiers, code, tests, and logs stay in English.
---

## Language rule

- **UI visible to customers or admins** → Dutch.
- **Identifiers, types, variable names, comments, log messages, test descriptions** → English.
- Mixing is forbidden. A Dutch variable name like `productKaart` is a bug. An English button label like "Add to cart" is a bug.

## Voice of brand

From the DeNotenman brand spec:

- **Kort.** Aim for the shortest phrasing that is still clear.
- **Feitelijk.** State facts, not emotions.
- **Direct.** No hedging. No "wellicht", "misschien".
- **Geen hype.** No "heerlijk", "geweldig", "de allerbeste", "supergezond".
- **Uitleg-patroon**: wat is het + waarom goed + hoe gebruik je het.
- **Claim-beleid**: only measurable claims. Herkomst, oogstjaar, gebrand/ongebrand, gewicht. No vague health claims.

## Standard copy patterns

**Product card**:
```
Amandelen, Spanje
Vers gebrand · 500 g
€ 6,95   (€ 1,39 per 100 g)
```

**Product detail intro** (one paragraph, 2–4 sentences):
```
Hele amandelen uit Spanje, vers gebrand in eigen huis.
Smaak: vol, licht geroosterd. Textuur: extra crunchy.
Tip: in havermout, yoghurt of als topping.
```

**Empty state**:
```
Nog niets in je winkelwagen.
```

**Form errors**:
```
Voer een geldig e-mailadres in.
Wachtwoord moet minimaal 10 tekens zijn.
Deze postcode herkennen we niet.
```

Not:
```
Er ging iets mis.        (vague)
Ongeldige invoer.        (vague)
Oeps!                    (no)
```

**Success messages**:
```
Product toegevoegd aan winkelwagen.
Bestelling verzonden. Je ontvangt een bevestiging per e-mail.
```

## Formatting

- Currency: `€ 6,95` — euro sign, space, comma as decimal.
- Per-100g: `€ 1,39 per 100 g`.
- Weight: `500 g`, `1 kg`. Space between number and unit.
- Dates: `22 oktober 2025`. No US-style `October 22`.
- Time: 24-hour, `14:30`.
- Phone: `+31 6 12 34 56 78` when international, `06-12345678` when domestic.

## Formal vs informal

**Je-vorm** (informal "you"). Consistent across the whole UI. Never switch to "u" except in legal pages (privacy, terms) where "u" is conventional.

## Checks

Before committing a UI change:

```bash
grep -rE ">[^<]*\b(you|your|cart|checkout|buy|click|submit)\b[^<]*<" apps/storefront apps/admin --include="*.tsx"
```

Any hit where the English word is customer-facing → fix to Dutch.
