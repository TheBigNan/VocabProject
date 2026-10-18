import { useState } from "react";
import type { CardType } from "../types";

export interface CardLike {
  id: string;
  word: string;
  cardType: CardType;
  definition?: string;
  imageUrl?: string;
  frontImageUrl?: string;
}

export function FlashcardTile<T extends CardLike>({
  card,
  canManage,
  onEdit,
  onDelete,
}: {
  card: T;
  canManage: boolean;
  onEdit: (card: T) => void;
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
          {card.cardType === "picture-picture" ? (
            <img src={card.frontImageUrl} alt="" />
          ) : (
            <span>{card.word}</span>
          )}
        </div>
        <div className="flashcard-face flashcard-back">
          {card.cardType === "definition" ? (
            <span>{card.definition}</span>
          ) : (
            <img src={card.imageUrl} alt={card.word || ""} />
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
