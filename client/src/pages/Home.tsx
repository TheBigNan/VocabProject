import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStats } from "../api";
import type { StatsSummary } from "../types";

export default function Home() {
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    fetchStats()
      .then((data) => {
        setStats(data);
        setStatus("loaded");
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div className="page">
      <section className="hero">
        <h1>Learn vocabulary from the books you already love.</h1>
        <p className="hero-subtitle">
          WordWise's mission is to help people learn vocabulary from lists
          built around popular books — each word paired with a detailed
          picture and an example sentence, so it actually sticks. Every list
          is completely free to use, download, and print.
        </p>
        <div className="hero-actions">
          <Link to="/lists" className="btn btn-primary">
            Browse Vocabulary Lists
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
          <h3>Free and printable</h3>
          <p>
            Every list is openly accessible as a PDF — download it, print it,
            and study anywhere.
          </p>
        </div>
      </section>

      {status === "loaded" && stats && (
        <section className="stats-section">
          <h2>WordWise in numbers</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-number">{stats.visits.toLocaleString()}</span>
              <span className="stat-label">Website Visits</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">
                {stats.downloads.toLocaleString()}
              </span>
              <span className="stat-label">Lists Downloaded</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
