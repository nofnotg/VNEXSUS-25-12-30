import express from "express";
import path from "path";

const app = express();
const root = path.resolve(process.cwd(), "outputs");
app.use(express.static(root));
const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`Preview: http://localhost:${port}/progress/progress-2026-01-01.html`);
});

