"use client";

import useCurrentUserEmail from "@/app/use-current-user-email";
import { apiPath } from "@/lib/base-path";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Item = {
  key: string;
  label: string;
  weight: number;
};

type Props = {
  title: string;
  actionLabel: string;
  requestPath: string;
  items: Item[];
  canEdit?: boolean;
  adminEmails?: string[];
  ownerEmail?: string;
  emptyMessage: string;
};

type ApiError = {
  error?: string;
};

const WEIGHT_TOLERANCE = 0.0001;

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export default function WeightGroupControls({
  title,
  actionLabel,
  requestPath,
  items,
  canEdit,
  adminEmails = [],
  ownerEmail,
  emptyMessage
}: Props): JSX.Element | null {
  const router = useRouter();
  const currentUserEmail = useCurrentUserEmail();
  const normalizedCurrentUser = currentUserEmail.trim().toLowerCase();
  const resolvedCanEdit =
    canEdit ??
    (
      Boolean(normalizedCurrentUser) &&
      (
        adminEmails.map((entry) => entry.trim().toLowerCase()).includes(normalizedCurrentUser) ||
        (ownerEmail ?? "").trim().toLowerCase() === normalizedCurrentUser
      )
    );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setDrafts(
      Object.fromEntries(items.map((item) => [item.key, String(item.weight)]))
    );
  }, [items]);

  const totalWeight = useMemo(() => {
    const total = items.reduce((sum, item) => {
      const value = Number(drafts[item.key] ?? item.weight);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
    return Math.round(total * 1000000) / 1000000;
  }, [drafts, items]);

  if (items.length === 0) {
    return <p className="meta">{emptyMessage}</p>;
  }

  const resetDrafts = (): void => {
    setDrafts(
      Object.fromEntries(items.map((item) => [item.key, String(item.weight)]))
    );
    setError("");
  };

  const handleSave = async (): Promise<void> => {
    if (isSaving) return;

    const weights = items.map((item) => {
      const parsed = Number(drafts[item.key] ?? item.weight);
      if (!Number.isFinite(parsed)) {
        throw new Error(`${item.label} weight must be numeric.`);
      }

      if (parsed < 0 || parsed > 1) {
        throw new Error(`${item.label} weight must be between 0 and 1.`);
      }

      return { key: item.key, weight: parsed };
    });

    const total = weights.reduce((sum, item) => sum + item.weight, 0);
    if (Math.abs(total - 1) > WEIGHT_TOLERANCE) {
      setError(`Weights must add up to 1. Current total is ${Math.round(total * 1000000) / 1000000}.`);
      return;
    }

    setIsSaving(true);
    setError("");

    const response = await fetch(apiPath(requestPath), {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-user-email": currentUserEmail
      },
      body: JSON.stringify({ weights })
    });

    if (!response.ok) {
      const payload = await readJson<ApiError>(response);
      setError(payload?.error ?? `Failed to update ${title.toLowerCase()}.`);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    setIsEditing(false);
    router.refresh();
  };

  return (
    <div className="ease-weight-group-anchor">
      {isEditing ? (
        <div className="ease-weight-group-controls">
          <div className="ease-weight-group-header">
            <div>
              <h5>{title}</h5>
              <p className="meta">Total: {totalWeight}</p>
            </div>
            <div className="ease-weight-group-actions">
              <button className="btn" type="button" onClick={() => void handleSave()} disabled={isSaving}>
                Save
              </button>
              <button
                className="tab-btn"
                type="button"
                onClick={() => {
                  resetDrafts();
                  setIsEditing(false);
                }}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        <div className="ease-weight-group-list">
          {items.map((item) => (
            <label key={item.key} className="ease-weight-group-row">
              <span>{item.label}</span>
              <input
                className="objective-row-input"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={drafts[item.key] ?? String(item.weight)}
                onChange={(event) => setDrafts((current) => ({ ...current, [item.key]: event.target.value }))}
                disabled={isSaving}
              />
            </label>
          ))}
        </div>
        </div>
      ) : resolvedCanEdit ? (
        <button
          className="ease-weight-group-trigger"
          type="button"
          onClick={() => {
            resetDrafts();
            setIsEditing(true);
          }}
          disabled={isSaving}
        >
          {actionLabel}
        </button>
      ) : null}
      {error ? <p className="message danger">{error}</p> : null}
    </div>
  );
}
