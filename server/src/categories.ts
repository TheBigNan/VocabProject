export const CATEGORIES = [
  { value: "popular-books", label: "Words from Popular Books" },
  { value: "sat-vocab", label: "SAT Vocab" },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];

export const CATEGORY_VALUES: readonly string[] = CATEGORIES.map((c) => c.value);

export const DEFAULT_CATEGORY: CategoryValue = "popular-books";
