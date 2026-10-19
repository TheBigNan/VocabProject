import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  AuthError,
  authenticatedDownloadUrl,
  createFlashcardSet,
  deleteFlashcardSet,
  deleteList,
  downloadUrl,
  fetchFlashcardSets,
  fetchLists,
  fetchPreview,
  ForbiddenError,
  setFlashcardSetPublished,
} from "../api";
import type { VocabList, FlashcardSet } from "../types";
import { GENRES } from "../genres";
import { useAuth } from "../auth/AuthContext";

type Status = "loading" | "loaded" | "error" | "unauthorized";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function PreviewView() {
  const [preview, setPreview] = useState<VocabList | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    fetchPreview()
      .then((data) => {
        setPreview(data);
        setStatus("loaded");
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div className="page">
      <h1>View Materials</h1>
      <p className="page-intro">
        Our full library of vocabulary lists and flashcard sets is free for
        logged-in members. Here's a preview of what a list looks like:
      </p>

      {status === "loading" && <p>Loading preview...</p>}
      {status === "error" && (
        <p className="form-message form-error">
          Couldn't load the preview right now. Please try again later.
        </p>
      )}
      {status === "loaded" && !preview && (
        <p>A sample list will be posted here soon.</p>
      )}
      {status === "loaded" && preview && (
        <div className="list-grid">
          <article className="list-card">
            <h3>{preview.originalFilename}</h3>
            <p className="list-meta">Genre: {preview.genre}</p>
            <a
              className="btn btn-secondary"
              href={downloadUrl(preview.id)}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Sample PDF
            </a>
          </article>
        </div>
      )}

      <div className="preview-cta">
        <h2>Log in to see the full library</h2>
        <p>
          Create a free account to access every vocabulary list and
          flashcard set, organized by genre.
        </p>
        <Link to="/login" className="btn btn-primary">
          Log In / Sign Up
        </Link>
      </div>
    </div>
  );
}

function CreateSetForm({ onCreated }: { onCreated: (set: FlashcardSet) => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState<string>(GENRES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const set = await createFlashcardSet(token, { title: title.trim(), genre });
      setTitle("");
      setGenre(GENRES[0]);
      setOpen(false);
      onCreated(set);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        + New Flashcard Set
      </button>
    );
  }

  return (
    <form className="card-form" onSubmit={handleSubmit}>
      <label className="form-field">
        <span>Title</span>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Creating..." : "Create Set"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setOpen(false)}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
      {error && <p className="form-message form-error">{error}</p>}
    </form>
  );
}

function FullLibraryView() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [lists, setLists] = useState<VocabList[]>([]);
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  function loadAll() {
    if (!user) return;
    setStatus("loading");
    user
      .getIdToken()
      .then((token) => Promise.all([fetchLists(token), fetchFlashcardSets(token)]))
      .then(([listData, setData]) => {
        setLists(listData);
        setSets(setData);
        setStatus("loaded");
      })
      .catch((err) => {
        setStatus(err instanceof AuthError ? "unauthorized" : "error");
      });
  }

  useEffect(() => {
    loadAll();
  }, [user]);

  const byGenre = useMemo(() => {
    const map = new Map<string, VocabList[]>();
    for (const list of lists) {
      const key = list.genre || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(list);
    }
    return map;
  }, [lists]);

  const orderedGenres = useMemo(() => {
    const known = GENRES.filter((g) => byGenre.has(g));
    const unknown = [...byGenre.keys()].filter(
      (g) => !(GENRES as readonly string[]).includes(g)
    );
    return [...known, ...unknown];
  }, [byGenre]);

  async function handleDownload(id: string) {
    if (!user) return;
    const token = await user.getIdToken();
    window.open(authenticatedDownloadUrl(id, token), "_blank", "noopener,noreferrer");
  }

  async function handleDeleteList(id: string) {
    if (!user) return;
    if (!confirm("Delete this list?")) return;
    setLists((prev) => prev.filter((l) => l.id !== id));
    try {
      const token = await user.getIdToken();
      await deleteList(token, id);
    } catch (err) {
      if (!(err instanceof ForbiddenError)) loadAll();
    }
  }

  async function handleDeleteSet(id: string) {
    if (!user) return;
    if (!confirm("Delete this flashcard set and all its cards?")) return;
    setSets((prev) => prev.filter((s) => s.id !== id));
    try {
      const token = await user.getIdToken();
      await deleteFlashcardSet(token, id);
    } catch (err) {
      if (!(err instanceof ForbiddenError)) loadAll();
    }
  }

  async function handleTogglePublish(set: FlashcardSet) {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const updated = await setFlashcardSetPublished(token, set.id, !set.published);
      setSets((prev) => prev.map((s) => (s.id === set.id ? updated : s)));
    } catch (err) {
      if (!(err instanceof ForbiddenError)) loadAll();
    }
  }

  return (
    <div className="page">
      <h1>View Materials</h1>
      <p className="page-intro">
        Vocabulary lists and flashcard sets, free to use, organized by genre.
      </p>

      {status === "loading" && <p>Loading materials...</p>}
      {status === "unauthorized" && (
        <p className="form-message form-error">
          Your session expired. <Link to="/login">Log in again</Link>.
        </p>
      )}
      {status === "error" && (
        <p className="form-message form-error">
          Couldn't load materials right now. Please try again later.
        </p>
      )}

      {status === "loaded" && (
        <>
          <section className="genre-section">
            <h2>Vocabulary Lists</h2>
            {lists.length === 0 && <p>No lists are available yet. Check back soon!</p>}
            {orderedGenres.map((genre) => (
              <div key={genre} className="materials-subsection">
                <h3>{genre}</h3>
                <div className="list-grid">
                  {byGenre.get(genre)!.map((list) => (
                    <article key={list.id} className="list-card">
                      <h3>{list.originalFilename}</h3>
                      <p className="list-meta">By {list.creator}</p>
                      <p className="list-meta">
                        Uploaded {formatDate(list.dateUploaded)}
                      </p>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleDownload(list.id)}
                      >
                        Download / Print PDF
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          className="link-button list-card-delete"
                          onClick={() => handleDeleteList(list.id)}
                        >
                          Delete List
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section className="genre-section">
            <h2>Flashcard Sets</h2>
            {isAdmin && (
              <div className="materials-admin-row">
                <CreateSetForm
                  onCreated={(set) => setSets((prev) => [set, ...prev])}
                />
              </div>
            )}
            {sets.length === 0 && <p>No flashcard sets are available yet.</p>}
            <div className="list-grid">
              {sets.map((set) => (
                <article key={set.id} className="list-card">
                  <h3>{set.title}</h3>
                  <p className="list-meta">
                    Genre: {set.genre}
                    {isAdmin && (
                      <>
                        {" · "}
                        <span className={set.published ? "badge-published" : "badge-draft"}>
                          {set.published ? "Published" : "Draft"}
                        </span>
                      </>
                    )}
                  </p>
                  <p className="list-meta">
                    {set.cardCount} {set.cardCount === 1 ? "card" : "cards"}
                  </p>
                  <Link to={`/materials/sets/${set.id}`} className="btn btn-secondary">
                    {set.published ? "Study Set" : "Preview Set"}
                  </Link>
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => handleTogglePublish(set)}
                      >
                        {set.published ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        type="button"
                        className="link-button list-card-delete"
                        onClick={() => handleDeleteSet(set.id)}
                      >
                        Delete Set
                      </button>
                    </>
                  )}
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function ViewMaterials() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page">
        <h1>View Materials</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return user ? <FullLibraryView /> : <PreviewView />;
}
