# Stage 1: Build Phase
FROM node:20-alpine AS builder

WORKDIR /app

# Enable legacy peer deps to ensure compatible package tree resolution
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy application files
COPY . .

# Build Vite client assets and compile backend server to dist/
RUN npm run build

# Stage 2: Clean Production Runner Phase
FROM node:20-alpine AS runner

WORKDIR /app

# Define production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy root configurations and package.json
COPY package*.json ./
COPY start.sh ./

# Install only production dependencies for optimal performance and safety
RUN npm ci --only=production --legacy-peer-deps

# Copy build artifacts and runtime storage directory structures from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/uploads ./uploads

# Expose port and configure entrypoint
EXPOSE 3000

RUN chmod +x ./start.sh

# Run start script
CMD ["sh", "./start.sh"]
