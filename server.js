import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const APP_FILE = path.join(__dirname, 'znecitelne.html');

// Application entry points.
app.get(['/', '/index.html', '/znecitelne.html'], (_req, res) => {
  res.sendFile(APP_FILE);
});

// Static assets: ./lib/*, metadata.json, etc.
app.use(express.static(__dirname));

// Client-side fallback.
app.get('*', (_req, res) => {
  res.sendFile(APP_FILE);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
