# Build stage - compile the frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files AND .env file (contains VITE_API_URL for Vite)
COPY . .

# Build the frontend - Vite will read VITE_API_URL from .env file
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy only the built files from builder
COPY --from=builder /app/dist ./dist/
COPY --from=builder /app/server.js ./

# Copy package files for production dependencies
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm install --production

# Expose port
EXPOSE 8080

# Start the Express server
CMD ["node", "server.js"]