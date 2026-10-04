import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AuthError,
  authenticatedDownloadUrl,
  downloadUrl,
  fetchLists,
  fetchPreview,
} from "../api";
import type { VocabList } from "../types";
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
      <h1>Vocabulary Lists</h1>
      <p className="page-intro">
        Our full library is free for logged-in members. Here's a preview of
        what a list looks like:
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
          Create a free account to access every vocabulary list, organized by
          genre.
        </p>
        <Link to="/login" className="btn btn-primary">
          Log In / Sign Up
        </Link>
      </div>
    </div>
  );
}

function FullLibraryView() {
  const { user } = useAuth();
  const [lists, setLists] = useState<VocabList[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!user) return;
    setStatus("loading");
    user
      .getIdToken()
      .then((token) => fetchLists(token))
      .then((data) => {
        setLists(data);
        setStatus("loaded");
      })
      .catch((err) => {
        setStatus(err instanceof AuthError ? "unauthorized" : "error");
      });
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

  return (
    <div className="page">
      <h1>Vocabulary Lists</h1>
      <p className="page-intro">
        All lists are free to view, download, and print, organized by genre.
      </p>

      {status === "loading" && <p>Loading lists...</p>}
      {status === "unauthorized" && (
        <p className="form-message form-error">
          Your session expired. <Link to="/login">Log in again</Link>.
        </p>
      )}
      {status === "error" && (
        <p className="form-message form-error">
          Couldn't load lists right now. Please try again later.
        </p>
      )}
      {status === "loaded" && lists.length === 0 && (
        <p>No lists are available yet. Check back soon!</p>
      )}

      {orderedGenres.map((genre) => (
        <section key={genre} className="genre-section">
          <h2>{genre}</h2>
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
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function ViewLists() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page">
        <h1>Vocabulary Lists</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return user ? <FullLibraryView /> : <PreviewView />;
}
