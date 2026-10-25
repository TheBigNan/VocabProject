export const CATEGORIES = [
  { value: "popular-books", label: "Vocab from Popular Books" },
  { value: "sat-vocab", label: "SAT Vocab" },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label])
);

export const DEFAULT_CATEGORY: CategoryValue = "popular-books";
