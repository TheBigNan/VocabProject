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

export interface UploadTarget extends SavedFile {
  uploadUrl: string;
}

// Returns a place the browser can PUT a PDF's raw bytes directly to,
// bypassing our Express server for the file body entirely (Vercel's
// serverless functions cap request bodies at 4.5MB, which a real
// multi-page vocab-list PDF can easily exceed). With Firebase Storage
// active, that's a short-lived v4 signed URL straight to the bucket; the
// caller must makeFilePublic() the result after the upload completes,
// since a signed PUT doesn't carry the public-read ACL the rest of the
// app relies on. In local-disk mode there's no equivalent external
// target, so we point back at our own PUT /api/lists/upload-local/:name
// route, which isn't constrained by Vercel since it only runs locally.
export async function getPdfUploadTarget(
  originalFilename: string
): Promise<UploadTarget> {
  const filename = `${randomUUID()}-${originalFilename}`;

  if (useFirebaseStorage) {
    const bucket = admin.storage().bucket();
    const storagePath = `lists/${filename}`;
    const [uploadUrl] = await bucket.file(storagePath).getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 10 * 60 * 1000,
      contentType: "application/pdf",
    });
    return {
      uploadUrl,
      storagePath,
      fileUrl: `https://storage.googleapis.com/${bucket.name}/${storagePath}`,
    };
  }

  return {
    uploadUrl: `/api/lists/upload-local/${encodeURIComponent(filename)}`,
    storagePath: `uploads/${filename}`,
    fileUrl: `/uploads/${filename}`,
  };
}

export async function writeLocalUpload(
  filename: string,
  buffer: Buffer
): Promise<void> {
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);
}

export async function makeFilePublic(storagePath: string): Promise<void> {
  if (!useFirebaseStorage) return;
  await admin.storage().bucket().file(storagePath).makePublic();
}

export async function deleteFile(storagePath: string): Promise<void> {
  if (useFirebaseStorage) {
    await admin.storage().bucket().file(storagePath).delete({ ignoreNotFound: true });
    return;
  }

  const filePath = path.join(uploadsDir, path.basename(storagePath));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
