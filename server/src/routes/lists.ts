import { Router, type Request, type Response } from "express";
import admin, { db } from "../firebase.js";
import { requireAuth } from "../middleware/auth.js";
import type { VocabList } from "../types.js";

const router = Router();

// GET /api/lists - the full library, newest first. Requires login.
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const snapshot = await db
      .collection("lists")
      .orderBy("dateUploaded", "desc")
      .get();
    const lists: VocabList[] = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as VocabList)
    );
    res.json(lists);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch lists." });
  }
});

// GET /api/lists/preview - the single list flagged isPreview, public, no login required.
router.get("/preview", async (req: Request, res: Response) => {
  try {
    const snapshot = await db
      .collection("lists")
      .where("isPreview", "==", true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: "No preview list configured yet." });
    }

    const doc = snapshot.docs[0];
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch preview." });
  }
});

// GET /api/lists/:id/download - increments the download counter, then redirects to the PDF.
// Public only for the preview list; every other list requires a valid login,
// passed either as an Authorization header or a ?token= query param (the
// latter so plain browser navigation/redirects work for opening PDFs).
router.get("/:id/download", async (req: Request, res: Response) => {
  try {
    const docRef = db.collection("lists").doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "List not found." });
    }

    const list = doc.data() as VocabList;

    if (!list.isPreview) {
      const header = req.headers.authorization;
      const headerToken = header?.startsWith("Bearer ")
        ? header.slice(7)
        : undefined;
      const queryToken =
        typeof req.query.token === "string" ? req.query.token : undefined;
      const token = headerToken || queryToken;

      if (!token) {
        return res
          .status(401)
          .json({ error: "Please log in to download this list." });
      }

      try {
        await admin.auth().verifyIdToken(token);
      } catch {
        return res
          .status(401)
          .json({ error: "Your session has expired. Please log in again." });
      }
    }

    const increment = admin.firestore.FieldValue.increment(1);
    await docRef.update({ downloadCount: increment });
    await db
      .collection("stats")
      .doc("summary")
      .set({ downloads: increment }, { merge: true });

    res.redirect(list.fileUrl);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process download." });
  }
});

export default router;
