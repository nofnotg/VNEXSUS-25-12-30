// Lightweight preview server for comprehensive HTML report
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..');

const app = express();
const PORT = process.env.REPORT_PORT ? Number(process.env.REPORT_PORT) : 8081;

// CORS not strictly needed for same-origin, but keep permissive for local
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  next();
});

// Static mounts for reading JSON/HTML assets used by the report
app.use('/reports', express.static(path.join(repoRoot, 'temp', 'reports')));
app.use('/static/reports', express.static(path.join(repoRoot, 'reports')));
app.use('/static/validation', express.static(path.join(repoRoot, 'validation-results')));
app.use('/static/root', express.static(repoRoot));

// Serve the main report HTML at /report
app.get('/report', (req, res) => {
  res.sendFile(path.join(repoRoot, 'temp', 'reports', 'VNEXSUS_App_Status_Comprehensive_Report.html'));
});

// Root redirect for convenience
app.get('/', (req, res) => {
  res.redirect('/report');
});

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}/report`;
  console.log(`VNEXSUS report preview server running on ${url}`);
});

