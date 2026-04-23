"use client";

import OwnerInput from "@/app/owner-input";
import useCurrentUserEmail from "@/app/use-current-user-email";
import { apiPath } from "@/lib/base-path";
import { formatOwnerEmailLabel, resolveOwnerEmail, resolveOwnerName } from "@/lib/owner";
import type { CheckInFrequency, Confidence, MetricType, Objective, ObjectiveStatus, ObjectiveType, OkrCycle } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ObjectiveEditControlsProps = {
  objective: Objective;
  departmentOptions: string[];
  objectiveTypeOptions: ObjectiveType[];
  objectiveStatusOptions: ObjectiveStatus[];
  objectiveCycleOptions: OkrCycle[];
  metricTypeOptions: MetricType[];
  checkInFrequencyOptions: CheckInFrequency[];
};

type ObjectiveDraft = {
  objectiveCode: string;
  title: string;
  description: string;
  owner: string;
  ownerEmail: string;
  department: string;
  strategicTheme: string;
  objectiveType: ObjectiveType;
  okrCycle: OkrCycle;
  metricType: MetricType;
  baselineValue: string;
  blockers: string;
  keyRisksDependency: string;
  notes: string;
  status: ObjectiveStatus;
  confidence: Confidence;
  startDate: string;
  endDate: string;
  dueDate: string;
  checkInFrequency: CheckInFrequency;
};

type ApiError = {
  error?: string;
};

const CONFIDENCE_OPTIONS: Confidence[] = ["High", "Medium", "Low"];

