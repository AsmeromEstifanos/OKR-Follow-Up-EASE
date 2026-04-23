"use client";

import OwnerInput from "@/app/owner-input";
import useCurrentUserEmail from "@/app/use-current-user-email";
import { apiPath } from "@/lib/base-path";
import { formatOwnerEmailLabel, resolveOwnerEmail, resolveOwnerName } from "@/lib/owner";
import type { CheckInFrequency, KeyResult, KrStatus, MetricType } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ObjectiveOption = {
  objectiveKey: string;
  objectiveCode: string;
  title: string;
};

type KeyResultEditControlsProps = {
  keyResult: KeyResult;
  objectiveOptions: ObjectiveOption[];
  metricTypeOptions: MetricType[];
  keyResultStatusOptions: KrStatus[];
  checkInFrequencyOptions: CheckInFrequency[];
};

type KeyResultDraft = {
  krCode: string;
  objectiveKey: string;
  title: string;
  owner: string;
  ownerEmail: string;
  metricType: MetricType;
  baselineValue: string;
  status: KrStatus;
  dueDate: string;
  checkInFrequency: CheckInFrequency;
  blockers: string;
  notes: string;
};

type ApiError = {
  error?: string;
};

function toDateInput(value: string | null): string {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function normalizeWeightValue(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return String(value);
}

function toDraft(keyResult: KeyResult): KeyResultDraft {
  return {
    krCode: keyResult.krCode ?? keyResult.krKey,
    objectiveKey: keyResult.objectiveKey,
    title: keyResult.title,
    owner: resolveOwnerName(keyResult.owner, keyResult.ownerEmail),
    ownerEmail: resolveOwnerEmail(keyResult.owner, keyResult.ownerEmail),
    metricType: keyResult.metricType,
    baselineValue: normalizeWeightValue(keyResult.baselineValue),
    status: keyResult.status,
    dueDate: toDateInput(keyResult.dueDate),
    checkInFrequency: keyResult.checkInFrequency,
    blockers: keyResult.blockers ?? "",
    notes: keyResult.notes
  };
}

export default function KeyResultEditControls({
  keyResult,
  objectiveOptions,
  metricTypeOptions,
  keyResultStatusOptions,
  checkInFrequencyOptions
}: KeyResultEditControlsProps): JSX.Element {
  const router = useRouter();
  const currentUserEmail = useCurrentUserEmail();
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [draft, setDraft] = useState<KeyResultDraft>(() => toDraft(keyResult));
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setDraft(toDraft(keyResult));
  }, [keyResult]);

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    setMessage("");
    setError("");

    const baselineValue = Number(draft.baselineValue);
    if (!Number.isFinite(baselineValue)) {
      setError("Weight must be a valid number.");
      setIsSaving(false);
      return;
    }

    if (baselineValue < 0 || baselineValue > 1) {
      setError("Weight must be between 0 and 1.");
      setIsSaving(false);
      return;
    }

    const response = await fetch(apiPath(`/api/krs/${encodeURIComponent(keyResult.krKey)}`), {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-user-email": currentUserEmail
      },
      body: JSON.stringify({
        krCode: draft.krCode.trim(),
        objectiveKey: draft.objectiveKey.trim(),
        title: draft.title.trim(),
        owner: draft.owner.trim(),
        ownerEmail: draft.ownerEmail.trim(),
        metricType: draft.metricType,
        baselineValue,
        status: draft.status,
        dueDate: draft.dueDate,
        checkInFrequency: draft.checkInFrequency,
        blockers: draft.blockers.trim(),
        notes: draft.notes.trim()
      })
    });

    if (!response.ok) {
      const payload = (await response.json()) as ApiError;
      setError(payload.error ?? "Failed to update key result.");
      setIsSaving(false);
      return;
    }

    setMessage("Key result updated.");
    setIsSaving(false);
    router.refresh();
  };

  const handleReset = (): void => {
    setDraft(toDraft(keyResult));
    setMessage("");
    setError("");
  };

  return (
    <details className="kr-edit-card">
      <summary className="kr-edit-summary">
        {keyResult.title} ({keyResult.krKey})
      </summary>

      <div className="kr-edit-content">
        <div className="config-grid">
          <div className="field">
            <label htmlFor={`kr-code-${keyResult.krKey}`}>KR Code</label>
            <input
              id={`kr-code-${keyResult.krKey}`}
              value={draft.krCode}
              onChange={(event) => setDraft((current) => ({ ...current, krCode: event.target.value }))}
            />
          </div>

          <div className="field">
            <label htmlFor={`kr-objective-${keyResult.krKey}`}>Objective</label>
            <select
              id={`kr-objective-${keyResult.krKey}`}
              value={draft.objectiveKey}
              onChange={(event) => setDraft((current) => ({ ...current, objectiveKey: event.target.value }))}
            >
              {objectiveOptions.map((option) => (
                <option key={option.objectiveKey} value={option.objectiveKey}>
                  {option.title} ({option.objectiveCode})
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor={`kr-title-${keyResult.krKey}`}>Title</label>
            <input
              id={`kr-title-${keyResult.krKey}`}
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            />
          </div>

          <OwnerInput
            id={`kr-owner-${keyResult.krKey}`}
            label="Owner (optional)"
            value={draft.owner}
            onChange={(next) => setDraft((current) => ({ ...current, owner: next }))}
            emailValue={draft.ownerEmail}
            onEmailChange={(next) => setDraft((current) => ({ ...current, ownerEmail: next }))}
            multiple
            placeholder="Owner (optional)"
          />
          <div className="field">
            <label htmlFor={`kr-owner-email-${keyResult.krKey}`}>Owner Email</label>
            <input id={`kr-owner-email-${keyResult.krKey}`} value={formatOwnerEmailLabel(draft.owner, draft.ownerEmail)} readOnly />
          </div>

          <div className="field">
            <label htmlFor={`kr-metric-${keyResult.krKey}`}>Metric Type</label>
            <select
              id={`kr-metric-${keyResult.krKey}`}
              value={draft.metricType}
              onChange={(event) => setDraft((current) => ({ ...current, metricType: event.target.value as MetricType }))}
            >
              {metricTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor={`kr-baseline-${keyResult.krKey}`}>Weight</label>
            <input
              id={`kr-baseline-${keyResult.krKey}`}
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={draft.baselineValue}
              onChange={(event) => setDraft((current) => ({ ...current, baselineValue: event.target.value }))}
            />
          </div>

          <div className="field">
            <label htmlFor={`kr-progress-pct-${keyResult.krKey}`}>KR Progress %</label>
            <input
              id={`kr-progress-pct-${keyResult.krKey}`}
              type="number"
              step="any"
              value={String(Math.round(keyResult.progressPct * 100) / 100)}
              readOnly
            />
          </div>

          <div className="field">
            <label htmlFor={`kr-status-${keyResult.krKey}`}>Status</label>
            <select
              id={`kr-status-${keyResult.krKey}`}
              value={draft.status}
              onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as KrStatus }))}
            >
              {keyResultStatusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor={`kr-frequency-${keyResult.krKey}`}>Check-in Frequency</label>
            <select
              id={`kr-frequency-${keyResult.krKey}`}
              value={draft.checkInFrequency}
              onChange={(event) => setDraft((current) => ({ ...current, checkInFrequency: event.target.value as CheckInFrequency }))}
            >
              {checkInFrequencyOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor={`kr-due-date-${keyResult.krKey}`}>Due Date</label>
            <input
              id={`kr-due-date-${keyResult.krKey}`}
              type="date"
              value={draft.dueDate}
              onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))}
            />
          </div>

        </div>

        <div className="field">
          <label htmlFor={`kr-blockers-${keyResult.krKey}`}>Blockers</label>
          <textarea
            id={`kr-blockers-${keyResult.krKey}`}
            value={draft.blockers}
            onChange={(event) => setDraft((current) => ({ ...current, blockers: event.target.value }))}
          />
        </div>

        <div className="field">
          <label htmlFor={`kr-notes-${keyResult.krKey}`}>Notes</label>
          <textarea
            id={`kr-notes-${keyResult.krKey}`}
            value={draft.notes}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
          />
        </div>

        <div className="actions">
          <button className="btn" type="button" disabled={isSaving} onClick={() => void handleSave()}>
            {isSaving ? "Saving..." : "Save KR"}
          </button>
          <button className="btn btn-danger" type="button" disabled={isSaving} onClick={handleReset}>
            Reset
          </button>
        </div>

        {message ? <p className="message">{message}</p> : null}
        {error ? <p className="message danger">{error}</p> : null}
      </div>
    </details>
  );
}
