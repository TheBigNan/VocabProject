import { Router, type Request, type Response } from "express";
import admin, { db } from "../firebase.js";
import type { StatsSummary } from "../types.js";

const router = Router();

// GET /api/stats - current site visit and download counts
router.get("/", async (req: Request, res: Response) => {
  try {
    const doc = await db.collection("stats").doc("summary").get();
    const data = (doc.exists ? doc.data() : {}) as Partial<StatsSummary>;
    res.json({
      visits: data.visits || 0,
      downloads: data.downloads || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stats." });
  }
});

// POST /api/stats/visit - increments the site visit counter
router.post("/visit", async (req: Request, res: Response) => {
  try {
    await db
      .collection("stats")
      .doc("summary")
      .set(
        { visits: admin.firestore.FieldValue.increment(1) },
        { merge: true }
      );
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record visit." });
  }
});

export default router;
