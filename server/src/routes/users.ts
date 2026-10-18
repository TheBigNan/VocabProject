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

export default router;
