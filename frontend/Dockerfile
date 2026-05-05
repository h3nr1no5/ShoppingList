# Build stage - compile the frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Build the frontend (this runs tsc and vite build)
# VITE_API_URL is read from .env by Vite (written by infra/hooks/prepackage.sh)
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy only the built files from builder
COPY --from=builder /app/dist ./dist/
COPY --from=builder /app/server.js ./

# Copy package files for production dependencies
COPY --from=builder /app/package*.json ./

# Install only production dependencies (optional, for smaller image)
RUN npm install --production

# Expose port
EXPOSE 8080

# Start the Express server
CMD ["node", "server.js"]