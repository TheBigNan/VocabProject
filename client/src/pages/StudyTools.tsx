import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  AuthError,
  createFlashcard,
  deleteFlashcard,
  fetchFlashcards,
} from "../api";
import type { Flashcard } from "../types";
import { useAuth } from "../auth/AuthContext";

type Status = "loading" | "loaded" | "error" | "unauthorized";
type CardType = "definition" | "picture";

function FlashcardTile({
  card,
  onDelete,
}: {
  card: Flashcard;
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
      <button
        type="button"
        className="link-button flashcard-delete"
        onClick={() => onDelete(card.id)}
      >
        Delete
      </button>
    </div>
  );
}

export default function StudyTools() {
  const { user, loading: authLoading } = useAuth();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  const [word, setWord] = useState("");
  const [cardType, setCardType] = useState<CardType>("definition");
  const [definition, setDefinition] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  function loadCards() {
    if (!user) return;
    setStatus("loading");
    user
      .getIdToken()
      .then((token) => fetchFlashcards(token))
      .then((data) => {
        setCards(data);
        setStatus("loaded");
      })
      .catch((err) => {
        setStatus(err instanceof AuthError ? "unauthorized" : "error");
      });
  }

  useEffect(() => {
    loadCards();
  }, [user]);

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
    if (cardType === "picture" && !image) {
      setFormError("Please choose a picture.");
      return;
    }

    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      await createFlashcard(token, {
        word: word.trim(),
        cardType,
        definition: cardType === "definition" ? definition.trim() : undefined,
        image: cardType === "picture" ? image ?? undefined : undefined,
      });
      setWord("");
      setDefinition("");
      setImage(null);
      setFileInputKey((k) => k + 1);
      loadCards();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!user) return;
    setCards((prev) => prev.filter((c) => c.id !== id));
    try {
      const token = await user.getIdToken();
      await deleteFlashcard(token, id);
    } catch {
      loadCards();
    }
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
            <span>Picture</span>
            <input
              key={fileInputKey}
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            />
          </label>
        )}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Adding..." : "Add Flashcard"}
        </button>

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
        {status === "loaded" && cards.length > 0 && (
          <div className="flashcard-grid">
            {cards.map((card) => (
              <FlashcardTile key={card.id} card={card} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
