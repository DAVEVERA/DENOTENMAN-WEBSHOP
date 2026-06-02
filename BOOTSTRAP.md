# Bootstrap — run once, before building

Tijd: ~10 minuten. Daarna staat het team klaar.

## Voorwaarden

- Node 20+, pnpm 9+, Docker, git.
- Antigravity geopend, Claude Code sub-agent/skill-ondersteuning actief.

## Stap 1 — Projectmap aanmaken

```bash
mkdir denotenman && cd denotenman
git init
git config user.name "MNRV"
git config user.email "<owner-email>"
```

## Stap 2 — Bundle uitpakken

Kopieer uit deze bootstrap-bundle naar de project-root:

```
denotenman/
  CLAUDE.md
  .claude/
    agents/
      architect.md
      frontend-dev.md
      backend-dev.md
      fullstack-dev.md
      database-dev.md
      app-admin.md
      auditor.md
    skills/
      no-attribution/SKILL.md
      commit-hygiene/SKILL.md
      dutch-copy/SKILL.md
      prisma-migration/SKILL.md
      importer-pipeline/SKILL.md
      test-discipline/SKILL.md
      consensus-vote/SKILL.md
```

## Stap 3 — Commit als baseline

```bash
git add CLAUDE.md .claude
git commit -m "chore: bootstrap team directive, agents, skills"
```

## Stap 4 — Antigravity openen, Claude Code starten

Open de map in Antigravity. Start de Claude Code sessie. Verifieer:

```
/agents
```

Resultaat moet zeven agents tonen: `architect`, `frontend-dev`, `backend-dev`, `fullstack-dev`, `database-dev`, `app-admin`, `auditor`.

```
/skills
```

Resultaat moet zeven skills tonen: `no-attribution`, `commit-hygiene`, `dutch-copy`, `prisma-migration`, `importer-pipeline`, `test-discipline`, `consensus-vote`.

Als iets ontbreekt → bundel niet volledig gekopieerd of pad-casing klopt niet. Fix eerst, ga daarna verder.

## Stap 5 — CLAUDE.md verifieren

De orchestrator leest automatisch `CLAUDE.md`. Test met:

```
Wie is de auteur van dit project?
```

Antwoord moet zijn: `MNRV`. Geen andere namen.

## Stap 6 — Eerste opdracht

Plak `denotenman-build-prompt.md` als eerste bericht in de sessie. Sluit af met één regel:

```
Start met Section 4 (repo scaffold) en Section 5 (Prisma schema).
Delegeer: @architect plant, @database-dev schrijft schema,
@app-admin zet monorepo + CI op, @auditor valideert.
Trigger consensus-vote op het Prisma-schema voor commit.
```

De orchestrator:
1. Roept `@architect` aan voor de sprint-1 decompositie.
2. Parallelle delegatie aan `@database-dev` en `@app-admin`.
3. `@fullstack-dev` zet `packages/schemas` op.
4. `consensus-vote` op het schema.
5. `@auditor` approval voor eerste merge.

## Stap 7 — Gate-check na elke feature

Vraag de orchestrator aan het einde van elke feature:

```
Draai de merge gate: no-attribution, types, tests, a11y, security.
Auditor rapport plakken.
```

Pas mergen als auditor `PASS` geeft.

---

## Optioneel — git hooks (aanrader)

Installeer `husky` + `lint-staged` en voeg een pre-commit hook toe die:

1. `pnpm lint-staged` draait.
2. De `no-attribution` grep draait op de staged diff (fail bij hit).
3. `commit-hygiene` pattern matcht op de commit message (commit-msg hook).

Dit laat je `@app-admin` toevoegen als onderdeel van het week-1 scaffold-werk.

---

## Troubleshooting

- **Agent "niet gevonden" bij delegatie** → check dat de YAML frontmatter top-of-file staat, geen BOM, naam-veld lowercase, geen spaties.
- **Skill triggert niet** → `SKILL.md` moet exact zo heten (uppercase), in een map met de skill-naam. Description moet concreet zijn — vaag = nooit ingeroepen.
- **Orchestrator schrijft zelf code** → corrigeer expliciet: "Delegeer aan `@<agent>`. Jij coordineert." De `CLAUDE.md` regel staat er maar moet soms versterkt.
- **Consensus-vote wordt overgeslagen** → vraag expliciet "Trigger consensus-vote op deze wijziging" en check dat er een `docs/votes/` bestand bij komt.
