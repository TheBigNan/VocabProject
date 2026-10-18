import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AuthError,
  createFlashcard,
  deleteFlashcard,
  fetchFlashcards,
  updateFlashcard,
} from "../api";
import type { Flashcard } from "../types";
import { useAuth } from "../auth/AuthContext";
import { FlashcardTile } from "../components/FlashcardTile";
import { FlashcardForm, type FlashcardFormValues } from "../components/FlashcardForm";

type Status = "loading" | "loaded" | "error" | "unauthorized";

export default function StudyTools() {
  const { user, loading: authLoading } = useAuth();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<Status>("loading");
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);

  // Refetches the card list. Pass focusId to jump to that card (e.g. one
  // just created or edited); otherwise the current position is kept,
  // clamped to the new length (e.g. after the last card was deleted).
  async function refreshCards(focusId?: string) {
    if (!user) return;
    setStatus("loading");
    try {
      const token = await user.getIdToken();
      const data = await fetchFlashcards(token);
      setCards(data);
      if (focusId) {
        const idx = data.findIndex((c) => c.id === focusId);
        setCurrentIndex(idx >= 0 ? idx : 0);
      } else {
        setCurrentIndex((i) => Math.min(i, Math.max(data.length - 1, 0)));
      }
      setStatus("loaded");
    } catch (err) {
      setStatus(err instanceof AuthError ? "unauthorized" : "error");
    }
  }

  useEffect(() => {
    refreshCards();
  }, [user]);

  async function handleFormSubmit(values: FlashcardFormValues) {
    if (!user) return;
    const token = await user.getIdToken();
    const saved = editingCard
      ? await updateFlashcard(token, editingCard.id, values)
      : await createFlashcard(token, values);
    setEditingCard(null);
    refreshCards(saved.id);
  }

  async function handleDelete(id: string) {
    if (!user) return;
    if (editingCard?.id === id) setEditingCard(null);
    const nextCards = cards.filter((c) => c.id !== id);
    setCards(nextCards);
    setCurrentIndex((i) => Math.min(i, Math.max(nextCards.length - 1, 0)));
    try {
      const token = await user.getIdToken();
      await deleteFlashcard(token, id);
    } catch {
      refreshCards();
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
        <h1>Study Tools</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <h1>Study Tools</h1>
        <p className="page-intro">
          Create your own flashcards to study vocabulary — word on one side,
          a definition or a picture on the other.
        </p>
        <div className="preview-cta">
          <h2>Log in to use Study Tools</h2>
          <p>Your flashcards are private to your account.</p>
          <Link to="/login" className="btn btn-primary">
            Log In / Sign Up
          </Link>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="page">
      <h1>Study Tools</h1>
      <p className="page-intro">
        Create flashcards and click one to flip it. Choose word + definition,
        word + picture, or picture + picture for each card.
      </p>

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

      <section className="flashcard-section">
        {status === "loading" && <p>Loading your flashcards...</p>}
        {status === "unauthorized" && (
          <p className="form-message form-error">
            Your session expired. <Link to="/login">Log in again</Link>.
          </p>
        )}
        {status === "error" && (
          <p className="form-message form-error">
            Couldn't load your flashcards right now. Please try again later.
          </p>
        )}
        {status === "loaded" && cards.length === 0 && (
          <p>No flashcards yet — add your first one above.</p>
        )}
        {status === "loaded" && currentCard && (
          <div className="flashcard-viewer">
            <p className="flashcard-counter">
              Card {currentIndex + 1} of {cards.length}
            </p>
            <FlashcardTile
              key={currentCard.id}
              card={currentCard}
              canManage
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
