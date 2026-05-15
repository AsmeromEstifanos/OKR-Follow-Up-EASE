"use client";

import { useEffect } from "react";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: Props): JSX.Element {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="dashboard-page">
      <section className="section">
        <div className="board-empty-state">
          <h2>Something went wrong</h2>
          <p className="meta">
            The dashboard failed to load, likely due to a connectivity issue with the data store.
            {error.digest ? (
              <> (ref: <code>{error.digest}</code>)</>
            ) : null}
          </p>
          <div className="board-empty-state-actions">
            <button className="btn" type="button" onClick={reset}>
              Try again
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
