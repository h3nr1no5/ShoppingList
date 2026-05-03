FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY server.js ./
COPY dist/ ./dist/

# Expose port
EXPOSE 8080

# Start the Express server
CMD ["node", "server.js"]