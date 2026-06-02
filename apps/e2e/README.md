# @denotenman/e2e

Playwright smoke tests for the storefront.

## Local gebruik

1. Start de storefront:

```sh
pnpm --filter @denotenman/storefront dev
```

2. Voer de tests uit (in een tweede terminal):

```sh
pnpm --filter @denotenman/e2e test:e2e
```

De config detecteert automatisch of `http://localhost:3000` bereikbaar is. Als dat niet het geval is, start Playwright de storefront zelf via `webServer`.

Interactieve UI-mode:

```sh
pnpm --filter @denotenman/e2e test:e2e:ui
```

## CI

CI start de storefront als een apart build + serve proces voor de e2e-job en zet:

- `E2E_BASE_URL` — URL van de draaiende storefront
- `E2E_SKIP_WEBSERVER=1` — zodat Playwright geen eigen `dev`-server opstart

Browser-binaries worden geinstalleerd via:

```sh
pnpm --filter @denotenman/e2e exec playwright install --with-deps chromium
```

## Scope

Alleen smoke: homepage laadt, title klopt, hero-H1 aanwezig. Visuele regressie, a11y-suite en uitgebreide user journeys vallen buiten scope van dit pakket in de huidige sprint.
