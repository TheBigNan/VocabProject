import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AuthError,
  createSetCard,
  deleteSetCard,
  fetchFlashcardSets,
  fetchSetCards,
  updateSetCard,
} from "../api";
import type { FlashcardSet, SetFlashcard } from "../types";
import { useAuth } from "../auth/AuthContext";

type Status = "loading" | "loaded" | "error" | "unauthorized";
type CardType = "definition" | "picture";

function FlashcardTile({
  card,
  canManage,
  onEdit,
  onDelete,
}: {
  card: SetFlashcard;
  canManage: boolean;
  onEdit: (card: SetFlashcard) => void;
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
      {canManage && (
        <div className="flashcard-actions">
          <button type="button" className="link-button" onClick={() => onEdit(card)}>
            Edit
          </button>
          <button type="button" className="link-button" onClick={() => onDelete(card.id)}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function FlashcardSetViewer() {
  const { setId } = useParams<{ setId: string }>();
  const { user, role, loading: authLoading } = useAuth();
  const isAdmin = role === "admin";

  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [cards, setCards] = useState<SetFlashcard[]>([]);
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
      setStatus(err instanceof AuthError ? "unauthorized" : "error");
    }
  }

  useEffect(() => {
    refreshCards();
  }, [user, setId]);

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

  function startEdit(card: SetFlashcard) {
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
    if (!user || !setId) return;
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
        ? await updateSetCard(token, setId, editingId, input)
        : await createSetCard(token, setId, input);
      resetForm();
      refreshCards(saved.id);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!user || !setId) return;
    if (editingId === id) resetForm();
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

  const currentCard = cards[currentIndex];

  return (
    <div className="page">
      <p>
        <Link to="/materials">← Back to Materials</Link>
      </p>
      <h1>{set ? set.title : "Flashcard Set"}</h1>
      {set && <p className="page-intro">Genre: {set.genre}</p>}

      {isAdmin && (
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
