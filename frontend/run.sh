#!/bin/bash
# Run the React frontend dev server

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

# Run the dev server
echo "Starting React dev server on http://localhost:5173"
npm run dev -- --host