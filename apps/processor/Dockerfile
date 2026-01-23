# =============================================================================
# Processor Microservice Dockerfile
# =============================================================================
# Multi-stage build for NestJS Kafka processor
# =============================================================================

# --- Stage 1: Build ---
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source files
COPY . .

# Build the processor application
RUN npm run build processor

# --- Stage 2: Production ---
FROM node:22-alpine

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Copy libs if needed (shared database module)
COPY --from=builder /usr/src/app/libs ./libs

# Run as non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# No port exposed - this is a Kafka consumer, not an HTTP server

# Start the processor microservice
CMD ["node", "dist/apps/processor/main"]
