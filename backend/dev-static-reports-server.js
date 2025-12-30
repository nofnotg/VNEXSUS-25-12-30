import express from "express";
import path from "path";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 5500;

app.use("/VNEXSUS_A-B-C_Execution_Plan", express.static(path.resolve("VNEXSUS_A-B-C_Execution_Plan")));
app.use("/reports", express.static(path.resolve("reports")));
app.use("/reports", express.static(path.resolve("temp/reports")));

app.get("/VNEXSUS_A-B-C_Execution_Plan/app_progress_report", (_req, res) => {
  res.sendFile(path.resolve("VNEXSUS_A-B-C_Execution_Plan", "app_progress_report_offline.html"));
});
app.get("/reports/offline_coord_analysis", (_req, res) => {
  res.sendFile(path.resolve("reports", "offline_coord_analysis.html"));
});

app.get("/", (_req, res) => {
  res.send(`<html><body><h3>Static Reports Server</h3>
    <ul>
      <li><a href="/VNEXSUS_A-B-C_Execution_Plan/app_progress_report">공정율 관제(app_progress_report)</a></li>
      <li><a href="/reports/offline_coord_analysis">품질 관제(offine_coord_analysis)</a></li>
      <li><a href="/Comprehensive_Case_Progress_Report.html">케이스 종합 리포트(reports)</a></li>
      <li><a href="/reports/Comprehensive_Case_Progress_Report.html">케이스 종합 리포트(temp/reports)</a></li>
    </ul>
  </body></html>`);
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Static Reports Server listening at http://localhost:${PORT}/`);
});
