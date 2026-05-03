import express from 'express';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

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

// Serve static files with security options
app.use(express.static(path.join(__dirname, 'dist'), {
  dotfiles: 'ignore',
  index: false,
  maxAge: '1d',
}));

// SPA fallback - serve index.html for all non-API routes (for React Router)
// Use middleware approach for path-to-regexp v6+ compatibility
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});