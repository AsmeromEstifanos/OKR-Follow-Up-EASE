"use client";

import OwnerInput from "@/app/owner-input";
import useCurrentUserEmail from "@/app/use-current-user-email";
import { apiPath } from "@/lib/base-path";
import type { ChangeAlertSettings, ChangeAlertTrigger } from "@/lib/notification-settings";
import { useEffect, useState } from "react";

const TRIGGER_OPTIONS: { value: ChangeAlertTrigger; label: string }[] = [
  { value: "all", label: "All updates — every field change on any objective, KR, or KPI" },
  { value: "status_progress", label: "Status & progress only — status, progress %, RAG, current value" },
  { value: "new_only", label: "New items only — when a new objective, KR, or KPI is created" }
];

type ApiError = { error?: string };

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

export default function ChangeAlertsSection(): JSX.Element {
  const signedInEmail = useCurrentUserEmail();
  const [enabled, setEnabled] = useState(false);
  const [trigger, setTrigger] = useState<ChangeAlertTrigger>("all");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [ownerDraft, setOwnerDraft] = useState("");
  const [ownerEmailDraft, setOwnerEmailDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(apiPath("/api/notifications/settings"), { cache: "no-store" });
        if (!res.ok) return;
        const data = await readJson<{ changeAlerts?: ChangeAlertSettings }>(res);
        if (data?.changeAlerts) {
          setEnabled(data.changeAlerts.enabled);
          setTrigger(data.changeAlerts.trigger ?? "all");
          setRecipients(data.changeAlerts.recipients ?? []);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const save = async (): Promise<void> => {
    if (isSaving) return;
    setIsSaving(true);
    setMessage("");
    setError("");
    const res = await fetch(apiPath("/api/notifications/settings"), {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-user-email": signedInEmail },
      body: JSON.stringify({ changeAlerts: { enabled, trigger, recipients } })
    });
    setIsSaving(false);
    if (!res.ok) {
      const p = await readJson<ApiError>(res);
      setError(p?.error ?? "Failed to save.");
      return;
    }
    setMessage("Saved.");
    setTimeout(() => setMessage(""), 3000);
  };

  const addRecipient = (): void => {
    const email = (ownerEmailDraft.trim() || ownerDraft.trim()).toLowerCase();
    if (!email || !email.includes("@")) { setError("Select a person or enter a valid email address."); return; }
    if (recipients.includes(email)) { setError("Already in the list."); return; }
    setRecipients((prev) => [...prev, email]);
    setOwnerDraft("");
    setOwnerEmailDraft("");
    setError("");
  };

  const removeRecipient = (email: string): void => {
    setRecipients((prev) => prev.filter((r) => r !== email));
  };

  if (isLoading) return <p className="meta">Loading…</p>;

  return (
    <div className="config-subsection">
      <h3 className="config-subsection-heading">Change Alert Emails</h3>
      <p className="meta" style={{ marginBottom: "1rem" }}>
        Send an email to the recipients below whenever an objective, KR, or KPI is changed.
        Requires <code>NOTIFICATION_FROM_EMAIL</code> to be configured.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <input
          id="change-alert-enabled"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          style={{ width: "16px", height: "16px", cursor: "pointer", flexShrink: 0 }}
        />
        <label htmlFor="change-alert-enabled" style={{ cursor: "pointer", margin: 0, userSelect: "none" }}>
          Enable change alert emails
        </label>
      </div>

      <div className="field" style={{ marginBottom: "1.25rem" }}>
        <label htmlFor="change-alert-trigger">Trigger</label>
        <select
          id="change-alert-trigger"
          className="objective-row-select"
          value={trigger}
          onChange={(e) => setTrigger(e.target.value as ChangeAlertTrigger)}
          disabled={!enabled}
          style={{ maxWidth: "480px" }}
        >
          {TRIGGER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="field" style={{ marginBottom: "1rem" }}>
        <label>Recipients</label>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "0.5rem" }}>
          <div style={{ flex: "1 1 260px", minWidth: "200px" }}>
            <OwnerInput
              id="change-alert-recipient"
              label=""
              value={ownerDraft}
              onChange={setOwnerDraft}
              onSelectUser={(user) => {
                if (user) {
                  setOwnerDraft(user.displayName);
                  setOwnerEmailDraft(user.mail || user.principalName);
                }
              }}
              disabled={!enabled}
              placeholder="Search or enter email"
            />
          </div>
          <button type="button" className="btn" onClick={addRecipient} disabled={!enabled} style={{ flexShrink: 0 }}>
            Add
          </button>
        </div>
        {recipients.length === 0 ? (
          <p className="meta">No recipients configured.</p>
        ) : (
          <ul className="config-option-list">
            {recipients.map((email) => (
              <li key={email} className="config-option-row">
                <span>{email}</span>
                <button
                  type="button"
                  className="config-remove-btn"
                  onClick={() => removeRecipient(email)}
                  aria-label={`Remove ${email}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginTop: "1rem" }}>
        <button type="button" className="btn" onClick={() => void save()} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save Change Alerts"}
        </button>
        {message && <span style={{ color: "#22c55e", fontSize: "0.875rem" }}>{message}</span>}
        {error && <span style={{ color: "#ef4444", fontSize: "0.875rem" }}>{error}</span>}
      </div>
    </div>
  );
}
