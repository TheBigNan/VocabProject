import { useEffect, useState, type FormEvent } from "react";
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

type Status = "loading" | "loaded" | "error" | "unauthorized";
type CardType = "definition" | "picture";

function FlashcardTile({
  card,
  onEdit,
  onDelete,
}: {
  card: Flashcard;
  onEdit: (card: Flashcard) => void;
  onDelete: (id: string) => void;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="flashcard-tile">
      <div
        className={"flashcard" + (flipped ? " flashcard-flipped" : "")}
        onClick={() => setFlipped((f) => !f)}
      >
        <div className="flashcard-face flashcard-front">
          <span>{card.word}</span>
        </div>
        <div className="flashcard-face flashcard-back">
          {card.cardType === "definition" ? (
            <span>{card.definition}</span>
          ) : (
            <img src={card.imageUrl} alt={card.word} />
          )}
        </div>
      </div>
      <div className="flashcard-actions">
        <button
          type="button"
          className="link-button"
          onClick={() => onEdit(card)}
        >
          Edit
        </button>
        <button
          type="button"
          className="link-button"
          onClick={() => onDelete(card.id)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function StudyTools() {
  const { user, loading: authLoading } = useAuth();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<Status>("loading");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingOriginalType, setEditingOriginalType] = useState<CardType | null>(null);
  const [word, setWord] = useState("");
  const [cardType, setCardType] = useState<CardType>("definition");
  const [definition, setDefinition] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

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

  function resetForm() {
    setEditingId(null);
    setEditingOriginalType(null);
    setWord("");
    setCardType("definition");
    setDefinition("");
    setImage(null);
    setFileInputKey((k) => k + 1);
    setFormError("");
  }

  function startEdit(card: Flashcard) {
    setEditingId(card.id);
    setEditingOriginalType(card.cardType);
    setWord(card.word);
    setCardType(card.cardType);
    setDefinition(card.definition ?? "");
    setImage(null);
    setFileInputKey((k) => k + 1);
    setFormError("");
  }

  const keepingExistingPicture =
    cardType === "picture" && editingId !== null && editingOriginalType === "picture";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setFormError("");

    if (!word.trim()) {
      setFormError("Please enter a word.");
      return;
    }
    if (cardType === "definition" && !definition.trim()) {
      setFormError("Please enter a definition.");
      return;
    }
    if (cardType === "picture" && !image && !keepingExistingPicture) {
      setFormError("Please choose a picture.");
      return;
    }

    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const input = {
        word: word.trim(),
        cardType,
        definition: cardType === "definition" ? definition.trim() : undefined,
        image: cardType === "picture" ? image ?? undefined : undefined,
      };
      const saved = editingId
        ? await updateFlashcard(token, editingId, input)
        : await createFlashcard(token, input);
      resetForm();
      refreshCards(saved.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!user) return;
    if (editingId === id) resetForm();
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
        Create flashcards and click one to flip it. Choose a definition card
        or a picture card for each word.
      </p>

      <form className="card-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Word</span>
          <input
            type="text"
            required
            value={word}
            onChange={(e) => setWord(e.target.value)}
          />
        </label>

        <label className="form-field">
          <span>Card type</span>
          <select
            value={cardType}
            onChange={(e) => setCardType(e.target.value as CardType)}
          >
            <option value="definition">Word + Definition</option>
            <option value="picture">Word + Picture</option>
          </select>
        </label>

        {cardType === "definition" ? (
          <label className="form-field">
            <span>Definition</span>
            <input
              type="text"
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
            />
          </label>
        ) : (
          <label className="form-field">
            <span>
              Picture
              {keepingExistingPicture && " (leave blank to keep the current one)"}
            </span>
            <input
              key={fileInputKey}
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            />
          </label>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting
              ? editingId
                ? "Saving..."
                : "Adding..."
              : editingId
                ? "Save Changes"
                : "Add Flashcard"}
          </button>
          {editingId && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={resetForm}
              disabled={submitting}
            >
              Cancel
            </button>
          )}
        </div>

        {formError && <p className="form-message form-error">{formError}</p>}
      </form>

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
              onEdit={startEdit}
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
