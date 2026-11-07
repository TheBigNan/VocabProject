import { useEffect, useMemo, useState } from "react";
import type { Flashcard } from "../types";
import { useAuth } from "../auth/AuthContext";
import { submitQuizScore } from "../api";

const POINTS_PER_CORRECT = 100;
const DEFAULT_MINUTES = 2;
const MIN_MINUTES = 1;
const MAX_MINUTES = 10;
const MAX_OPTIONS = 4;

interface QuizQuestion {
  id: string;
  promptLabel: string;
  promptType: "text" | "image";
  prompt: string;
  answerType: "text" | "image";
  correctAnswer: string;
  options: string[];
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function uniqueValues(cards: Flashcard[], pick: (c: Flashcard) => string | undefined): string[] {
  return Array.from(new Set(cards.map(pick).filter((v): v is string => Boolean(v))));
}

function buildQuestionPool(cards: Flashcard[]): QuizQuestion[] {
  const definitionCards = cards.filter(
    (c) => c.cardType === "definition" && c.word?.trim() && c.definition?.trim()
  );
  const pictureCards = cards.filter(
    (c) => c.cardType === "picture" && c.word?.trim() && c.imageUrl
  );

  const questions: QuizQuestion[] = [];

  if (definitionCards.length >= 2) {
    for (const card of definitionCards) {
      const otherDefinitions = uniqueValues(
        definitionCards.filter((c) => c.id !== card.id && c.definition !== card.definition),
        (c) => c.definition
      );
      if (otherDefinitions.length >= 1) {
        const distractors = shuffle(otherDefinitions).slice(0, MAX_OPTIONS - 1);
        questions.push({
          id: `${card.id}-word-to-def`,
          promptLabel: "What does this word mean?",
          promptType: "text",
          prompt: card.word,
          answerType: "text",
          correctAnswer: card.definition!,
          options: shuffle([card.definition!, ...distractors]),
        });
      }

      const otherWords = uniqueValues(
        definitionCards.filter((c) => c.id !== card.id && c.word !== card.word),
        (c) => c.word
      );
      if (otherWords.length >= 1) {
        const distractors = shuffle(otherWords).slice(0, MAX_OPTIONS - 1);
        questions.push({
          id: `${card.id}-def-to-word`,
          promptLabel: "Which word matches this definition?",
          promptType: "text",
          prompt: card.definition!,
          answerType: "text",
          correctAnswer: card.word,
          options: shuffle([card.word, ...distractors]),
        });
      }
    }
  }

  if (pictureCards.length >= 2) {
    for (const card of pictureCards) {
      const otherWords = uniqueValues(
        pictureCards.filter((c) => c.id !== card.id && c.word !== card.word),
        (c) => c.word
      );
      if (otherWords.length >= 1) {
        const distractors = shuffle(otherWords).slice(0, MAX_OPTIONS - 1);
        questions.push({
          id: `${card.id}-pic-to-word`,
          promptLabel: "What word matches this picture?",
          promptType: "image",
          prompt: card.imageUrl!,
          answerType: "text",
          correctAnswer: card.word,
          options: shuffle([card.word, ...distractors]),
        });
      }

      const otherImages = uniqueValues(
        pictureCards.filter((c) => c.id !== card.id && c.imageUrl !== card.imageUrl),
        (c) => c.imageUrl
      );
      if (otherImages.length >= 1) {
        const distractors = shuffle(otherImages).slice(0, MAX_OPTIONS - 1);
        questions.push({
          id: `${card.id}-word-to-pic`,
          promptLabel: "Which picture matches this word?",
          promptType: "text",
          prompt: card.word,
          answerType: "image",
          correctAnswer: card.imageUrl!,
          options: shuffle([card.imageUrl!, ...distractors]),
        });
      }
    }
  }

  return questions;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Status = "setup" | "playing" | "finished";

export function QuizGame({ cards }: { cards: Flashcard[] }) {
  const { user, quizHighScore, setQuizHighScore } = useAuth();

  const questionBank = useMemo(() => buildQuestionPool(cards), [cards]);

  const [status, setStatus] = useState<Status>("setup");
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [pool, setPool] = useState<QuizQuestion[]>([]);
  const [poolIndex, setPoolIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  const currentQuestion = pool[poolIndex] ?? null;

  useEffect(() => {
    if (status !== "playing") return;
    if (timeLeft <= 0) {
      finishQuiz();
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, timeLeft]);

  function startQuiz() {
    if (questionBank.length === 0) return;
    setPool(shuffle(questionBank));
    setPoolIndex(0);
    setScore(0);
    setSelected(null);
    setIsNewHighScore(false);
    setTimeLeft(minutes * 60);
    setStatus("playing");
  }

  function handleAnswer(option: string) {
    if (!currentQuestion || selected) return;
    setSelected(option);
    const correct = option === currentQuestion.correctAnswer;
    if (correct) setScore((s) => s + POINTS_PER_CORRECT);
    setTimeout(advanceQuestion, 550);
  }

  function advanceQuestion() {
    setSelected(null);
    if (poolIndex + 1 < pool.length) {
      setPoolIndex(poolIndex + 1);
    } else {
      // Ran through the whole deck with time still on the clock — reshuffle
      // and keep going rather than stopping early.
      setPool(shuffle(questionBank));
      setPoolIndex(0);
    }
  }

  async function finishQuiz(finalScore = score) {
    setStatus("finished");
    if (finalScore <= quizHighScore || !user) return;
    setIsNewHighScore(true);
    try {
      const token = await user.getIdToken();
      const result = await submitQuizScore(token, finalScore);
      setQuizHighScore(result.quizHighScore);
    } catch {
      // Non-critical — the run's score is still shown even if saving fails.
    }
  }

  if (status === "setup") {
    return (
      <div className="quiz-setup">
        <p className="page-intro">
          A timed multiple-choice quiz built from your own flashcards — word
          to definition, definition to word, picture to word, and word to
          picture. Each correct answer is worth {POINTS_PER_CORRECT} points.
        </p>
        <p className="quiz-high-score">
          Your best score: <strong>{quizHighScore}</strong>
        </p>
        {questionBank.length === 0 ? (
          <p className="form-message form-error">
            Add at least 2 flashcards of the same type — word + definition,
            or word + picture — in the Flashcards tab to play.
          </p>
        ) : (
          <>
            <label className="form-field">
              <span>Time limit (minutes)</span>
              <input
                type="number"
                min={MIN_MINUTES}
                max={MAX_MINUTES}
                value={minutes}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) {
                    setMinutes(Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(n))));
                  }
                }}
              />
            </label>
            <button type="button" className="btn btn-primary" onClick={startQuiz}>
              Start Quiz
            </button>
          </>
        )}
      </div>
    );
  }

  if (status === "playing" && currentQuestion) {
    return (
      <div className="quiz-play">
        <div className="quiz-hud">
          <span className="quiz-timer">⏱ {formatTime(timeLeft)}</span>
          <span className="quiz-score">Score: {score}</span>
        </div>
        <p className="quiz-prompt-label">{currentQuestion.promptLabel}</p>
        {currentQuestion.promptType === "text" ? (
          <p className="quiz-prompt-text">{currentQuestion.prompt}</p>
        ) : (
          <img className="quiz-prompt-image" src={currentQuestion.prompt} alt="" />
        )}
        <div className="quiz-options">
          {currentQuestion.options.map((option) => {
            let className = "quiz-option";
            if (selected) {
              if (option === currentQuestion.correctAnswer) className += " quiz-option-correct";
              else if (option === selected) className += " quiz-option-wrong";
            }
            return (
              <button
                key={option}
                type="button"
                className={className}
                disabled={Boolean(selected)}
                onClick={() => handleAnswer(option)}
              >
                {currentQuestion.answerType === "image" ? (
                  <img src={option} alt="" />
                ) : (
                  <span>{option}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-results">
      <h2>Time's up!</h2>
      <p className="quiz-final-score">You scored {score} points.</p>
      {isNewHighScore ? (
        <p className="quiz-new-high">New personal best!</p>
      ) : (
        <p className="quiz-high-score">Your best score: {quizHighScore} points.</p>
      )}
      <button type="button" className="btn btn-primary" onClick={() => setStatus("setup")}>
        Play Again
      </button>
    </div>
  );
}
