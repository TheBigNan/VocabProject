import multer from "multer";
import admin from "./firebase.js";
import { saveFile, deleteFile } from "./storage.js";
import type { CardType } from "./types.js";

export const cardImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed."));
    }
    cb(null, true);
  },
}).fields([
  { name: "image", maxCount: 1 }, // the back face for "picture"/"picture-picture"
  { name: "frontImage", maxCount: 1 }, // the front face for "picture-picture" only
]);

type UploadedFiles = { [fieldname: string]: Express.Multer.File[] } | undefined;

function getFile(files: UploadedFiles, field: string): Express.Multer.File | undefined {
  return files?.[field]?.[0];
}

export interface CardFields {
  word: string;
  cardType: CardType;
  definition?: string;
  imageUrl?: string;
  imageStoragePath?: string;
  frontImageUrl?: string;
  frontImageStoragePath?: string;
}

export interface ExistingCard {
  word: string;
  cardType: CardType;
  definition?: string;
  imageUrl?: string;
  imageStoragePath?: string;
  frontImageUrl?: string;
  frontImageStoragePath?: string;
}

export class CardValidationError extends Error {}

function parseCardType(raw: string | undefined, fallback?: CardType): CardType {
  if (raw === undefined && fallback) return fallback;
  if (raw !== "definition" && raw !== "picture" && raw !== "picture-picture") {
    throw new CardValidationError(
      'cardType must be "definition", "picture", or "picture-picture".'
    );
  }
  return raw;
}

// Builds the fields for a brand-new card. Throws CardValidationError on bad
// input (missing word/definition/images for the chosen type).
export async function buildNewCard(
  body: { word?: string; cardType?: string; definition?: string },
  files: UploadedFiles,
  imageFolder: string
): Promise<CardFields> {
  const cardType = parseCardType(body.cardType);
  const image = getFile(files, "image");
  const frontImage = getFile(files, "frontImage");

  if (cardType !== "picture-picture" && !body.word?.trim()) {
    throw new CardValidationError("word is required.");
  }
  if (cardType === "definition" && !body.definition?.trim()) {
    throw new CardValidationError("definition is required for a definition card.");
  }
  if (cardType === "picture" && !image) {
    throw new CardValidationError("image is required for a picture card.");
  }
  if (cardType === "picture-picture" && (!frontImage || !image)) {
    throw new CardValidationError(
      "both a front and back picture are required for a picture + picture card."
    );
  }

  const fields: CardFields = {
    word: cardType === "picture-picture" ? body.word?.trim() ?? "" : body.word!.trim(),
    cardType,
  };

  if (cardType === "definition") {
    fields.definition = body.definition!.trim();
  }
  if (cardType === "picture" || cardType === "picture-picture") {
    const { storagePath, fileUrl } = await saveFile(
      image!.buffer,
      image!.originalname,
      image!.mimetype,
      imageFolder
    );
    fields.imageUrl = fileUrl;
    fields.imageStoragePath = storagePath;
  }
  if (cardType === "picture-picture") {
    const { storagePath, fileUrl } = await saveFile(
      frontImage!.buffer,
      frontImage!.originalname,
      frontImage!.mimetype,
      imageFolder
    );
    fields.frontImageUrl = fileUrl;
    fields.frontImageStoragePath = storagePath;
  }

  return fields;
}

// Builds a Firestore update object for editing an existing card, reusing
// existing images when the type doesn't change and no replacement was
// uploaded, and cleaning up any images that stop being used. Throws
// CardValidationError on bad input.
export async function buildCardUpdate(
  existing: ExistingCard,
  body: { word?: string; cardType?: string; definition?: string },
  files: UploadedFiles,
  imageFolder: string
): Promise<Record<string, unknown>> {
  const cardType = parseCardType(body.cardType, existing.cardType);
  const image = getFile(files, "image");
  const frontImage = getFile(files, "frontImage");

  const finalWord = body.word?.trim() || existing.word;
  if (cardType !== "picture-picture" && !finalWord) {
    throw new CardValidationError("word is required.");
  }

  const update: Record<string, unknown> = {
    word: cardType === "picture-picture" ? body.word?.trim() ?? existing.word ?? "" : finalWord,
    cardType,
  };

  // Definition: only kept for "definition" cards.
  if (cardType === "definition") {
    const finalDefinition =
      body.definition?.trim() ||
      (existing.cardType === "definition" ? existing.definition : undefined);
    if (!finalDefinition) {
      throw new CardValidationError("definition is required for a definition card.");
    }
    update.definition = finalDefinition;
  } else {
    update.definition = admin.firestore.FieldValue.delete();
  }

  // Back/main image: used by "picture" and "picture-picture".
  if (cardType === "picture" || cardType === "picture-picture") {
    if (image) {
      if (existing.imageStoragePath) await deleteFile(existing.imageStoragePath);
      const { storagePath, fileUrl } = await saveFile(
        image.buffer,
        image.originalname,
        image.mimetype,
        imageFolder
      );
      update.imageUrl = fileUrl;
      update.imageStoragePath = storagePath;
    } else if (!existing.imageUrl) {
      throw new CardValidationError(
        cardType === "picture"
          ? "image is required for a picture card."
          : "a back picture is required for a picture + picture card."
      );
    }
    // else: keep existing.imageUrl/imageStoragePath untouched.
  } else if (existing.imageStoragePath) {
    await deleteFile(existing.imageStoragePath);
    update.imageUrl = admin.firestore.FieldValue.delete();
    update.imageStoragePath = admin.firestore.FieldValue.delete();
  }

  // Front image: only used by "picture-picture".
  if (cardType === "picture-picture") {
    if (frontImage) {
      if (existing.frontImageStoragePath) await deleteFile(existing.frontImageStoragePath);
      const { storagePath, fileUrl } = await saveFile(
        frontImage.buffer,
        frontImage.originalname,
        frontImage.mimetype,
        imageFolder
      );
      update.frontImageUrl = fileUrl;
      update.frontImageStoragePath = storagePath;
    } else if (!existing.frontImageUrl) {
      throw new CardValidationError(
        "a front picture is required for a picture + picture card."
      );
    }
    // else: keep existing.frontImageUrl/frontImageStoragePath untouched.
  } else if (existing.frontImageStoragePath) {
    await deleteFile(existing.frontImageStoragePath);
    update.frontImageUrl = admin.firestore.FieldValue.delete();
    update.frontImageStoragePath = admin.firestore.FieldValue.delete();
  }

  return update;
}

export async function deleteCardFiles(card: ExistingCard): Promise<void> {
  if (card.imageStoragePath) await deleteFile(card.imageStoragePath);
  if (card.frontImageStoragePath) await deleteFile(card.frontImageStoragePath);
}
