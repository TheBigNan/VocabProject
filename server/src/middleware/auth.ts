import type { Request, Response, NextFunction } from "express";
import admin from "../firebase.js";

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