function toDateInput(value: string): string {
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

function toDraft(objective: Objective): ObjectiveDraft {
  return {
    objectiveCode: objective.objectiveCode ?? objective.objectiveKey,
    title: objective.title,
    description: objective.description,
    owner: resolveOwnerName(objective.owner, objective.ownerEmail),
    ownerEmail: resolveOwnerEmail(objective.owner, objective.ownerEmail),
    department: objective.department,
    strategicTheme: objective.strategicTheme,
    objectiveType: objective.objectiveType,
    okrCycle: objective.okrCycle,
    metricType: objective.metricType,
    baselineValue: normalizeWeightValue(objective.baselineValue),
    blockers: objective.blockers ?? "",
    keyRisksDependency: objective.keyRisksDependency,
    notes: objective.notes,
    status: objective.status,
    confidence: objective.confidence,
    startDate: toDateInput(objective.startDate),
    endDate: toDateInput(objective.endDate),
    dueDate: toDateInput(objective.dueDate),
    checkInFrequency: objective.checkInFrequency
  };
}

export default function ObjectiveEditControls({
  objective,
  departmentOptions,
  objectiveTypeOptions,
  objectiveStatusOptions,
  objectiveCycleOptions,
  metricTypeOptions,
  checkInFrequencyOptions
}: ObjectiveEditControlsProps): JSX.Element {
  const router = useRouter();
  const currentUserEmail = useCurrentUserEmail();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [draft, setDraft] = useState<ObjectiveDraft>(() => toDraft(objective));
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setDraft(toDraft(objective));
  }, [objective]);

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

    if (!draft.dueDate) {
      setError("Due date is required.");
      setIsSaving(false);
      return;
    }
    const response = await fetch(apiPath(`/api/objectives/${encodeURIComponent(objective.objectiveKey)}`), {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-user-email": currentUserEmail
      },
      body: JSON.stringify({
        objectiveCode: draft.objectiveCode.trim(),
        title: draft.title.trim(),
        description: draft.description.trim(),
        owner: draft.owner.trim(),
        ownerEmail: draft.ownerEmail.trim(),
        department: draft.department.trim(),
        strategicTheme: draft.strategicTheme.trim(),
        objectiveType: draft.objectiveType,
        okrCycle: draft.okrCycle,
        metricType: draft.metricType,
        baselineValue,
        blockers: draft.blockers.trim(),
        keyRisksDependency: draft.keyRisksDependency.trim(),
        notes: draft.notes.trim(),
        status: draft.status,
        confidence: draft.confidence,
        startDate: draft.startDate,
        endDate: draft.dueDate,
        dueDate: draft.dueDate,
        checkInFrequency: draft.checkInFrequency
      })
    });

    if (!response.ok) {
      const payload = (await response.json()) as ApiError;
      setError(payload.error ?? "Failed to update objective.");
      setIsSaving(false);
      return;
    }

    setMessage("Objective updated.");
    setIsSaving(false);
    setIsEditing(false);
    router.refresh();
  };

  const handleCancel = (): void => {
    setDraft(toDraft(objective));
    setError("");
    setMessage("");
    setIsEditing(false);
  };

  return (
    <div className="form-grid">
      {!isEditing ? (
        <div className="actions">
          <button className="btn" type="button" onClick={() => setIsEditing(true)}>
            Edit Objective
          </button>
        </div>
      ) : (
        <>
          <div className="config-grid">
            <div className="field">
              <label htmlFor="objective-code-edit">Objective Code</label>
              <input
                id="objective-code-edit"
                value={draft.objectiveCode}
                onChange={(event) => setDraft((current) => ({ ...current, objectiveCode: event.target.value }))}
              />
            </div>

            <div className="field">
              <label htmlFor="objective-title-edit">Title</label>
              <input
                id="objective-title-edit"
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              />
            </div>

            <OwnerInput
              id="objective-owner-edit"
              label="Owner (optional)"
              value={draft.owner}
              onChange={(next) => setDraft((current) => ({ ...current, owner: next }))}
              emailValue={draft.ownerEmail}
              onEmailChange={(next) => setDraft((current) => ({ ...current, ownerEmail: next }))}
              multiple
              placeholder="Owner (optional)"
            />
            <div className="field">
              <label htmlFor="objective-owner-email-edit">Owner Email</label>
              <input id="objective-owner-email-edit" value={formatOwnerEmailLabel(draft.owner, draft.ownerEmail)} readOnly />
            </div>

            <div className="field">
              <label htmlFor="objective-department-edit">Department</label>
              <input
                id="objective-department-edit"
                list="objective-department-options"
                value={draft.department}
                onChange={(event) => setDraft((current) => ({ ...current, department: event.target.value }))}
              />
              <datalist id="objective-department-options">
                {departmentOptions.map((departmentName) => (
                  <option key={departmentName} value={departmentName} />
                ))}
              </datalist>
            </div>

            <div className="field">
              <label htmlFor="objective-theme-edit">Strategic Theme</label>
              <input
                id="objective-theme-edit"
                value={draft.strategicTheme}
                onChange={(event) => setDraft((current) => ({ ...current, strategicTheme: event.target.value }))}
              />
            </div>

            <div className="field">
              <label htmlFor="objective-type-edit">Objective Type</label>
              <select
                id="objective-type-edit"
                value={draft.objectiveType}
                onChange={(event) => setDraft((current) => ({ ...current, objectiveType: event.target.value as ObjectiveType }))}
              >
                {objectiveTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="objective-cycle-edit">OKR Cycle</label>
              <select
                id="objective-cycle-edit"
                value={draft.okrCycle}
                onChange={(event) => setDraft((current) => ({ ...current, okrCycle: event.target.value as OkrCycle }))}
              >
                {objectiveCycleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="objective-metric-edit">Metric Type</label>
              <select
                id="objective-metric-edit"
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
              <label htmlFor="objective-baseline-edit">Weight</label>
              <input
                id="objective-baseline-edit"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={draft.baselineValue}
                onChange={(event) => setDraft((current) => ({ ...current, baselineValue: event.target.value }))}
              />
            </div>

            <div className="field">
              <label htmlFor="objective-progress-pct-edit">Progress %</label>
              <input
                id="objective-progress-pct-edit"
                type="number"
                step="any"
                value={String(Math.round(objective.progressPct * 100) / 100)}
                readOnly
              />
            </div>

            <div className="field">
              <label htmlFor="objective-status-edit">Status</label>
              <select
                id="objective-status-edit"
                value={draft.status}
                onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as ObjectiveStatus }))}
              >
                {objectiveStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="objective-confidence-edit">Confidence</label>
              <select
                id="objective-confidence-edit"
                value={draft.confidence}
                onChange={(event) => setDraft((current) => ({ ...current, confidence: event.target.value as Confidence }))}
              >
                {CONFIDENCE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="objective-start-edit">Start Date</label>
              <input
                id="objective-start-edit"
                type="date"
                value={draft.startDate}
                onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
              />
            </div>

            <div className="field">
              <label htmlFor="objective-end-edit">End Date</label>
              <input
                id="objective-end-edit"
                type="date"
                value={draft.endDate}
                onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))}
              />
            </div>

            <div className="field">
              <label htmlFor="objective-due-edit">Due Date</label>
              <input
                id="objective-due-edit"
                type="date"
                value={draft.dueDate}
                onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))}
              />
            </div>

            <div className="field">
              <label htmlFor="objective-frequency-edit">Check-in Frequency</label>
              <select
                id="objective-frequency-edit"
                value={draft.checkInFrequency}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, checkInFrequency: event.target.value as CheckInFrequency }))
                }
              >
                {checkInFrequencyOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

          </div>

          <div className="field">
            <label htmlFor="objective-description-edit">Description</label>
            <textarea
              id="objective-description-edit"
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            />
          </div>

          <div className="field">
            <label htmlFor="objective-notes-edit">Notes</label>
            <textarea
              id="objective-notes-edit"
              value={draft.notes}
              onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
            />
          </div>

          <div className="field">
            <label htmlFor="objective-blockers-edit">Blockers</label>
            <textarea
              id="objective-blockers-edit"
              value={draft.blockers}
              onChange={(event) => setDraft((current) => ({ ...current, blockers: event.target.value }))}
            />
          </div>

          <div className="field">
            <label htmlFor="objective-risks-edit">Key Risks/Dependancy</label>
            <textarea
              id="objective-risks-edit"
              value={draft.keyRisksDependency}
              onChange={(event) => setDraft((current) => ({ ...current, keyRisksDependency: event.target.value }))}
            />
          </div>

          <div className="actions">
            <button className="btn" type="button" disabled={isSaving} onClick={() => void handleSave()}>
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
            <button className="btn btn-danger" type="button" disabled={isSaving} onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </>
      )}

      {message ? <p className="message">{message}</p> : null}
      {error ? <p className="message danger">{error}</p> : null}
    </div>
  );
}
