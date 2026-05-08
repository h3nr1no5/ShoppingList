# Shopping List App - Frontend

A React + TypeScript + Vite frontend for the Shopping List application.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation & Running

```bash
# From project root
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
# Or use the run script:
bash run.sh
```

The frontend runs on **http://localhost:5173**

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run test` | Run Vitest test suite |
| `npm run dev` | Start Vite development server |
| `npm run build` | Typecheck and build for production |
| `npm run lint` | Run ESLint |

## API Proxy

The frontend is configured to proxy `/api` requests to the backend at `http://localhost:8000`.

This means API calls like `fetch('/api/auth/login')` are automatically forwarded to `http://localhost:8000/api/auth/login`.

For local development, you don't need to set `VITE_API_URL` — the proxy handles it automatically.

## Features

- **User Authentication** — Register, login, JWT-based sessions
- **Shopping Lists** — Create, read, update, delete personal lists
- **Items** — Add, check off, and remove items from lists
- **Share Codes** — Share lists with others using unique codes
- **Offline Queue** — Changes to items made while offline are queued in localStorage and automatically synced when the connection is restored
- **Public Lists** — Make lists publicly accessible

## Tech Stack

- React 19
- TypeScript
- Vite
- React Router
- Axios (HTTP client)
- Vitest + Testing Library (testing)

## Project Structure

```
frontend/
├── public/             # Static assets
├── src/
│   ├── api/           # API client (axios)
│   ├── components/    # React components
│   ├── context/       # React contexts (Auth, Theme, Toast, ApiHealth)
│   ├── hooks/         # Custom hooks (useAuth, useTheme, useOfflineQueue, etc.)
│   ├── pages/         # Page components
│   ├── test/          # Test setup
│   ├── types/         # TypeScript interfaces
│   ├── App.tsx        # Main app component
│   └── main.tsx       # Entry point
├── index.html         # HTML template
└── vite.config.ts     # Vite configuration
```

## Building for Production

```bash
npm run build
```

Output is in the `dist/` directory.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | API endpoint URL | `/api` (dev) |
| `PORT` | Server port | `8080` |

## Production Deployment

The production build uses a custom Express server (`server.js`) with Helmet for security. This provides:

- **Content Security Policy (CSP)** — Configured to allow connections to the API endpoint
- **Static file serving** — Serves the built React app from `dist/`
- **Production-ready headers** — Helmet sets security headers

### Building

```bash
npm run build
```

### Running Production Server

```bash
node server.js
```

The server runs on port `8080` by default (configurable via `PORT` environment variable).

### Docker

A multi-stage Dockerfile builds the frontend and runs the production server:

```dockerfile
# Build stage
FROM node:18-alpine AS build
RUN npm install && npm run build

# Production stage
FROM node:18-alpine
COPY --from=build /app/dist /app/dist
COPY server.js package.json ./
RUN npm install --production
EXPOSE 8080
CMD ["node", "server.js"]
```

## Azure Deployment

The frontend is deployed as an Azure Container App:

- **URL:** `https://shoppinglist-web.victorioushill-2f5d1c85.northeurope.azurecontainerapps.io/`
- **Uses:** Multi-stage Dockerfile (build + production)
- **Command:** `azd deploy --service web` to deploy

The production server (`server.js`) handles CSP headers to allow the frontend to communicate with the API at `https://shoppinglist-api.victorioushill-2f5d1c85.northeurope.azurecontainerapps.io/`.

## Troubleshooting

### CORS Errors
- Ensure the backend is running on port 8000
- Check `ALLOWED_ORIGINS` in backend `.env` includes your frontend origin

### API Not Connecting
- Verify the backend is running (`cd backend && ./run.sh`)
- Check that port 8000 is not in use

## Offline Queue

The frontend supports offline item mutations through a localStorage-backed queue. When
the browser is offline (detected via `navigator.onLine` + health check polling), item
operations (add, toggle, edit, delete) are stored locally and replayed when connectivity
returns.

### How It Works

1. **Optimistic UI** — Changes appear immediately in the UI regardless of connectivity
2. **Queue Storage** — When offline, changes are saved to localStorage under
   `pending_changes_{listId}` with a type, item ID, payload, and timestamp
3. **Auto-Sync** — When `ApiHealthContext` detects a reconnection, all queued
   changes are replayed to the server in timestamp order
4. **Temp ID Resolution** — Items added offline receive temporary IDs (`temp-*`)
   that are mapped to real server IDs during sync
5. **Error Handling** — 404 responses (item deleted by another user) are silently
   skipped; 401 responses (expired token) notify the user; transient errors retry
   on the next reconnect
6. **State Reconciliation** — After all changes sync, the list is re-fetched from
   the server to ensure UI consistency

### Key Files

- `src/hooks/useOfflineQueue.ts` — Hook for managing the pending changes queue
- `src/pages/ListDetail.tsx` — Integrates queue for owned lists
- `src/pages/SharedList.tsx` — Integrates queue for shared lists (with share_code params)

### Limitations

- **Multi-tab**: Two tabs open to the same list may have conflicting queues.
  A future improvement could use `BroadcastChannel` API for cross-tab coordination.
- **No conflict resolution**: Uses last-write-wins strategy.