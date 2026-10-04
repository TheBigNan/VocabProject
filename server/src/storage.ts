import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import admin from "./firebase.js";

const useFirebaseStorage = Boolean(process.env.FIREBASE_STORAGE_BUCKET);

export const storageDriver: "firebase" | "local" = useFirebaseStorage
  ? "firebase"
  : "local";

export const uploadsDir = path.join(process.cwd(), "uploads");

if (!useFirebaseStorage) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export interface SavedFile {
  storagePath: string;
  fileUrl: string;
}

// Saves a PDF and returns where it lives. Uses Firebase Storage when
// FIREBASE_STORAGE_BUCKET is set, otherwise falls back to local disk under
// server/uploads (useful before upgrading to the Blaze plan).
export async function savePdf(
  buffer: Buffer,
  originalFilename: string
): Promise<SavedFile> {
  const filename = `${randomUUID()}-${originalFilename}`;

  if (useFirebaseStorage) {
    const bucket = admin.storage().bucket();
    const storagePath = `lists/${filename}`;
    const fileRef = bucket.file(storagePath);
    await fileRef.save(buffer, {
      metadata: { contentType: "application/pdf" },
    });
    await fileRef.makePublic();
    return {
      storagePath,
      fileUrl: `https://storage.googleapis.com/${bucket.name}/${storagePath}`,
    };
  }

  fs.writeFileSync(path.join(uploadsDir, filename), buffer);
  return {
    storagePath: `uploads/${filename}`,
    fileUrl: `/uploads/${filename}`,
  };
}
