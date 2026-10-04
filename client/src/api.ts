import type { VocabList, StatsSummary } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";

export class AuthError extends Error {}

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

export async function fetchStats(): Promise<StatsSummary> {
  const res = await fetch(`${API_URL}/api/stats`);
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
