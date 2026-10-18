import { Router, type Request, type Response } from "express";
import multer from "multer";
import admin, { db } from "../firebase.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { saveFile, deleteFile } from "../storage.js";
import type { FlashcardSet, SetFlashcard } from "../types.js";

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

async function findCardOrFail(setId: string, cardId: string) {
  const docRef = db.collection("flashcardSetCards").doc(cardId);
  const doc = await docRef.get();
  if (!doc.exists || doc.data()?.setId !== setId) return null;
  return { docRef, data: doc.data() as SetFlashcard };
}

// GET /api/flashcard-sets - all premade sets. Any logged-in user.
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const snapshot = await db
      .collection("flashcardSets")
      .orderBy("createdAt", "desc")
      .get();
    const sets: FlashcardSet[] = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as FlashcardSet)
    );
    res.json(sets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch flashcard sets." });
  }
});

// POST /api/flashcard-sets - create a new set. Admins only.
router.post("/", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, genre } = req.body as { title?: string; genre?: string };
    if (!title?.trim()) {
      return res.status(400).json({ error: "title is required." });
    }
    if (!genre?.trim()) {
      return res.status(400).json({ error: "genre is required." });
    }

    const data: Omit<FlashcardSet, "id"> = {
      title: title.trim(),
      genre: genre.trim(),
      createdBy: req.user!.uid,
      createdAt: new Date().toISOString(),
      cardCount: 0,
    };
    const docRef = await db.collection("flashcardSets").add(data);
    const doc = await docRef.get();
    res.status(201).json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create flashcard set." });
  }
});

// DELETE /api/flashcard-sets/:id - deletes the set and all its cards
// (and their images). Admins only.
router.delete("/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const setRef = db.collection("flashcardSets").doc(req.params.id);
    const setDoc = await setRef.get();
    if (!setDoc.exists) {
      return res.status(404).json({ error: "Flashcard set not found." });
    }

    const cardsSnapshot = await db
      .collection("flashcardSetCards")
      .where("setId", "==", req.params.id)
      .get();

    for (const cardDoc of cardsSnapshot.docs) {
      const storagePath = cardDoc.data().imageStoragePath as string | undefined;
      if (storagePath) await deleteFile(storagePath);
      await cardDoc.ref.delete();
    }

    await setRef.delete();
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete flashcard set." });
  }
});

// GET /api/flashcard-sets/:id/cards - cards in a set. Any logged-in user.
router.get("/:id/cards", requireAuth, async (req: Request, res: Response) => {
  try {
    const snapshot = await db
      .collection("flashcardSetCards")
      .where("setId", "==", req.params.id)
      .get();

    const cards: SetFlashcard[] = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as SetFlashcard))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    res.json(cards);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch cards." });
  }
});

// POST /api/flashcard-sets/:id/cards - add a card to a set. Admins only.
router.post(
  "/:id/cards",
  requireAuth,
  requireAdmin,
  upload.single("image"),
  async (req: Request, res: Response) => {
    try {
      const setRef = db.collection("flashcardSets").doc(req.params.id);
      const setDoc = await setRef.get();
      if (!setDoc.exists) {
        return res.status(404).json({ error: "Flashcard set not found." });
      }

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

      const data: Omit<SetFlashcard, "id"> = {
        setId: req.params.id,
        word,
        cardType,
        createdAt: new Date().toISOString(),
      };

      if (cardType === "definition") {
        data.definition = definition;
      } else if (req.file) {
        const { storagePath, fileUrl } = await saveFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          "flashcard-sets"
        );
        data.imageUrl = fileUrl;
        data.imageStoragePath = storagePath;
      }

      const docRef = await db.collection("flashcardSetCards").add(data);
      await setRef.update({ cardCount: admin.firestore.FieldValue.increment(1) });
      const doc = await docRef.get();
      res.status(201).json({ id: doc.id, ...doc.data() });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to add card." });
    }
  }
);

// PUT /api/flashcard-sets/:id/cards/:cardId - edit a card. Admins only.
router.put(
  "/:id/cards/:cardId",
  requireAuth,
  requireAdmin,
  upload.single("image"),
  async (req: Request, res: Response) => {
    try {
      const found = await findCardOrFail(req.params.id, req.params.cardId);
      if (!found) {
        return res.status(404).json({ error: "Card not found." });
      }
      const { docRef, data: existing } = found;

      const { word, cardType, definition } = req.body as {
        word?: string;
        cardType?: string;
        definition?: string;
      };

      if (
        cardType !== undefined &&
        cardType !== "definition" &&
        cardType !== "picture"
      ) {
        return res
          .status(400)
          .json({ error: 'cardType must be "definition" or "picture".' });
      }

      const finalWord = word?.trim() || existing.word;
      if (!finalWord) {
        return res.status(400).json({ error: "word is required." });
      }
      const finalType = (cardType as "definition" | "picture" | undefined) ?? existing.cardType;

      const update: Record<string, unknown> = {
        word: finalWord,
        cardType: finalType,
      };

      if (finalType === "definition") {
        const finalDefinition =
          definition?.trim() ||
          (existing.cardType === "definition" ? existing.definition : undefined);
        if (!finalDefinition) {
          return res
            .status(400)
            .json({ error: "definition is required for a definition card." });
        }
        update.definition = finalDefinition;

        if (existing.imageStoragePath) {
          await deleteFile(existing.imageStoragePath);
        }
        update.imageUrl = admin.firestore.FieldValue.delete();
        update.imageStoragePath = admin.firestore.FieldValue.delete();
      } else {
        if (req.file) {
          if (existing.imageStoragePath) {
            await deleteFile(existing.imageStoragePath);
          }
          const { storagePath, fileUrl } = await saveFile(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype,
            "flashcard-sets"
          );
          update.imageUrl = fileUrl;
          update.imageStoragePath = storagePath;
        } else if (existing.cardType !== "picture" || !existing.imageUrl) {
          return res
            .status(400)
            .json({ error: "image is required for a picture card." });
        }
        update.definition = admin.firestore.FieldValue.delete();
      }

      await docRef.update(update);
      const updatedDoc = await docRef.get();
      res.json({ id: updatedDoc.id, ...updatedDoc.data() });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update card." });
    }
  }
);

// DELETE /api/flashcard-sets/:id/cards/:cardId - remove a card from a set.
// Admins only.
router.delete(
  "/:id/cards/:cardId",
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const found = await findCardOrFail(req.params.id, req.params.cardId);
      if (!found) {
        return res.status(404).json({ error: "Card not found." });
      }
      const { docRef, data: card } = found;

      if (card.imageStoragePath) {
        await deleteFile(card.imageStoragePath);
      }
      await docRef.delete();
      await db
        .collection("flashcardSets")
        .doc(req.params.id)
        .update({ cardCount: admin.firestore.FieldValue.increment(-1) });

      res.status(204).end();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete card." });
    }
  }
);

export default router;
