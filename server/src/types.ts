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
}

export interface StatsSummary {
  visits: number;
  downloads: number;
}

export interface Flashcard {
  id: string;
  createdBy: string;
  word: string;
  cardType: "definition" | "picture";
  definition?: string;
  imageUrl?: string;
  imageStoragePath?: string;
  createdAt: string;
}

export type UserRole = "member" | "admin";

export interface UserProfile {
  uid: string;
  email: string | null;
  role: UserRole;
  createdAt: string;
}
