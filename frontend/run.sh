#!/bin/bash
# Run the React frontend dev server
# For local backend: ensure .env.local exists with empty VITE_API_URL

cd "$(dirname "$0")"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Creating .env from template..."
    echo "# API URL (optional - uses proxy when not set)" > .env
    echo "VITE_API_URL=" >> .env
fi

# Check if .env.local exists (overrides for local dev)
if [ ! -f ".env.local" ]; then
    echo "Creating .env.local for local development..."
    echo "# Local development - override production VITE_API_URL" > .env.local
    echo "# Empty value makes API client use /api (handled by Vite proxy)" >> .env.local
    echo "VITE_API_URL=" >> .env.local
    echo "Created .env.local - frontend will use Vite proxy to localhost:8000"
fi

# Run the dev server
echo "Starting React dev server on http://localhost:5173"
npm run dev -- --host