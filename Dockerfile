# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:22.23.1-bookworm-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3

FROM ${NODE_IMAGE} AS base

WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
RUN apt-get update \
  && apt-get install --no-install-recommends --yes openssl \
  && rm -rf /var/lib/apt/lists/*
RUN npm install --global --ignore-scripts pnpm@10.5.2

FROM base AS dependencies

RUN apt-get update \
  && apt-get install --no-install-recommends --yes g++ make python3 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
COPY . .
RUN pnpm --filter @aiworld/shared build

RUN DATABASE_URL=postgres://postgres:postgres@localhost:5432/aiworld pnpm --filter @aiworld/api db:generate
RUN pnpm build

FROM builder AS api-package

RUN pnpm deploy --legacy --filter @aiworld/api --prod /out/api

FROM base AS development

ENV NODE_ENV=development
COPY --from=dependencies /app/ ./
COPY . .
RUN pnpm --filter @aiworld/shared build
RUN DATABASE_URL=postgres://postgres:postgres@localhost:5432/aiworld pnpm --filter @aiworld/api db:generate

FROM base AS migrate

ENV NODE_ENV=production
COPY --from=api-package --chown=node:node /out/api ./
USER node
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

FROM base AS api-runtime

ENV NODE_ENV=production
COPY --from=api-package --chown=node:node /out/api ./
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "const port = process.env.API_PORT || process.env.PORT || '3000'; fetch('http://127.0.0.1:' + port + '/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/src/main.js"]

FROM nginxinc/nginx-unprivileged:1.29-alpine@sha256:0c79d56aee561a1d81c63f00eee5fb5fe29279560cdc55e91425133104c7fbe6 AS web-runtime

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:8080/health || exit 1
