# Stage 1: Build client
FROM node:20-alpine AS client-builder
WORKDIR /app/client

COPY client/package.json client/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY client/ ./
RUN pnpm build

# Stage 2: Build server
FROM node:20-alpine AS server-builder
WORKDIR /app/server

COPY server/package.json server/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY server/ ./
RUN pnpm build

# Stage 3: Production runtime
FROM node:20-alpine
WORKDIR /app

# Copy server build output + dependencies
COPY --from=server-builder /app/server/dist ./dist
COPY --from=server-builder /app/server/node_modules ./node_modules
COPY --from=server-builder /app/server/package.json ./package.json

# Copy Prisma schema + generated client + config
COPY --from=server-builder /app/server/prisma ./prisma
COPY --from=server-builder /app/server/prisma.config.ts ./prisma.config.ts
COPY --from=server-builder /app/server/src/generated ./src/generated

# Copy client build output → served as static files by Express
COPY --from=client-builder /app/client/dist ./public

# Cloud Run injects PORT env var (default 8080)
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Initialize SQLite DB + start server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
