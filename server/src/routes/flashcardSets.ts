import { Router, type Request, type Response } from "express";
import admin, { db } from "../firebase.js";
import { requireAuth, requireAdmin, getUserRole } from "../middleware/auth.js";
import {
  cardImageUpload,
  buildNewCard,
  buildCardUpdate,
  deleteCardFiles,
  CardValidationError,
} from "../cardFields.js";
import { CATEGORY_VALUES } from "../categories.js";
import type { FlashcardSet, SetFlashcard } from "../types.js";

const router = Router();

const IMAGE_FOLDER = "flashcard-sets";

async function findCardOrFail(setId: string, cardId: string) {
  const docRef = db.collection("flashcardSetCards").doc(cardId);
  const doc = await docRef.get();
  if (!doc.exists || doc.data()?.setId !== setId) return null;
  return { docRef, data: doc.data() as SetFlashcard };
}

// GET /api/flashcard-sets - premade sets. Admins see every set, including
// unpublished drafts they're still building; everyone else only sees
// published ones.
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const role = await getUserRole(req.user!.uid);
    const snapshot = await db
      .collection("flashcardSets")
      .orderBy("createdAt", "desc")
      .get();
    const sets: FlashcardSet[] = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as FlashcardSet))
      // Sets created before the publish feature existed have no `published`
      // field at all — treat that as published (grandfathered in) rather
      // than silently hiding content that was already live.
      .filter((set) => role === "admin" || set.published !== false);
    res.json(sets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch flashcard sets." });
  }
});

// POST /api/flashcard-sets - create a new (unpublished) set. Admins only.
router.post("/", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, genre, category } = req.body as {
      title?: string;
      genre?: string;
      category?: string;
    };
    if (!title?.trim()) {
      return res.status(400).json({ error: "title is required." });
    }
    if (!genre?.trim()) {
      return res.status(400).json({ error: "genre is required." });
    }
    if (!category || !CATEGORY_VALUES.includes(category)) {
      return res.status(400).json({
        error: `category must be one of: ${CATEGORY_VALUES.join(", ")}.`,
      });
    }

    const data: Omit<FlashcardSet, "id"> = {
      title: title.trim(),
      genre: genre.trim(),
      category,
      createdBy: req.user!.uid,
      createdAt: new Date().toISOString(),
      cardCount: 0,
      published: false,
    };
    const docRef = await db.collection("flashcardSets").add(data);
    const doc = await docRef.get();
    res.status(201).json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create flashcard set." });
  }
});

// PATCH /api/flashcard-sets/:id/publish - publish or unpublish a set.
// Admins only. This is the "submit it to the public whenever ready" switch.
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

      const setRef = db.collection("flashcardSets").doc(req.params.id);
      const setDoc = await setRef.get();
      if (!setDoc.exists) {
        return res.status(404).json({ error: "Flashcard set not found." });
      }

      await setRef.update({ published });
      const updatedDoc = await setRef.get();
      res.json({ id: updatedDoc.id, ...updatedDoc.data() });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update publish status." });
    }
  }
);

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
      await deleteCardFiles(cardDoc.data() as SetFlashcard);
      await cardDoc.ref.delete();
    }

    await setRef.delete();
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete flashcard set." });
  }
});

// GET /api/flashcard-sets/:id/cards - cards in a set. Any logged-in user
// may read a published set's cards; unpublished (draft) sets are only
// readable by admins, so members never see a set that isn't ready yet.
router.get("/:id/cards", requireAuth, async (req: Request, res: Response) => {
  try {
    const setDoc = await db.collection("flashcardSets").doc(req.params.id).get();
    if (!setDoc.exists) {
      return res.status(404).json({ error: "Flashcard set not found." });
    }
    const set = setDoc.data() as FlashcardSet;

    if (set.published === false) {
      const role = await getUserRole(req.user!.uid);
      if (role !== "admin") {
        return res.status(403).json({ error: "This set isn't available yet." });
      }
    }

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
  cardImageUpload,
  async (req: Request, res: Response) => {
    try {
      const setRef = db.collection("flashcardSets").doc(req.params.id);
      const setDoc = await setRef.get();
      if (!setDoc.exists) {
        return res.status(404).json({ error: "Flashcard set not found." });
      }

      const fields = await buildNewCard(req.body, req.files as any, IMAGE_FOLDER);

      const data: Omit<SetFlashcard, "id"> = {
        setId: req.params.id,
        createdAt: new Date().toISOString(),
        ...fields,
      };

      const docRef = await db.collection("flashcardSetCards").add(data);
      await setRef.update({ cardCount: admin.firestore.FieldValue.increment(1) });
      const doc = await docRef.get();
      res.status(201).json({ id: doc.id, ...doc.data() });
    } catch (err) {
      if (err instanceof CardValidationError) {
        return res.status(400).json({ error: err.message });
      }
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
  cardImageUpload,
  async (req: Request, res: Response) => {
    try {
      const found = await findCardOrFail(req.params.id, req.params.cardId);
      if (!found) {
        return res.status(404).json({ error: "Card not found." });
      }

      const update = await buildCardUpdate(
        found.data,
        req.body,
        req.files as any,
        IMAGE_FOLDER
      );
      await found.docRef.update(update);
      const updatedDoc = await found.docRef.get();
      res.json({ id: updatedDoc.id, ...updatedDoc.data() });
    } catch (err) {
      if (err instanceof CardValidationError) {
        return res.status(400).json({ error: err.message });
      }
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

      await deleteCardFiles(found.data);
      await found.docRef.delete();
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
