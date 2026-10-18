import type {
  VocabList,
  StatsSummary,
  Flashcard,
  UserProfile,
  FlashcardSet,
  SetFlashcard,
  CardType,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";

export class AuthError extends Error {}
export class ForbiddenError extends Error {}

// Requires a logged-in user's Firebase ID token — returns the full library.
export async function fetchLists(idToken: string): Promise<VocabList[]> {
  const res = await fetch(`${API_URL}/api/lists`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 401) throw new AuthError("Not authorized.");
  if (!res.ok) throw new Error("Failed to fetch lists.");
  return res.json();
}

// Public — the one list flagged as a preview, visible to logged-out users.
export async function fetchPreview(): Promise<VocabList | null> {
  const res = await fetch(`${API_URL}/api/lists/preview`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch preview.");
  return res.json();
}

// Public download link — only works for the preview list.
export function downloadUrl(id: string): string {
  return `${API_URL}/api/lists/${id}/download`;
}

// Download link for any list, authorized via a Firebase ID token.
export function authenticatedDownloadUrl(id: string, idToken: string): string {
  return `${API_URL}/api/lists/${id}/download?token=${encodeURIComponent(idToken)}`;
}

// Admin only.
export async function fetchStats(idToken: string): Promise<StatsSummary> {
  const res = await fetch(`${API_URL}/api/stats`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 401) throw new AuthError("Not authorized.");
  if (res.status === 403) throw new ForbiddenError("Admins only.");
  if (!res.ok) throw new Error("Failed to fetch stats.");
  return res.json();
}

export async function recordVisit(): Promise<void> {
  try {
    await fetch(`${API_URL}/api/stats/visit`, { method: "POST" });
  } catch {
    // non-critical, ignore failures
  }
}

export async function fetchFlashcards(idToken: string): Promise<Flashcard[]> {
  const res = await fetch(`${API_URL}/api/flashcards`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 401) throw new AuthError("Not authorized.");
  if (!res.ok) throw new Error("Failed to fetch flashcards.");
  return res.json();
}

export interface CreateFlashcardInput {
  word: string;
  cardType: CardType;
  definition?: string;
  image?: File;
  frontImage?: File;
}

function cardFormData(input: CreateFlashcardInput): FormData {
  const formData = new FormData();
  formData.append("word", input.word);
  formData.append("cardType", input.cardType);
  if (input.definition) formData.append("definition", input.definition);
  if (input.image) formData.append("image", input.image);
  if (input.frontImage) formData.append("frontImage", input.frontImage);
  return formData;
}

export async function createFlashcard(
  idToken: string,
  input: CreateFlashcardInput
): Promise<Flashcard> {
  const res = await fetch(`${API_URL}/api/flashcards`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
    body: cardFormData(input),
  });
  if (res.status === 401) throw new AuthError("Not authorized.");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to create flashcard.");
  }
  return res.json();
}

export async function updateFlashcard(
  idToken: string,
  id: string,
  input: CreateFlashcardInput
): Promise<Flashcard> {
  const res = await fetch(`${API_URL}/api/flashcards/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${idToken}` },
    body: cardFormData(input),
  });
  if (res.status === 401) throw new AuthError("Not authorized.");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to update flashcard.");
  }
  return res.json();
}

export async function deleteFlashcard(idToken: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/flashcards/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 401) throw new AuthError("Not authorized.");
  if (!res.ok) throw new Error("Failed to delete flashcard.");
}

// The current user's profile (role, etc). Creates a default "member"
// profile on the server on first call.
export async function fetchMe(idToken: string): Promise<UserProfile> {
  const res = await fetch(`${API_URL}/api/users/me`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 401) throw new AuthError("Not authorized.");
  if (!res.ok) throw new Error("Failed to fetch profile.");
  return res.json();
}

// Premade flashcard sets — readable by any logged-in user (admins also see
// unpublished drafts), writable by admins only (enforced server-side).

export async function fetchFlashcardSets(idToken: string): Promise<FlashcardSet[]> {
  const res = await fetch(`${API_URL}/api/flashcard-sets`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 401) throw new AuthError("Not authorized.");
  if (!res.ok) throw new Error("Failed to fetch flashcard sets.");
  return res.json();
}

export async function createFlashcardSet(
  idToken: string,
  input: { title: string; genre: string }
): Promise<FlashcardSet> {
  const res = await fetch(`${API_URL}/api/flashcard-sets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (res.status === 401) throw new AuthError("Not authorized.");
  if (res.status === 403) throw new ForbiddenError("Admins only.");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to create flashcard set.");
  }
  return res.json();
}

// Toggles a set between draft (false) and public (true).
export async function setFlashcardSetPublished(
  idToken: string,
  id: string,
  published: boolean
): Promise<FlashcardSet> {
  const res = await fetch(`${API_URL}/api/flashcard-sets/${id}/publish`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ published }),
  });
  if (res.status === 401) throw new AuthError("Not authorized.");
  if (res.status === 403) throw new ForbiddenError("Admins only.");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to update publish status.");
  }
  return res.json();
}

export async function deleteFlashcardSet(idToken: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/flashcard-sets/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 401) throw new AuthError("Not authorized.");
  if (res.status === 403) throw new ForbiddenError("Admins only.");
  if (!res.ok) throw new Error("Failed to delete flashcard set.");
}

export async function fetchSetCards(
  idToken: string,
  setId: string
): Promise<SetFlashcard[]> {
  const res = await fetch(`${API_URL}/api/flashcard-sets/${setId}/cards`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 401) throw new AuthError("Not authorized.");
  if (res.status === 403) throw new ForbiddenError("This set isn't available yet.");
  if (!res.ok) throw new Error("Failed to fetch cards.");
  return res.json();
}

export interface SetCardInput {
  word: string;
  cardType: CardType;
  definition?: string;
  image?: File;
  frontImage?: File;
}

export async function createSetCard(
  idToken: string,
  setId: string,
  input: SetCardInput
): Promise<SetFlashcard> {
  const res = await fetch(`${API_URL}/api/flashcard-sets/${setId}/cards`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
    body: cardFormData(input),
  });
  if (res.status === 401) throw new AuthError("Not authorized.");
  if (res.status === 403) throw new ForbiddenError("Admins only.");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to add card.");
  }
  return res.json();
}

export async function updateSetCard(
  idToken: string,
  setId: string,
  cardId: string,
  input: SetCardInput
): Promise<SetFlashcard> {
  const res = await fetch(`${API_URL}/api/flashcard-sets/${setId}/cards/${cardId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${idToken}` },
    body: cardFormData(input),
  });
  if (res.status === 401) throw new AuthError("Not authorized.");
  if (res.status === 403) throw new ForbiddenError("Admins only.");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to update card.");
  }
  return res.json();
}

export async function deleteSetCard(
  idToken: string,
  setId: string,
  cardId: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/flashcard-sets/${setId}/cards/${cardId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 401) throw new AuthError("Not authorized.");
  if (res.status === 403) throw new ForbiddenError("Admins only.");
  if (!res.ok) throw new Error("Failed to delete card.");
}
