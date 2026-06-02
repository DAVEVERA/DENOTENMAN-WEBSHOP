# DeNotenman API

NestJS 10 on Fastify. Env is validated at boot via Zod — the process refuses to start with a missing or malformed variable.

## Local env setup

Copy the root `.env.example` to `.env` and fill in the required values:

```sh
cp ../../.env.example ../../.env
```

Start the dev server with env loaded via `dotenv-cli` (already a root devDep):

```sh
pnpm dev
```

The root `package.json` dev script passes `--env-file .env` via `dotenv -e .env -- turbo run dev`. No runtime `.env` parsing happens inside the application code — env must be present in the process before `node` starts.

## Required variables (development)

| Variable | Notes |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Min 32 chars, random |
| `JWT_REFRESH_SECRET` | Min 32 chars, separate from access |
| `CSRF_SECRET` | Min 32 chars, random |

`STOREFRONT_URL`, `ADMIN_URL`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` are optional in development but required in production.

## Running tests

```sh
pnpm --filter @denotenman/api test
```

Tests use a setup file (`src/test-setup.ts`) that seeds required env vars before any module import.
