"use client";

import { appProfile } from "@/lib/app-profile";
import OwnerInput from "@/app/owner-input";
import useCurrentUserEmail from "@/app/use-current-user-email";
import { apiPath } from "@/lib/base-path";
import { beginOperationBatch } from "@/lib/client-operation-batch";
import type { CheckInFrequency, MetricType, ObjectiveStatus, ObjectiveType, OkrCycle } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  positionName: string;
  strategicTheme: string;
  defaultStartDate?: string;
  defaultEndDate?: string;
  defaultCycle: string;
  defaultOwner: string;
  positionOwnerEmail?: string;
  adminEmails: string[];
  objectiveTypeOptions: ObjectiveType[];
  objectiveStatusOptions: ObjectiveStatus[];
  objectiveCycleOptions: OkrCycle[];
  metricTypeOptions: MetricType[];
  checkInFrequencyOptions: CheckInFrequency[];
};

type ApiError = {
  error?: string;
};

type OwnerSuggestion = {
  displayName: string;
  principalName: string;
  mail: string;
};

type PendingObjective = {
  title: string;
  owner: string;
  ownerEmail: string;
  objectiveType: ObjectiveType;
  status: ObjectiveStatus;
  okrCycle: OkrCycle;
  metricType: MetricType;
  baselineValue: number;
  targetValue: number;
  currentValue: number;
  dueDate: string;
  checkInFrequency: CheckInFrequency;
  blockers: string;
  keyRisksDependency: string;
  notes: string;
};

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function todayPlus(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeEmail(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function getNextDisplayCode(code: string, fallbackPrefix: string): string {
  const match = /^([A-Z]+)-(\d+)$/i.exec(code.trim());
  if (!match) {
    return `${fallbackPrefix}-001`;
  }

  const prefix = match[1].toUpperCase();
  const numeric = Number(match[2]);
  if (!Number.isInteger(numeric) || numeric < 1) {
    return `${prefix}-001`;
  }

  return `${prefix}-${String(numeric + 1).padStart(match[2].length, "0")}`;
}

export default function DashboardObjectiveControls({
  positionName,
  strategicTheme,
  defaultStartDate,
  defaultEndDate,
  defaultCycle,
  defaultOwner,
  positionOwnerEmail,
  adminEmails,
  objectiveTypeOptions,
  objectiveStatusOptions,
  objectiveCycleOptions,
  metricTypeOptions,
  checkInFrequencyOptions
}: Props): JSX.Element {
  const labels = appProfile.labels;
  const itemLabel = appProfile.key === "ease-okr" ? "Objective" : labels.midLevelSingular;
  const itemLabelPlural = appProfile.key === "ease-okr" ? "Objectives" : labels.midLevelPlural;
  const midLevelLower = itemLabel.toLowerCase();
  const router = useRouter();
  const signedInEmail = useCurrentUserEmail();
  const normalizedUserEmail = normalizeEmail(signedInEmail);
  const normalizedPositionOwnerEmail = normalizeEmail(positionOwnerEmail);
  const isAdmin = adminEmails.map((entry) => normalizeEmail(entry)).includes(normalizedUserEmail);
  const canCreate = Boolean(normalizedUserEmail) && (isAdmin || normalizedUserEmail === normalizedPositionOwnerEmail);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [title, setTitle] = useState<string>("");
  const [owner, setOwner] = useState<string>(defaultOwner);
  const [ownerEmail, setOwnerEmail] = useState<string>("");
  const [objectiveCodePreview, setObjectiveCodePreview] = useState<string>("");
  const [objectiveType, setObjectiveType] = useState<ObjectiveType>(objectiveTypeOptions[0] ?? "Committed");
  const [status, setStatus] = useState<ObjectiveStatus>(objectiveStatusOptions[0] ?? "NotStarted");
  const [okrCycle, setOkrCycle] = useState<OkrCycle>(objectiveCycleOptions[0] ?? defaultCycle);
  const [metricType, setMetricType] = useState<MetricType>(metricTypeOptions[0] ?? "Operational");
  const [baselineValue, setBaselineValue] = useState<string>("0");
  const [targetValue, setTargetValue] = useState<string>("100");
  const [currentValue, setCurrentValue] = useState<string>("0");
  const [dueDate, setDueDate] = useState<string>(defaultEndDate ?? todayPlus(90));
  const [checkInFrequency, setCheckInFrequency] = useState<CheckInFrequency>(checkInFrequencyOptions[0] ?? "Weekly");
  const [blockers, setBlockers] = useState<string>("");
  const [keyRisksDependency, setKeyRisksDependency] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [pendingObjectives, setPendingObjectives] = useState<PendingObjective[]>([]);
  const [error, setError] = useState<string>("");

  const loadObjectiveCodePreview = async (): Promise<void> => {
    const params = new URLSearchParams({
      department: positionName,
      ventureName: strategicTheme,
      strategicTheme
    });

    const response = await fetch(apiPath(`/api/codes/objective?${params.toString()}`), { cache: "no-store" });
    if (!response.ok) {
      setObjectiveCodePreview(`${appProfile.codePrefixes.midLevel}-001`);
      return;
    }

    const payload = (await response.json()) as { code?: string };
    setObjectiveCodePreview(payload.code?.trim() || `${appProfile.codePrefixes.midLevel}-001`);
  };

  const openAdd = (): void => {
    setError("");
    setTitle("");
    setOwner(defaultOwner);
    setOwnerEmail("");
    void loadObjectiveCodePreview();
    setObjectiveType(objectiveTypeOptions[0] ?? "Committed");
    setStatus(objectiveStatusOptions[0] ?? "NotStarted");
    setOkrCycle(objectiveCycleOptions[0] ?? defaultCycle);
    setMetricType(metricTypeOptions[0] ?? "Operational");
    setBaselineValue("0");
    setTargetValue("100");
    setCurrentValue("0");
    setDueDate(defaultEndDate ?? todayPlus(90));
    setCheckInFrequency(checkInFrequencyOptions[0] ?? "Weekly");
    setBlockers("");
    setKeyRisksDependency("");
    setNotes("");
    setPendingObjectives([]);
    setIsAdding(true);
  };

  const resetDraftForNextObjective = (): void => {
    setTitle("");
    setOwner("");
    setOwnerEmail("");
    setObjectiveType(objectiveTypeOptions[0] ?? "Committed");
    setStatus(objectiveStatusOptions[0] ?? "NotStarted");
    setOkrCycle(objectiveCycleOptions[0] ?? defaultCycle);
    setMetricType(metricTypeOptions[0] ?? "Operational");
    setBaselineValue("0");
    setTargetValue("100");
    setCurrentValue("0");
    setDueDate(defaultEndDate ?? todayPlus(90));
    setCheckInFrequency(checkInFrequencyOptions[0] ?? "Weekly");
    setBlockers("");
    setKeyRisksDependency("");
    setNotes("");
  };

  const closeAdd = (): void => {
    if (isSaving) {
      return;
    }

    setError("");
    setTitle("");
    setOwner(defaultOwner);
    setOwnerEmail("");
    setObjectiveCodePreview("");
    setObjectiveType(objectiveTypeOptions[0] ?? "Committed");
    setStatus(objectiveStatusOptions[0] ?? "NotStarted");
    setOkrCycle(objectiveCycleOptions[0] ?? defaultCycle);
    setMetricType(metricTypeOptions[0] ?? "Operational");
    setBaselineValue("0");
    setTargetValue("100");
    setCurrentValue("0");
    setDueDate(defaultEndDate ?? todayPlus(90));
    setCheckInFrequency(checkInFrequencyOptions[0] ?? "Weekly");
    setBlockers("");
    setKeyRisksDependency("");
    setNotes("");
    setPendingObjectives([]);
    setIsAdding(false);
  };

  useEffect(() => {
    if (!isAdding) {
      return;
    }

    void loadObjectiveCodePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdding, positionName, strategicTheme]);

  const buildPendingObjective = (): PendingObjective | null => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(`${itemLabel} title is required.`);
      return null;
    }

    const startDate = defaultStartDate ?? todayPlus(0);
    const resolvedDueDate = dueDate || defaultEndDate || todayPlus(90);
    const resolvedBaselineValue = Number(baselineValue);
    const resolvedTargetValue = Number(targetValue);
    const resolvedCurrentValue = Number(currentValue);

    if (
      !Number.isFinite(resolvedBaselineValue) ||
      !Number.isFinite(resolvedTargetValue) ||
      !Number.isFinite(resolvedCurrentValue)
    ) {
      setError("Baseline, target, and current values must be numbers.");
      return null;
    }

    if (!resolvedDueDate) {
      setError("Due date is required.");
      return null;
    }

    return {
      title: trimmedTitle,
      owner: owner.trim(),
      ownerEmail: ownerEmail.trim(),
      objectiveType,
      status,
      okrCycle,
      metricType,
      baselineValue: resolvedBaselineValue,
      targetValue: resolvedTargetValue,
      currentValue: resolvedCurrentValue,
      dueDate: resolvedDueDate,
      checkInFrequency,
      blockers: blockers.trim(),
      keyRisksDependency: keyRisksDependency.trim(),
      notes: notes.trim()
    };
  };

  const queueObjective = (): void => {
    const draft = buildPendingObjective();
    if (!draft) {
      return;
    }

    setPendingObjectives((current) => [...current, draft]);
    resetDraftForNextObjective();
    setError("");
    setObjectiveCodePreview((current) => getNextDisplayCode(current, appProfile.codePrefixes.midLevel));
  };

  const removeQueuedObjective = (index: number): void => {
    setPendingObjectives((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const saveAllObjectives = async (): Promise<void> => {
    if (isSaving) {
      return;
    }

    const staged = [...pendingObjectives];
    if (staged.length === 0 && title.trim()) {
      const current = buildPendingObjective();
      if (!current) {
        return;
      }

      staged.push(current);
    }

    if (staged.length === 0) {
      setError(`Add at least one ${midLevelLower} first.`);
      return;
    }

    const startDate = defaultStartDate ?? todayPlus(0);
    setIsSaving(true);
    setError("");
    const batch = beginOperationBatch("Saving objectives", staged.length);

    try {
      for (let index = 0; index < staged.length; index += 1) {
        batch.setCurrentStep(index + 1);
        const item = staged[index];
        const response = await fetch(apiPath("/api/objectives"), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-user-email": signedInEmail
          },
          body: JSON.stringify({
            title: item.title,
            description: item.notes,
            owner: item.owner,
            ownerEmail: item.ownerEmail,
            department: positionName,
            ventureName: strategicTheme,
            strategicTheme,
            objectiveType: item.objectiveType,
            okrCycle: item.okrCycle,
            metricType: item.metricType,
            baselineValue: item.baselineValue,
            targetValue: item.targetValue,
            currentValue: item.currentValue,
            blockers: item.blockers,
            keyRisksDependency: item.keyRisksDependency,
            notes: item.notes,
            status: item.status,
            confidence: "Medium",
            rag: "Amber",
            startDate,
            endDate: item.dueDate,
            dueDate: item.dueDate,
            checkInFrequency: item.checkInFrequency
          })
        });
        const payload = await readJson<ApiError>(response);

        if (!response.ok) {
          setError(payload?.error ?? `Failed to add ${midLevelLower} at line ${index + 1}.`);
          setIsSaving(false);
          batch.finish();
          return;
        }
      }

      batch.finish();
      setIsSaving(false);
      setPendingObjectives([]);
      closeAdd();
      setError("");
      router.refresh();
    } catch (error) {
      batch.finish();
      setError(error instanceof Error ? error.message : `Failed to save ${itemLabelPlural.toLowerCase()}.`);
      setIsSaving(false);
      return;
    }
  };

  return (
    <div className="objective-controls">
      {canCreate ? (
        <button
          className={`tab-btn objective-add-btn ${isAdding ? "tab-btn-active" : ""}`}
          type="button"
          onClick={isAdding ? closeAdd : openAdd}
          disabled={isSaving}
        >
          Add {itemLabel}
        </button>
      ) : null}
      {canCreate && isAdding ? (
        <form
          className="objective-form"
          onSubmit={(event) => {
            event.preventDefault();
            void saveAllObjectives();
          }}
        >
          <div className="objective-form-grid">
            <div className="field">
              <label>{itemLabel} Code</label>
              <input
                name="objectiveCode"
                value={objectiveCodePreview}
                readOnly
                aria-label={`${itemLabel} code for ${positionName}`}
                disabled={isSaving}
              />
            </div>
            <OwnerInput
              id={`objective-owner-${positionName.replace(/\s+/g, "-").toLowerCase()}`}
              label="Owner (optional)"
              value={owner}
              onChange={setOwner}
              onSelectUser={(user: OwnerSuggestion | null) => {
                setOwnerEmail(user ? user.mail || user.principalName : "");
              }}
              disabled={isSaving}
              placeholder="Owner (optional)"
            />
            <div className="field">
              <label>Owner Email</label>
              <input name="objectiveOwnerEmail" value={ownerEmail} readOnly disabled={isSaving} />
            </div>
            <div className="field objective-field-wide">
              <label>{itemLabel}</label>
              <textarea
                name="objectiveTitle"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={itemLabel}
                aria-label={`${itemLabel} title for ${positionName}`}
                autoFocus
                disabled={isSaving}
              />
            </div>
            <div className="field">
              <label>{itemLabel} Type</label>
              <select
                name="objectiveType"
                value={objectiveType}
                onChange={(event) => setObjectiveType(event.target.value as ObjectiveType)}
                disabled={isSaving}
              >
                {objectiveTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Health</label>
              <select
                name="objectiveStatus"
                value={status}
                onChange={(event) => setStatus(event.target.value as ObjectiveStatus)}
                disabled={isSaving}
              >
                {objectiveStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{itemLabel} Metric Type</label>
              <select
                name="objectiveMetricType"
                value={metricType}
                onChange={(event) => setMetricType(event.target.value as MetricType)}
                disabled={isSaving}
              >
                {metricTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Baseline Value</label>
              <input
                name="objectiveBaselineValue"
                type="number"
                step="any"
                value={baselineValue}
                onChange={(event) => setBaselineValue(event.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="field">
              <label>Target Value</label>
              <input
                name="objectiveTargetValue"
                type="number"
                step="any"
                value={targetValue}
                onChange={(event) => setTargetValue(event.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="field">
              <label>Current Value</label>
              <input
                name="objectiveCurrentValue"
                type="number"
                step="any"
                value={currentValue}
                onChange={(event) => setCurrentValue(event.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="field">
              <label>Due Date</label>
              <input
                name="objectiveDueDate"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="field">
              <label>Check-in Frequency</label>
              <select
                name="objectiveCheckInFrequency"
                value={checkInFrequency}
                onChange={(event) => setCheckInFrequency(event.target.value as CheckInFrequency)}
                disabled={isSaving}
              >
                {checkInFrequencyOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>OKR Cycle</label>
              <select
                name="objectiveCycle"
                value={okrCycle}
                onChange={(event) => setOkrCycle(event.target.value as OkrCycle)}
                disabled={isSaving}
              >
                {objectiveCycleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="field objective-field-wide">
              <label>Blockers</label>
              <textarea
                name="objectiveBlockers"
                value={blockers}
                onChange={(event) => setBlockers(event.target.value)}
                placeholder="Current blockers"
                disabled={isSaving}
              />
            </div>
            <div className="field objective-field-wide">
              <label>Key Risks/Dependancy</label>
              <input
                name="objectiveKeyRisksDependency"
                value={keyRisksDependency}
                onChange={(event) => setKeyRisksDependency(event.target.value)}
                placeholder="Key risks/dependencies"
                disabled={isSaving}
              />
            </div>
            <div className="field objective-field-wide">
              <label>Notes</label>
              <textarea name="objectiveNotes" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={isSaving} />
            </div>
          </div>
          <div className="actions">
            <button className="btn" type="button" onClick={queueObjective} disabled={isSaving}>
              Add More
            </button>
            <button className="btn btn-add" type="submit" disabled={isSaving}>
              Save All{pendingObjectives.length > 0 ? ` (${pendingObjectives.length})` : ""}
            </button>
            <button className="tab-btn" type="button" onClick={closeAdd} disabled={isSaving}>
              Cancel
            </button>
          </div>
          {pendingObjectives.length > 0 ? (
            <div className="field objective-field-wide">
              <label>Pending {itemLabelPlural}</label>
              <ul>
                {pendingObjectives.map((item, index) => (
                  <li key={`${item.title}-${index}`}>
                    {item.title}{" "}
                    <button type="button" className="tab-btn" onClick={() => removeQueuedObjective(index)} disabled={isSaving}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <p className="message">
                You have {pendingObjectives.length} unsaved {itemLabelPlural.toLowerCase()}. Click Save All.
              </p>
            </div>
          ) : null}
        </form>
      ) : null}
      {error ? <p className="message danger">{error}</p> : null}
    </div>
  );
}
