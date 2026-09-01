FROM node:22-slim AS base

FROM base AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The production catalogue is statically prerendered and TypeScript can exceed
# Node's container-aware default heap during this build stage.
ENV NODE_OPTIONS=--max-old-space-size=4096

# next build statically prerenders product/category pages via
# generateStaticParams, which queries the database — it needs a real
# connection at build time, not just at runtime. Passed as a build arg
# (from Secret Manager via cloudbuild.yaml) so it never gets baked into
# a committed file, only into this one build layer.
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
ARG CDN_BASE_URL
ENV CDN_BASE_URL=$CDN_BASE_URL
ARG SITE_URL
ENV SITE_URL=$SITE_URL
ARG UNLIMITED_STOCK
ENV UNLIMITED_STOCK=$UNLIMITED_STOCK
ARG DEPLOYMENT_VERSION
ENV DEPLOYMENT_VERSION=$DEPLOYMENT_VERSION

RUN npm run build

FROM base AS runner
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/app/admin/(dashboard)/prijsmonitor/apex.py ./app/admin/(dashboard)/prijsmonitor/apex.py

USER nextjs

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
