import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthError, ForbiddenError, fetchStats } from "../api";
import type { StatsSummary } from "../types";
import { useAuth } from "../auth/AuthContext";

type Status = "loading" | "loaded" | "error" | "unauthorized" | "forbidden";

export default function Stats() {
  const { user, role, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!user || role !== "admin") return;
    setStatus("loading");
    user
      .getIdToken()
      .then((token) => fetchStats(token))
      .then((data) => {
        setStats(data);
        setStatus("loaded");
      })
      .catch((err) => {
        if (err instanceof AuthError) setStatus("unauthorized");
        else if (err instanceof ForbiddenError) setStatus("forbidden");
        else setStatus("error");
      });
  }, [user, role]);

  if (authLoading) {
    return (
      <div className="page">
        <h1>Statistics</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <h1>Statistics</h1>
        <p className="page-intro">This page is for site admins only.</p>
        <div className="preview-cta">
          <h2>Log in to continue</h2>
          <Link to="/login" className="btn btn-primary">
            Log In
          </Link>
        </div>
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div className="page">
        <h1>Statistics</h1>
        <p className="form-message form-error">
          You don't have access to this page.
        </p>
      </div>
    );
  }

  return (
    <div className="page page-narrow">
      <h1>Statistics</h1>
      <p className="page-intro">A look at how WordWise is being used.</p>

      {status === "loading" && <p>Loading statistics...</p>}
      {status === "unauthorized" && (
        <p className="form-message form-error">
          Your session expired. <Link to="/login">Log in again</Link>.
        </p>
      )}
      {status === "forbidden" && (
        <p className="form-message form-error">
          You don't have access to this page.
        </p>
      )}
      {status === "error" && (
        <p className="form-message form-error">
          Couldn't load statistics right now. Please try again later.
        </p>
      )}

      {status === "loaded" && stats && (
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
      )}
    </div>
  );
}
