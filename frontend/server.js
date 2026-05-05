import express from 'express';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 8080;

// Security headers with Helmet
const apiUrl = process.env.VITE_API_URL || 'https://shoppinglist-api.victorioushill-2f5d1c85.northeurope.azurecontainerapps.io';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", apiUrl],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'dist'), {
  dotfiles: 'ignore',
  index: false,
  maxAge: '1d',
}));

// Proxy API requests to backend - Express strips /api prefix, so we add it back
app.use('/api', createProxyMiddleware({
  target: apiUrl,
  changeOrigin: true,
  pathRewrite: (path, req) => {
    // Express stripped /api, so path is /auth/login instead of /api/auth/login
    // Add /api back so backend receives the full path
    return '/api' + path;
  },
}));

// SPA fallback - serve index.html for all non-API routes
app.use((req, res, next) => {
  // If it's an API request that wasn't handled, return 404
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ detail: "API endpoint not found" });
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});