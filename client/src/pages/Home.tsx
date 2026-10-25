import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="page">
      <section className="hero">
        <h1>Learn vocabulary from the books you already love.</h1>
        <p className="hero-subtitle">
          WordWise's mission is to help people learn vocabulary from lists
          built around popular books — each word paired with a detailed
          picture and an example sentence, so it actually sticks. All the
          materials are free and you can learn the words in two modes:
          flashcard mode or PDF mode.
        </p>
        <div className="hero-actions">
          <Link to="/materials" className="btn btn-primary">
            Start Learning Here!
          </Link>
        </div>
      </section>

      <section className="feature-grid">
        <div className="feature-card">
          <h3>Pictures that stick</h3>
          <p>
            Every word comes with a detailed image, so the meaning is
            memorable, not just memorized.
          </p>
        </div>
        <div className="feature-card">
          <h3>Real example sentences</h3>
          <p>
            See each word used the way it actually appears in the story, so
            you understand it in context.
          </p>
        </div>
        <div className="feature-card">
          <h3>Varied Learning Formats</h3>
          <p>
            Each word can be viewed as a flashcard, where the front side
            shows the word and the backside shows the definition,
            illustration, and example sentences. Words can also be viewed
            directly on the PDFs which can be downloaded and printed out.
          </p>
        </div>
      </section>
    </div>
  );
}
