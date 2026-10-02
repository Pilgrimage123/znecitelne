import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const APP_FILE = path.join(__dirname, 'znecitelne.html');

// Canonical application entry point.
app.get('/', (_req, res) => {
  res.sendFile(APP_FILE);
});

app.get('/znecitelne.html', (_req, res) => {
  res.sendFile(APP_FILE);
});

// There is intentionally no second application entry point.  Keep old
// /index.html bookmarks working without creating an index.html application.
app.get('/index.html', (_req, res) => {
  res.redirect(308, '/');
});

// Static assets: ./lib/*, metadata.json, etc.
// Missing assets must remain real 404s; otherwise the SPA fallback can
// return znecitelne.html with HTTP 200 and fool runtime asset probes.
app.use(express.static(__dirname, { fallthrough: true }));

// Client-side fallback for application routes only.  Do not serve the
// application shell for missing file-like assets.
app.get('*', (req, res, next) => {
  if (path.extname(req.path)) return res.status(404).type('text/plain').send('Not found');
  res.sendFile(APP_FILE);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
