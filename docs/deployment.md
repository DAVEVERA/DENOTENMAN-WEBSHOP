# Deployment

## Doelomgeving

- Storefront: publieke Next.js app.
- Admin: aparte Next.js app met beschermde beheeromgeving.
- Worker: achtergrondproces of geplande jobs.
- Supabase: database, storage en Edge Functions.

## Vereiste Env Vars

Publiek:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`

Server-only:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- Integratiegeheimen voor Mollie, PostNL en mail wanneer die flows actief worden.

Admin login:

- Gebruik in productie een uniek admin-e-mailadres, een wachtwoord van minimaal 16 tekens en een willekeurige `ADMIN_SESSION_SECRET` van minimaal 32 tekens.
- Tijdelijke waarden met markers zoals `local`, `test`, `demo`, `example`, `placeholder` of `rotate-before-production` worden in productie geweigerd.
- Genereer de session secret bijvoorbeeld met `openssl rand -base64 48` of via de secret-generator van het hostingplatform.

## Checks Voor Deploy

1. `pnpm typecheck`
2. `pnpm --filter @denotenman/storefront build`
3. `pnpm --filter @denotenman/admin build`
4. Supabase security advisor controleren.
5. Admin login smoke-test uitvoeren.
6. Storefront catalogus smoke-test uitvoeren.

## Let Op

Zet `NODE_ENV` in de hostingomgeving via het platform zelf. Gebruik geen afwijkende handmatige waarde in productie-envs.
