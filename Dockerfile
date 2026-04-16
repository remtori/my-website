# syntax=docker/dockerfile:1

FROM node:24-bookworm AS builder
WORKDIR /app

ENV CI=true
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/server/package.json packages/server/
COPY packages/webui/package.json packages/webui/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build
# Portable prod install for the server (pnpm prune --prod breaks workspace-linked deps)
RUN pnpm --filter @website/server --prod deploy /deploy/server

FROM node:24-bookworm-slim AS runner

WORKDIR /app

COPY --from=builder /deploy/server ./server
COPY --from=builder /app/packages/server/migrations ./server/migrations
COPY --from=builder /app/packages/webui/dist ./webui/dist

RUN chown -R node:node /app

USER node

ENV NODE_ENV=production

WORKDIR /app/server

EXPOSE 3000

CMD ["node", "dist/main.js"]
