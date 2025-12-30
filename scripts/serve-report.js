// Lightweight preview server for comprehensive HTML report
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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
  const primary = path.join(repoRoot, 'temp', 'reports', 'VNEXSUS_App_Status_Comprehensive_Report.html');
  const fallback1 = path.join(repoRoot, 'temp', 'reports', 'Report_Subset_Validation.html');
  const fallback2 = path.join(repoRoot, 'temp', 'reports', 'Event_Labeling_Stats.html');
  if (fs.existsSync(primary)) {
    res.sendFile(primary);
    return;
  }
  if (fs.existsSync(fallback1)) {
    res.sendFile(fallback1);
    return;
  }
  if (fs.existsSync(fallback2)) {
    res.sendFile(fallback2);
    return;
  }
  res.status(404).send('Report HTML not found in temp/reports. Please generate validation reports.');
});

// Direct route for offline coordinate analysis report
app.get('/coord', (req, res) => {
  res.sendFile(path.join(repoRoot, 'reports', 'offline_coord_analysis.html'));
});

// Root redirect for convenience
app.get('/', (req, res) => {
  res.redirect('/report');
});

app.listen(PORT, () => {
  const urlReport = `http://localhost:${PORT}/report`;
  const urlCoord = `http://localhost:${PORT}/coord`;
  console.log(`VNEXSUS report preview server running on ${urlReport}`);
  console.log(`Offline coord analysis available at ${urlCoord}`);
});
