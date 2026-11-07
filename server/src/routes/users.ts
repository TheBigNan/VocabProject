import { Router, type Request, type Response } from "express";
import { db } from "../firebase.js";
import { requireAuth } from "../middleware/auth.js";
import type { UserProfile } from "../types.js";

const router = Router();

// GET /api/users/me - the current user's profile (role, etc). Creates a
// default "member" profile on first call, so both brand-new signups and
// accounts that existed before roles were added get one automatically.
// Admin status is never set here — that's done by hand in Firestore.
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const docRef = db.collection("users").doc(uid);
    const doc = await docRef.get();

    if (!doc.exists) {
      const profile: Omit<UserProfile, "uid"> = {
        email: req.user!.email ?? null,
        role: "member",
        createdAt: new Date().toISOString(),
        quizHighScore: 0,
      };
      await docRef.set(profile);
      return res.json({ uid, ...profile });
    }

    res.json({ uid, ...doc.data() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch profile." });
  }
});

// PATCH /api/users/me/quiz-score - records a Quiz Game result. Only ever
// raises the stored high score, never lowers it — the server is the
// source of truth so a slow network retry or an edited request can't
// accidentally erase a better run.
router.patch("/me/quiz-score", requireAuth, async (req: Request, res: Response) => {
  try {
    const { score } = req.body as { score?: number };
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
      return res.status(400).json({ error: "score must be a non-negative number." });
    }

    const uid = req.user!.uid;
    const docRef = db.collection("users").doc(uid);
    const doc = await docRef.get();
    const current = (doc.data()?.quizHighScore as number | undefined) ?? 0;
    const quizHighScore = Math.max(current, Math.round(score));

    await docRef.set({ quizHighScore }, { merge: true });
    res.json({ quizHighScore });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save quiz score." });
  }
});

export default router;
