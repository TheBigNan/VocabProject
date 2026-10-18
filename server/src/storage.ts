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

// Saves a file under the given folder and returns where it lives. Uses
// Firebase Storage when FIREBASE_STORAGE_BUCKET is set, otherwise falls back
// to local disk under server/uploads (useful before upgrading to the Blaze
// plan). Local disk doesn't namespace by folder — all local files share one
// flat directory, since the random filename prefix already avoids collisions.
export async function saveFile(
  buffer: Buffer,
  originalFilename: string,
  contentType: string,
  folder: string
): Promise<SavedFile> {
  const filename = `${randomUUID()}-${originalFilename}`;

  if (useFirebaseStorage) {
    const bucket = admin.storage().bucket();
    const storagePath = `${folder}/${filename}`;
    const fileRef = bucket.file(storagePath);
    await fileRef.save(buffer, { metadata: { contentType } });
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

export async function savePdf(
  buffer: Buffer,
  originalFilename: string
): Promise<SavedFile> {
  return saveFile(buffer, originalFilename, "application/pdf", "lists");
}

export async function deleteFile(storagePath: string): Promise<void> {
  if (useFirebaseStorage) {
    await admin.storage().bucket().file(storagePath).delete({ ignoreNotFound: true });
    return;
  }

  const filePath = path.join(uploadsDir, path.basename(storagePath));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
