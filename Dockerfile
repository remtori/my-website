# syntax=docker/dockerfile:1

FROM node:24-bookworm AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/server/package.json packages/server/
COPY packages/webui/package.json packages/webui/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build
RUN pnpm prune --prod

FROM node:24-bookworm-slim AS runner

WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/server/package.json ./packages/server/
COPY --from=builder /app/packages/server/node_modules ./packages/server/node_modules
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/src/db/migrations ./packages/server/src/db/migrations
COPY --from=builder /app/packages/webui/dist ./packages/webui/dist

RUN chown -R node:node /app

USER node

ENV NODE_ENV=production

WORKDIR /app/packages/server

EXPOSE 3000

CMD ["node", "dist/index.node.js"]
