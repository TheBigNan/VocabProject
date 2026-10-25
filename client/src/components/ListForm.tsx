import { useState, type FormEvent } from "react";
import { GENRES } from "../genres";
import { CATEGORIES, DEFAULT_CATEGORY } from "../categories";

export interface ListFormValues {
  title: string;
  creator: string;
  genre: string;
  category: string;
  dateUploaded: string;
  pdf?: File;
}

export interface EditingListInfo {
  id: string;
  title: string;
  creator: string;
  genre: string;
  category: string;
  dateUploaded: string; // ISO string
  originalFilename: string;
}

function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return today();
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ListForm({
  editing,
  onSubmit,
  onCancel,
}: {
  editing: EditingListInfo | null;
  onSubmit: (values: ListFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [creator, setCreator] = useState(editing?.creator ?? "");
  const [genre, setGenre] = useState<string>(editing?.genre ?? GENRES[0]);
  const [category, setCategory] = useState<string>(
    editing?.category ?? DEFAULT_CATEGORY
  );
  const [dateUploaded, setDateUploaded] = useState(
    editing ? toDateInputValue(editing.dateUploaded) : today()
  );
  const [pdf, setPdf] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Please enter a name for the list.");
      return;
    }
    if (!creator.trim()) {
      setError("Please enter a creator.");
      return;
    }
    if (!editing && !pdf) {
      setError("Please choose a PDF file.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        creator: creator.trim(),
        genre,
        category,
        dateUploaded,
        pdf: pdf ?? undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card-form" onSubmit={handleSubmit}>
      <label className="form-field">
        <span>Name</span>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <label className="form-field">
        <span>Creator</span>
        <input
          type="text"
          required
          value={creator}
          onChange={(e) => setCreator(e.target.value)}
        />
      </label>

      <label className="form-field">
        <span>Genre</span>
        <select value={genre} onChange={(e) => setGenre(e.target.value)}>
          {GENRES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>

      <label className="form-field">
        <span>Section</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="form-field">
        <span>Date Uploaded</span>
        <input
          type="date"
          required
          value={dateUploaded}
          onChange={(e) => setDateUploaded(e.target.value)}
        />
      </label>

      <label className="form-field">
        <span>
          PDF
          {editing && " (leave blank to keep the current file)"}
        </span>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
        />
      </label>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting
            ? editing
              ? "Saving..."
              : "Adding..."
            : editing
              ? "Save Changes"
              : "Add List"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>

      {error && <p className="form-message form-error">{error}</p>}
    </form>
  );
}
