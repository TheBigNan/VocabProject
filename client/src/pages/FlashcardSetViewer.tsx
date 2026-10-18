import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AuthError,
  ForbiddenError,
  createSetCard,
  deleteSetCard,
  fetchFlashcardSets,
  fetchSetCards,
  setFlashcardSetPublished,
  updateSetCard,
} from "../api";
import type { FlashcardSet, SetFlashcard } from "../types";
import { useAuth } from "../auth/AuthContext";
import { FlashcardTile } from "../components/FlashcardTile";
import { FlashcardForm, type FlashcardFormValues } from "../components/FlashcardForm";

type Status = "loading" | "loaded" | "error" | "unauthorized" | "forbidden";

export default function FlashcardSetViewer() {
  const { setId } = useParams<{ setId: string }>();
  const { user, role, loading: authLoading } = useAuth();
  const isAdmin = role === "admin";

  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [cards, setCards] = useState<SetFlashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [editingCard, setEditingCard] = useState<SetFlashcard | null>(null);
  const [publishing, setPublishing] = useState(false);

  async function refreshCards(focusId?: string) {
    if (!user || !setId) return;
    setStatus("loading");
    try {
      const token = await user.getIdToken();
      const [sets, data] = await Promise.all([
        fetchFlashcardSets(token),
        fetchSetCards(token, setId),
      ]);
      setSet(sets.find((s) => s.id === setId) ?? null);
      setCards(data);
      if (focusId) {
        const idx = data.findIndex((c) => c.id === focusId);
        setCurrentIndex(idx >= 0 ? idx : 0);
      } else {
        setCurrentIndex((i) => Math.min(i, Math.max(data.length - 1, 0)));
      }
      setStatus("loaded");
    } catch (err) {
      if (err instanceof AuthError) setStatus("unauthorized");
      else if (err instanceof ForbiddenError) setStatus("forbidden");
      else setStatus("error");
    }
  }

  useEffect(() => {
    refreshCards();
  }, [user, setId]);

  async function handleFormSubmit(values: FlashcardFormValues) {
    if (!user || !setId) return;
    const token = await user.getIdToken();
    const saved = editingCard
      ? await updateSetCard(token, setId, editingCard.id, values)
      : await createSetCard(token, setId, values);
    setEditingCard(null);
    refreshCards(saved.id);
  }

  async function handleDelete(id: string) {
    if (!user || !setId) return;
    if (editingCard?.id === id) setEditingCard(null);
    const nextCards = cards.filter((c) => c.id !== id);
    setCards(nextCards);
    setCurrentIndex((i) => Math.min(i, Math.max(nextCards.length - 1, 0)));
    try {
      const token = await user.getIdToken();
      await deleteSetCard(token, setId, id);
    } catch {
      refreshCards();
    }
  }

  async function handleTogglePublish() {
    if (!user || !setId || !set) return;
    setPublishing(true);
    try {
      const token = await user.getIdToken();
      const updated = await setFlashcardSetPublished(token, setId, !set.published);
      setSet(updated);
    } catch {
      // leave the UI as-is; the button simply stays in its current state
    } finally {
      setPublishing(false);
    }
  }

  function goPrev() {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }

  function goNext() {
    setCurrentIndex((i) => Math.min(cards.length - 1, i + 1));
  }

  if (authLoading) {
    return (
      <div className="page">
        <h1>Flashcard Set</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <h1>Flashcard Set</h1>
        <p className="page-intro">Log in to study this flashcard set.</p>
        <div className="preview-cta">
          <h2>Log in to continue</h2>
          <Link to="/login" className="btn btn-primary">
            Log In / Sign Up
          </Link>
        </div>
      </div>
    );
  }

  if (status === "forbidden") {
    return (
      <div className="page">
        <p>
          <Link to="/materials">← Back to Materials</Link>
        </p>
        <h1>Flashcard Set</h1>
        <p className="form-message form-error">
          This set isn't available yet. Check back soon!
        </p>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="page">
      <p>
        <Link to="/materials">← Back to Materials</Link>
      </p>
      <h1>{set ? set.title : "Flashcard Set"}</h1>
      {set && (
        <p className="page-intro">
          Genre: {set.genre}
          {isAdmin && (
            <>
              {" · "}
              <span className={set.published ? "badge-published" : "badge-draft"}>
                {set.published ? "Published" : "Draft"}
              </span>
              {" "}
              <button
                type="button"
                className="link-button"
                onClick={handleTogglePublish}
                disabled={publishing}
              >
                {publishing
                  ? "Saving..."
                  : set.published
                    ? "Unpublish"
                    : "Publish"}
              </button>
            </>
          )}
        </p>
      )}

      {isAdmin && (
        <FlashcardForm
          key={editingCard?.id ?? "new"}
          editing={
            editingCard && {
              id: editingCard.id,
              word: editingCard.word,
              cardType: editingCard.cardType,
              definition: editingCard.definition,
              hasImage: Boolean(editingCard.imageUrl),
              hasFrontImage: Boolean(editingCard.frontImageUrl),
            }
          }
          onSubmit={handleFormSubmit}
          onCancel={() => setEditingCard(null)}
        />
      )}

      <section className="flashcard-section">
        {status === "loading" && <p>Loading flashcards...</p>}
        {status === "unauthorized" && (
          <p className="form-message form-error">
            Your session expired. <Link to="/login">Log in again</Link>.
          </p>
        )}
        {status === "error" && (
          <p className="form-message form-error">
            Couldn't load this flashcard set right now. Please try again later.
          </p>
        )}
        {status === "loaded" && cards.length === 0 && (
          <p>
            {isAdmin
              ? "No flashcards yet — add the first one above."
              : "This set doesn't have any flashcards yet. Check back soon!"}
          </p>
        )}
        {status === "loaded" && currentCard && (
          <div className="flashcard-viewer">
            <p className="flashcard-counter">
              Card {currentIndex + 1} of {cards.length}
            </p>
            <FlashcardTile
              key={currentCard.id}
              card={currentCard}
              canManage={isAdmin}
              onEdit={setEditingCard}
              onDelete={handleDelete}
            />
            <div className="flashcard-nav">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={goPrev}
                disabled={currentIndex === 0}
              >
                ← Previous
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={goNext}
                disabled={currentIndex === cards.length - 1}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
