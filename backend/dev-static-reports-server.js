import express from "express";
import path from "path";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 5501;

// Serve the built reports directory at root
app.use(express.static(path.resolve("reports")));

// Also serve temp reports under /reports for consistency
app.use("/reports", express.static(path.resolve("temp/reports")));

app.get("/", (_req, res) => {
  res.send(`<html><body><h3>Static Reports Server</h3>
    <ul>
      <li><a href="/Comprehensive_Case_Progress_Report.html">Comprehensive Report (reports)</a></li>
      <li><a href="/reports/Comprehensive_Case_Progress_Report.html">Comprehensive Report (temp/reports)</a></li>
    </ul>
  </body></html>`);
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Static Reports Server listening at http://localhost:${PORT}/`);
});

