import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import listsRouter from "./routes/lists.js";
import statsRouter from "./routes/stats.js";
import { storageDriver, uploadsDir } from "./storage.js";

const app = express();
const PORT = process.env.PORT || 5050;
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Only relevant when storageDriver is "local" — serves PDFs saved to disk.
app.use("/uploads", express.static(uploadsDir));

app.use("/api/lists", listsRouter);
app.use("/api/stats", statsRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || "Something went wrong." });
};
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Vocab server listening on http://localhost:${PORT}`);
  console.log(
    storageDriver === "local"
      ? "PDF storage: local disk (server/uploads) — set FIREBASE_STORAGE_BUCKET to switch to Firebase Storage."
      : "PDF storage: Firebase Storage"
  );
});
