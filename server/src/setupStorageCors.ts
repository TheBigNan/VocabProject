import "dotenv/config";
import admin from "./firebase.js";

// One-time (re-runnable) setup: allows the browser to PUT PDF bytes
// directly to Firebase Storage using the signed URLs issued by
// getPdfUploadTarget() in storage.ts. Without this, the bucket rejects
// those cross-origin PUT requests before our signed URL is even checked.
// Safe to re-run any time the allowed origins change (e.g. a new
// deployment alias) or the bucket is recreated.
const ALLOWED_ORIGINS = [
  "https://wordwise-web.vercel.app",
  "https://wordwise-web-vocab-warriors.vercel.app",
  "http://localhost:5173",
];

async function setupStorageCors() {
  const bucket = admin.storage().bucket();
  await bucket.setMetadata({
    cors: [
      {
        origin: ALLOWED_ORIGINS,
        method: ["PUT", "OPTIONS"],
        responseHeader: ["Content-Type"],
        maxAgeSeconds: 3600,
      },
    ],
  });
  console.log(`CORS configured on bucket "${bucket.name}" for:`);
  for (const origin of ALLOWED_ORIGINS) console.log(`  - ${origin}`);
}

setupStorageCors()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed to configure bucket CORS:", err);
    process.exit(1);
  });
