# Multi-Stage Production Dockerfile for Ravn Backend
# Platform pinned to linux/amd64 — works on all VPS/cloud servers regardless of build machine arch
FROM --platform=linux/amd64 node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code and config
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript to Javascript
RUN npm run build

# ── Production Image ────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy built distribution files from builder
COPY --from=builder /app/dist ./dist
COPY public ./public

# Run as non-root user for security
USER node

EXPOSE 3000

CMD ["node", "dist/server.js"]
