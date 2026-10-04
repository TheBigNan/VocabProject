import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import listsRouter from "./routes/lists.js";
import statsRouter from "./routes/stats.js";
import { uploadsDir } from "./storage.js";

const app = express();
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Only relevant when storageDriver is "local" — serves PDFs saved to disk.
// Not used in production once FIREBASE_STORAGE_BUCKET is set.
app.use("/uploads", express.static(uploadsDir));

app.use("/api/lists", listsRouter);
app.use("/api/stats", statsRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || "Something went wrong." });
};
app.use(errorHandler);

export default app;
