# Production Dockerfile - Multi-stage build
# Stage 1: Build
# Stage 2: Runtime (non-root user, minimal image)

# ============================================================================
# Stage 1: Build
# ============================================================================
FROM node:22-slim AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Prune production dependencies
RUN npm prune --production

# ============================================================================
# Stage 2: Runtime
# ============================================================================
FROM node:22-slim AS runtime

# Metadata
LABEL org.opencontainers.image.title="EHR Webservice"
LABEL org.opencontainers.image.description="Production-grade Electronic Health Record backend"
LABEL org.opencontainers.image.vendor="Your Organization"

# Create non-root user (HIPAA requirement)
RUN groupadd -r ehr && useradd -r -g ehr ehr

WORKDIR /app

# Copy built application and production dependencies from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

# Switch to non-root user
USER ehr

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if(r.statusCode!==200)throw new Error()})" || exit 1

# Start the server
CMD ["node", "dist/server.js"]
