import { Router, type Request, type Response } from "express";
import { db } from "../firebase.js";
import { requireAuth } from "../middleware/auth.js";
import {
  cardImageUpload,
  buildNewCard,
  buildCardUpdate,
  deleteCardFiles,
  CardValidationError,
} from "../cardFields.js";
import type { Flashcard } from "../types.js";

const router = Router();

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

// POST /api/flashcards - create a flashcard: word + definition, word +
// picture, or picture + picture.
router.post("/", requireAuth, cardImageUpload, async (req: Request, res: Response) => {
  try {
    const fields = await buildNewCard(req.body, req.files as any, "flashcards");

    const data: Omit<Flashcard, "id"> = {
      createdBy: req.user!.uid,
      createdAt: new Date().toISOString(),
      ...fields,
    };

    const docRef = await db.collection("flashcards").add(data);
    const doc = await docRef.get();
    res.status(201).json({ id: doc.id, ...doc.data() });
  } catch (err) {
    if (err instanceof CardValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create flashcard." });
  }
});

// PUT /api/flashcards/:id - edit a flashcard. Only the owner can edit their
// own card. Fields are optional — omit what hasn't changed. Switching card
// type cleans up images that stop being used; staying on the same
// picture field without a new upload keeps the existing image.
router.put("/:id", requireAuth, cardImageUpload, async (req: Request, res: Response) => {
  try {
    const docRef = db.collection("flashcards").doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Flashcard not found." });
    }

    const existing = doc.data() as Flashcard;
    if (existing.createdBy !== req.user!.uid) {
      return res
        .status(403)
        .json({ error: "You can only edit your own flashcards." });
    }

    const update = await buildCardUpdate(existing, req.body, req.files as any, "flashcards");
    await docRef.update(update);
    const updatedDoc = await docRef.get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (err) {
    if (err instanceof CardValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to update flashcard." });
  }
});

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

    await deleteCardFiles(card);
    await docRef.delete();

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete flashcard." });
  }
});

export default router;
