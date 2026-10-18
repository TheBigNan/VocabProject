import { useState, type FormEvent } from "react";
import type { CardType } from "../types";

export interface FlashcardFormValues {
  word: string;
  cardType: CardType;
  definition?: string;
  image?: File;
  frontImage?: File;
}

export interface EditingCardInfo {
  id: string;
  word: string;
  cardType: CardType;
  definition?: string;
  hasImage: boolean;
  hasFrontImage: boolean;
}

export function FlashcardForm({
  editing,
  onSubmit,
  onCancel,
}: {
  editing: EditingCardInfo | null;
  onSubmit: (values: FlashcardFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [word, setWord] = useState(editing?.word ?? "");
  const [cardType, setCardType] = useState<CardType>(editing?.cardType ?? "definition");
  const [definition, setDefinition] = useState(editing?.definition ?? "");
  const [image, setImage] = useState<File | null>(null);
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const keepingExistingBackImage =
    (cardType === "picture" || cardType === "picture-picture") &&
    editing !== null &&
    editing.hasImage;
  const keepingExistingFrontImage =
    cardType === "picture-picture" && editing !== null && editing.hasFrontImage;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (cardType !== "picture-picture" && !word.trim()) {
      setError("Please enter a word.");
      return;
    }
    if (cardType === "definition" && !definition.trim()) {
      setError("Please enter a definition.");
      return;
    }
    if (cardType === "picture" && !image && !keepingExistingBackImage) {
      setError("Please choose a picture.");
      return;
    }
    if (cardType === "picture-picture") {
      if (!image && !keepingExistingBackImage) {
        setError("Please choose a back picture.");
        return;
      }
      if (!frontImage && !keepingExistingFrontImage) {
        setError("Please choose a front picture.");
        return;
      }
    }

    setSubmitting(true);
    try {
      await onSubmit({
        word: word.trim(),
        cardType,
        definition: cardType === "definition" ? definition.trim() : undefined,
        image: image ?? undefined,
        frontImage: frontImage ?? undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card-form" onSubmit={handleSubmit}>
      {cardType !== "picture-picture" && (
        <label className="form-field">
          <span>Word</span>
          <input
            type="text"
            required
            value={word}
            onChange={(e) => setWord(e.target.value)}
          />
        </label>
      )}

      <label className="form-field">
        <span>Card type</span>
        <select
          value={cardType}
          onChange={(e) => setCardType(e.target.value as CardType)}
        >
          <option value="definition">Word + Definition</option>
          <option value="picture">Word + Picture</option>
          <option value="picture-picture">Picture + Picture</option>
        </select>
      </label>

      {cardType === "definition" && (
        <label className="form-field">
          <span>Definition</span>
          <input
            type="text"
            value={definition}
            onChange={(e) => setDefinition(e.target.value)}
          />
        </label>
      )}

      {cardType === "picture" && (
        <label className="form-field">
          <span>
            Picture
            {keepingExistingBackImage && " (leave blank to keep the current one)"}
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          />
        </label>
      )}

      {cardType === "picture-picture" && (
        <>
          <label className="form-field">
            <span>
              Front picture
              {keepingExistingFrontImage && " (leave blank to keep the current one)"}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFrontImage(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="form-field">
            <span>
              Back picture
              {keepingExistingBackImage && " (leave blank to keep the current one)"}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            />
          </label>
        </>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting
            ? editing
              ? "Saving..."
              : "Adding..."
            : editing
              ? "Save Changes"
              : "Add Flashcard"}
        </button>
        {editing && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
      </div>

      {error && <p className="form-message form-error">{error}</p>}
    </form>
  );
}
