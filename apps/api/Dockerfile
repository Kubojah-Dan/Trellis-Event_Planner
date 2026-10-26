# ==============================================================================
# Trellis API — Google Cloud Run Production Dockerfile
# Multi-stage build for minimal production image footprint
# ==============================================================================

# Stage 1: Build & compile TypeScript packages
FROM node:22-alpine AS builder

WORKDIR /app

# Enable corepack and install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/domain/package.json ./packages/domain/
COPY packages/config/package.json ./packages/config/
COPY apps/api/package.json ./apps/api/

# Install dependencies for api and shared packages
RUN pnpm install --frozen-lockfile

# Copy source code
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Build shared packages and API
RUN pnpm --filter @trellis/config run build && \
    pnpm --filter @trellis/contracts run build && \
    pnpm --filter @trellis/domain run build && \
    pnpm --filter @trellis/api run build

# Stage 2: Production runtime image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Create non-root system user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 trellis

# Enable corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy build artifacts and manifests
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

USER trellis

EXPOSE 8080

# Cloud Run injects PORT environment variable
CMD ["node", "apps/api/dist/server.js"]
