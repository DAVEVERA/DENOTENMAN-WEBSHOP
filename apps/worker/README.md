# @denotenman/worker

Background worker process for DeNotenman. Runs as a standalone NestJS application on Fastify.

## Scripts

| Command              | Description                     |
| -------------------- | ------------------------------- |
| `pnpm dev`           | Start with hot-reload            |
| `pnpm build`         | Compile to `dist/`              |
| `pnpm start`         | Run compiled output             |
| `pnpm lint`          | ESLint                          |
| `pnpm typecheck`     | TypeScript type check           |
| `pnpm test`          | Unit tests (vitest)             |

## Endpoints

| Path       | Description                                 |
| ---------- | ------------------------------------------- |
| `GET /healthz` | Liveness — always returns `200 { status: "ok" }` |
| `GET /readyz`  | Readiness — returns `200` when all deps are up, `503` on failure |

## Environment

| Variable      | Default | Description          |
| ------------- | ------- | -------------------- |
| `WORKER_PORT` | `3002`  | HTTP port to bind on |
| `NODE_ENV`    | —       | `production` disables pretty-print logging |
