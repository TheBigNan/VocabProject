export const GENRES = [
  "Fantasy",
  "Adventure / Mystery",
  "Science Fiction",
  "Realistic Fiction",
  "Historical Fiction",
  "Nonfiction",
  "Other",
] as const;

export type Genre = (typeof GENRES)[number];
