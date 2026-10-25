export interface VocabList {
  id: string;
  creator: string;
  genre: string;
  dateUploaded: string;
  originalFilename: string;
  storagePath: string;
  fileUrl: string;
  downloadCount: number;
  isPreview?: boolean;
  published: boolean;
}

export interface StatsSummary {
  visits: number;
  downloads: number;
}

// "definition": word front, definition back.
// "picture": word front, picture back (imageUrl/imageStoragePath).
// "picture-picture": picture front (frontImageUrl/frontImageStoragePath),
// picture back (imageUrl/imageStoragePath) — word is not used.
export type CardType = "definition" | "picture" | "picture-picture";

export interface Flashcard {
  id: string;
  createdBy: string;
  word: string;
  cardType: CardType;
  definition?: string;
  imageUrl?: string;
  imageStoragePath?: string;
  frontImageUrl?: string;
  frontImageStoragePath?: string;
  createdAt: string;
}

export type UserRole = "member" | "admin";

export interface UserProfile {
  uid: string;
  email: string | null;
  role: UserRole;
  createdAt: string;
}

// A premade flashcard set, created by an admin and usable by everyone once
// published. Unpublished sets are only visible/editable by admins, so an
// admin can build a set out before showing it to members.
export interface FlashcardSet {
  id: string;
  title: string;
  genre: string;
  createdBy: string;
  createdAt: string;
  cardCount: number;
  published: boolean;
}

// A card within a FlashcardSet. Same shape as Flashcard but scoped to a
// set (setId) instead of a single user (createdBy).
export interface SetFlashcard {
  id: string;
  setId: string;
  word: string;
  cardType: CardType;
  definition?: string;
  imageUrl?: string;
  imageStoragePath?: string;
  frontImageUrl?: string;
  frontImageStoragePath?: string;
  createdAt: string;
}
