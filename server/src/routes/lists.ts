import { Router, type Request, type Response } from "express";
import express from "express";
import admin, { db } from "../firebase.js";
import { requireAuth, requireAdmin, getUserRole } from "../middleware/auth.js";
import {
  deleteFile,
  getPdfUploadTarget,
  writeLocalUpload,
  makeFilePublic,
} from "../storage.js";
import { CATEGORY_VALUES, DEFAULT_CATEGORY } from "../categories.js";
import type { VocabList } from "../types.js";

const router = Router();

// GET /api/lists - the full library, newest first. Admins see every list,
// including unpublished drafts; everyone else only sees published ones.
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const role = await getUserRole(req.user!.uid);
    const snapshot = await db
      .collection("lists")
      .orderBy("dateUploaded", "desc")
      .get();
    const lists: VocabList[] = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as VocabList))
      // Lists added before the publish feature existed have no `published`
      // field — treat that as published rather than hiding content that
      // was already live.
      .filter((list) => role === "admin" || list.published !== false);
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

// POST /api/lists/upload-url - get a place to PUT a PDF's raw bytes
// directly (Firebase Storage signed URL, or our own local-upload route
// in local-disk mode), bypassing Express/Vercel for the file body.
// Admins only. The client PUTs the file here first, then calls POST /
// or PUT /:id with the returned storagePath/fileUrl to finish adding
// or editing a list.
router.post(
  "/upload-url",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { filename } = req.body as { filename?: string };
      if (!filename?.trim()) {
        return res.status(400).json({ error: "filename is required." });
      }
      const target = await getPdfUploadTarget(filename.trim());
      res.json(target);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to prepare upload." });
    }
  }
);

// PUT /api/lists/upload-local/:filename - local-disk-mode counterpart to
// the signed Firebase Storage URL above. Only used when FIREBASE_STORAGE_
// BUCKET isn't set (local dev); not subject to Vercel's request body
// limit since it never runs on Vercel. Admins only.
router.put(
  "/upload-local/:filename",
  requireAuth,
  requireAdmin,
  express.raw({ type: "application/pdf", limit: "20mb" }),
  async (req: Request, res: Response) => {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: "No file data received." });
      }
      await writeLocalUpload(req.params.filename, req.body);
      res.status(204).end();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to save file." });
    }
  }
);

// POST /api/lists - create a new vocabulary list from an already-uploaded
// PDF (see POST /upload-url above). Admins only. Created as a draft
// (published: false) so it isn't visible to members until the admin
// explicitly publishes it.
router.post("/", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      title,
      creator,
      genre,
      category,
      dateUploaded,
      storagePath,
      fileUrl,
      originalFilename,
    } = req.body as {
      title?: string;
      creator?: string;
      genre?: string;
      category?: string;
      dateUploaded?: string;
      storagePath?: string;
      fileUrl?: string;
      originalFilename?: string;
    };

    if (!title?.trim()) {
      return res.status(400).json({ error: "title is required." });
    }
    if (!creator?.trim()) {
      return res.status(400).json({ error: "creator is required." });
    }
    if (!genre?.trim()) {
      return res.status(400).json({ error: "genre is required." });
    }
    if (!category || !CATEGORY_VALUES.includes(category)) {
      return res.status(400).json({
        error: `category must be one of: ${CATEGORY_VALUES.join(", ")}.`,
      });
    }
    if (!storagePath || !fileUrl || !originalFilename) {
      return res.status(400).json({ error: "pdf is required." });
    }

    await makeFilePublic(storagePath);

    const data: Omit<VocabList, "id"> = {
      title: title.trim(),
      creator: creator.trim(),
      genre: genre.trim(),
      category,
      dateUploaded: dateUploaded
        ? new Date(dateUploaded).toISOString()
        : new Date().toISOString(),
      originalFilename,
      storagePath,
      fileUrl,
      downloadCount: 0,
      published: false,
    };

    const docRef = await db.collection("lists").add(data);
    const doc = await docRef.get();
    res.status(201).json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add list." });
  }
});

// PUT /api/lists/:id - edit a list's metadata and/or replace its PDF.
// Admins only. Fields are optional — omit what hasn't changed. To
// replace the PDF, first PUT the new bytes via a target from POST
// /upload-url, then include its storagePath/fileUrl/originalFilename
// here; omitting them keeps the existing file.
router.put("/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const docRef = db.collection("lists").doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "List not found." });
    }
    const existing = doc.data() as VocabList;

    const {
      title,
      creator,
      genre,
      category,
      dateUploaded,
      storagePath,
      fileUrl,
      originalFilename,
    } = req.body as {
      title?: string;
      creator?: string;
      genre?: string;
      category?: string;
      dateUploaded?: string;
      storagePath?: string;
      fileUrl?: string;
      originalFilename?: string;
    };

    if (category !== undefined && !CATEGORY_VALUES.includes(category)) {
      return res.status(400).json({
        error: `category must be one of: ${CATEGORY_VALUES.join(", ")}.`,
      });
    }

    const update: Record<string, unknown> = {
      title: title?.trim() || existing.title,
      creator: creator?.trim() || existing.creator,
      genre: genre?.trim() || existing.genre,
      category: category || existing.category || DEFAULT_CATEGORY,
      dateUploaded: dateUploaded
        ? new Date(dateUploaded).toISOString()
        : existing.dateUploaded,
    };

    if (storagePath && fileUrl && originalFilename) {
      await makeFilePublic(storagePath);
      if (existing.storagePath) {
        await deleteFile(existing.storagePath);
      }
      update.storagePath = storagePath;
      update.fileUrl = fileUrl;
      update.originalFilename = originalFilename;
    }

    await docRef.update(update);
    const updatedDoc = await docRef.get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update list." });
  }
});

// PATCH /api/lists/:id/publish - publish or unpublish a list. Admins only.
router.patch(
  "/:id/publish",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { published } = req.body as { published?: boolean };
      if (typeof published !== "boolean") {
        return res.status(400).json({ error: "published must be true or false." });
      }

      const docRef = db.collection("lists").doc(req.params.id);
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: "List not found." });
      }

      await docRef.update({ published });
      const updatedDoc = await docRef.get();
      res.json({ id: updatedDoc.id, ...updatedDoc.data() });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update publish status." });
    }
  }
);

// GET /api/lists/:id/download - increments the download counter, then redirects to the PDF.
// Public only for the preview list; every other list requires a valid login,
// passed either as an Authorization header or a ?token= query param (the
// latter so plain browser navigation/redirects work for opening PDFs). An
// unpublished (draft) list additionally requires the caller to be an admin.
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

      let decoded;
      try {
        decoded = await admin.auth().verifyIdToken(token);
      } catch {
        return res
          .status(401)
          .json({ error: "Your session has expired. Please log in again." });
      }

      if (list.published === false) {
        const role = await getUserRole(decoded.uid);
        if (role !== "admin") {
          return res.status(403).json({ error: "This list isn't available yet." });
        }
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

// DELETE /api/lists/:id - removes a list and its PDF. Admins only.
router.delete("/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const docRef = db.collection("lists").doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "List not found." });
    }

    const list = doc.data() as VocabList;
    if (list.storagePath) {
      await deleteFile(list.storagePath);
    }
    await docRef.delete();

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete list." });
  }
});

export default router;
