import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { db } from "./firebase.js";
import { savePdf, uploadsDir } from "./storage.js";
import { buildWordListPdf, type WordListContent } from "./pdfTemplate.js";

const PREVIEW_LIST: WordListContent = {
  title: "Sample Vocabulary List",
  creator: "WordWise",
  genre: "Fantasy",
  words: [
    {
      word: "demigod",
      definition: "a being with one mortal and one divine parent",
      example: "Percy learns he is a demigod, the son of Poseidon.",
    },
    {
      word: "prophecy",
      definition: "a prediction of what will happen in the future",
      example: "The Oracle's prophecy hinted at a dangerous quest ahead.",
    },
    {
      word: "invincible",
      definition: "too powerful to be defeated or overcome",
      example: "Achilles was said to be nearly invincible in battle.",
    },
    {
      word: "quest",
      definition: "a long and difficult search for something",
      example: "The heroes set out on a quest to recover the master bolt.",
    },
  ],
};

async function clearExistingPreview() {
  const snapshot = await db
    .collection("lists")
    .where("isPreview", "==", true)
    .get();

  for (const doc of snapshot.docs) {
    const storagePath = doc.data().storagePath as string | undefined;
    if (storagePath?.startsWith("uploads/")) {
      const filePath = path.join(uploadsDir, path.basename(storagePath));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await doc.ref.delete();
  }

  if (snapshot.size > 0) {
    console.log(`Replaced ${snapshot.size} existing preview list(s).`);
  }
}

async function seedPreview() {
  await clearExistingPreview();

  const buffer = await buildWordListPdf(PREVIEW_LIST);
  const originalFilename = `${PREVIEW_LIST.title.replace(/\s+/g, "-")}.pdf`;
  const { storagePath, fileUrl } = await savePdf(buffer, originalFilename);

  await db.collection("lists").add({
    creator: PREVIEW_LIST.creator,
    genre: PREVIEW_LIST.genre,
    dateUploaded: new Date().toISOString(),
    originalFilename,
    storagePath,
    fileUrl,
    downloadCount: 0,
    isPreview: true,
  });

  console.log("Preview list created — visible to logged-out visitors.");
  console.log("Done.");
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedPreview()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seeding preview failed:", err);
      process.exit(1);
    });
}
