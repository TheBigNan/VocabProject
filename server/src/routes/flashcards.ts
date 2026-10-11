import { Router, type Request, type Response } from "express";
import multer from "multer";
import { db } from "../firebase.js";
import { requireAuth } from "../middleware/auth.js";
import { saveImage, deleteFile } from "../storage.js";
import type { Flashcard } from "../types.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }
    cb(null, true);
  },
});

// GET /api/flashcards - the current user's own flashcards, newest first.
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const snapshot = await db
      .collection("flashcards")
      .where("createdBy", "==", req.user!.uid)
      .get();

    const cards: Flashcard[] = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Flashcard))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json(cards);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch flashcards." });
  }
});

// POST /api/flashcards - create a flashcard (word + definition, or word + picture).
router.post(
  "/",
  requireAuth,
  upload.single("image"),
  async (req: Request, res: Response) => {
    try {
      const { word, cardType, definition } = req.body as {
        word?: string;
        cardType?: string;
        definition?: string;
      };

      if (!word) {
        return res.status(400).json({ error: "word is required." });
      }
      if (cardType !== "definition" && cardType !== "picture") {
        return res
          .status(400)
          .json({ error: 'cardType must be "definition" or "picture".' });
      }
      if (cardType === "definition" && !definition) {
        return res
          .status(400)
          .json({ error: "definition is required for a definition card." });
      }
      if (cardType === "picture" && !req.file) {
        return res
          .status(400)
          .json({ error: "image is required for a picture card." });
      }

      const data: Omit<Flashcard, "id"> = {
        createdBy: req.user!.uid,
        word,
        cardType,
        createdAt: new Date().toISOString(),
      };

      if (cardType === "definition") {
        data.definition = definition;
      } else if (req.file) {
        const { storagePath, fileUrl } = await saveImage(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );
        data.imageUrl = fileUrl;
        data.imageStoragePath = storagePath;
      }

      const docRef = await db.collection("flashcards").add(data);
      const doc = await docRef.get();
      res.status(201).json({ id: doc.id, ...doc.data() });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create flashcard." });
    }
  }
);

// DELETE /api/flashcards/:id - only the owner can delete their own card.
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const docRef = db.collection("flashcards").doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Flashcard not found." });
    }

    const card = doc.data() as Flashcard;
    if (card.createdBy !== req.user!.uid) {
      return res.status(403).json({ error: "You can only delete your own flashcards." });
    }

    if (card.imageStoragePath) {
      await deleteFile(card.imageStoragePath);
    }
    await docRef.delete();

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete flashcard." });
  }
});

export default router;
