import type { Request, Response, NextFunction } from "express";
import admin, { db } from "../firebase.js";
import type { UserRole } from "../types.js";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ error: "Please log in to view this." });
  }

  try {
    req.user = await admin.auth().verifyIdToken(token);
    next();
  } catch {
    res
      .status(401)
      .json({ error: "Your session has expired. Please log in again." });
  }
}

// Looks up a user's role in Firestore (users/{uid}.role) rather than
// trusting anything from the client, since admin status is set by hand in
// the database, not chosen by the user. Defaults to "member" if no profile
// exists yet.
export async function getUserRole(uid: string): Promise<UserRole> {
  const doc = await db.collection("users").doc(uid).get();
  const role = doc.exists ? doc.data()?.role : "member";
  return role === "admin" ? "admin" : "member";
}

// Must run after requireAuth.
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const role = await getUserRole(req.user!.uid);
    if (role !== "admin") {
      return res.status(403).json({ error: "Admins only." });
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to verify admin access." });
  }
}
