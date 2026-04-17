"use client";

import DashboardEaseKrCard from "@/app/dashboard-ease-kr-card";
import DashboardKrControls from "@/app/dashboard-kr-controls";
import OwnerInput from "@/app/owner-input";
import useCurrentUserEmail from "@/app/use-current-user-email";
import { apiPath } from "@/lib/base-path";
import { resolveOwnerEmail, resolveOwnerName } from "@/lib/owner";
import type { CheckInFrequency, Kpi, KeyResult, KrStatus, MetricType, Objective, ObjectiveStatus, ObjectiveType, OkrCycle } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type KeyResultRowData = {
  keyResult: KeyResult;
  kpis?: Array<{
    kpi: Kpi;
    latestUpdateNotes?: string;
    latestUpdatedAt?: string | null;
  }>;
  latestUpdateNotes?: string;
  latestUpdatedAt?: string | null;
};

type Props = {
  objective: Objective;
  keyResults: KeyResultRowData[];
  positionOwnerEmail?: string;
  adminEmails: string[];
  objectiveTypeOptions: ObjectiveType[];
  objectiveStatusOptions: ObjectiveStatus[];
  objectiveCycleOptions: OkrCycle[];
  metricTypeOptions: MetricType[];
  keyResultStatusOptions: KrStatus[];
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

function normalizeEmail(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function formatStatus(value: ObjectiveStatus): string {
  if (value === "OnTrack") return "On Track";
  if (value === "AtRisk") return "At Risk";
  if (value === "OffTrack") return "Off Track";
  if (value === "NotStarted") return "Not Started";
  return value;
}

function formatCheckinFrequency(value: CheckInFrequency): string {
  if (value === "BiWeekly") return "Bi-weekly";
  if (value === "AdHoc") return "Ad Hoc";
  return value;
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function statusChipClass(status: ObjectiveStatus): string {
  if (status === "OnTrack") return "ease-chip ease-chip-green";
  if (status === "AtRisk") return "ease-chip ease-chip-amber";
  if (status === "OffTrack") return "ease-chip ease-chip-red";
  return "ease-chip ease-chip-neutral";
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export default function DashboardEaseObjectiveCard({
  objective,
  keyResults,
  positionOwnerEmail,
  adminEmails,
  objectiveTypeOptions,
  objectiveStatusOptions,
  objectiveCycleOptions,
  metricTypeOptions,
  keyResultStatusOptions,
  checkInFrequencyOptions
}: Props): JSX.Element {
  const router = useRouter();
  const signedInEmail = useCurrentUserEmail();
  const normalizedOwnerEmail = normalizeEmail(resolveOwnerEmail(objective.owner, objective.ownerEmail));
  const normalizedPositionOwnerEmail = normalizeEmail(positionOwnerEmail);
  const normalizedUserEmail = normalizeEmail(signedInEmail);
  const isAdmin = adminEmails.map((entry) => normalizeEmail(entry)).includes(normalizedUserEmail);
  const canEdit =
    Boolean(normalizedUserEmail) &&
    (isAdmin || normalizedOwnerEmail === normalizedUserEmail || normalizedPositionOwnerEmail === normalizedUserEmail);

  const objectiveCode = objective.objectiveCode ?? objective.objectiveKey;

  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState(objectiveCode);
  const [title, setTitle] = useState(objective.title);
  const [owner, setOwner] = useState(resolveOwnerName(objective.owner));
  const [ownerEmail, setOwnerEmail] = useState(resolveOwnerEmail(objective.owner, objective.ownerEmail));
  const [objectiveType, setObjectiveType] = useState<ObjectiveType>(objective.objectiveType);
  const [status, setStatus] = useState<ObjectiveStatus>(objective.status);
  const [okrCycle, setOkrCycle] = useState<OkrCycle>(objective.okrCycle);
  const [metricType, setMetricType] = useState<MetricType>(objective.metricType);
  const [baselineValue, setBaselineValue] = useState(String(objective.baselineValue));
  const [targetValue, setTargetValue] = useState(String(objective.targetValue));
  const [currentValue, setCurrentValue] = useState(String(objective.currentValue));
  const [progressPct, setProgressPct] = useState(String(objective.progressPct));
  const [dueDate, setDueDate] = useState(toDateInput(objective.dueDate));
  const [checkInFrequency, setCheckInFrequency] = useState<CheckInFrequency>(objective.checkInFrequency);
  const [blockers, setBlockers] = useState(objective.blockers ?? "");
  const [keyRisksDependency, setKeyRisksDependency] = useState(objective.keyRisksDependency ?? "");
  const [notes, setNotes] = useState(objective.notes ?? objective.description ?? "");

  useEffect(() => {
    setCode(objectiveCode);
    setTitle(objective.title);
    setOwner(resolveOwnerName(objective.owner));
    setOwnerEmail(resolveOwnerEmail(objective.owner, objective.ownerEmail));
    setObjectiveType(objective.objectiveType);
    setStatus(objective.status);
    setOkrCycle(objective.okrCycle);
    setMetricType(objective.metricType);
    setBaselineValue(String(objective.baselineValue));
    setTargetValue(String(objective.targetValue));
    setCurrentValue(String(objective.currentValue));
    setProgressPct(String(objective.progressPct));
    setDueDate(toDateInput(objective.dueDate));
    setCheckInFrequency(objective.checkInFrequency);
    setBlockers(objective.blockers ?? "");
    setKeyRisksDependency(objective.keyRisksDependency ?? "");
    setNotes(objective.notes ?? objective.description ?? "");
  }, [objective, objectiveCode]);

  const progressValue = useMemo(() => clampPercent(Number(progressPct)), [progressPct]);

  const cancelEdit = (): void => {
    setIsEditing(false);
    setError("");
    setCode(objectiveCode);
    setTitle(objective.title);
    setOwner(resolveOwnerName(objective.owner));
    setOwnerEmail(resolveOwnerEmail(objective.owner, objective.ownerEmail));
    setObjectiveType(objective.objectiveType);
    setStatus(objective.status);
    setOkrCycle(objective.okrCycle);
    setMetricType(objective.metricType);
    setBaselineValue(String(objective.baselineValue));
    setTargetValue(String(objective.targetValue));
    setCurrentValue(String(objective.currentValue));
    setProgressPct(String(objective.progressPct));
    setDueDate(toDateInput(objective.dueDate));
    setCheckInFrequency(objective.checkInFrequency);
    setBlockers(objective.blockers ?? "");
    setKeyRisksDependency(objective.keyRisksDependency ?? "");
    setNotes(objective.notes ?? objective.description ?? "");
  };

  const saveEdit = async (): Promise<void> => {
    if (isSaving) return;
    if (!title.trim()) {
      setError("Objective title is required.");
      return;
    }

    const baseline = Number(baselineValue);
    const target = Number(targetValue);
    let current = Number(currentValue);
    const progress = Number(progressPct);

    if (!Number.isFinite(baseline) || !Number.isFinite(target) || !Number.isFinite(current) || !Number.isFinite(progress)) {
      setError("Baseline, target, current, and progress must be numeric.");
      return;
    }

    if (!dueDate) {
      setError("Due date is required.");
      return;
    }

    current = baseline + ((target - baseline) * progress) / 100;

    setIsSaving(true);
    setError("");

    const response = await fetch(apiPath(`/api/objectives/${encodeURIComponent(objective.objectiveKey)}`), {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-user-email": signedInEmail
      },
      body: JSON.stringify({
        objectiveCode: code.trim(),
        title: title.trim(),
        owner: owner.trim(),
        ownerEmail: ownerEmail.trim(),
        objectiveType,
        okrCycle,
        metricType,
        baselineValue: baseline,
        targetValue: target,
        currentValue: current,
        status,
        progressPct: clampPercent(progress),
        dueDate,
        endDate: dueDate,
        checkInFrequency,
        blockers: blockers.trim(),
        keyRisksDependency: keyRisksDependency.trim(),
        notes: notes.trim()
      })
    });

    if (!response.ok) {
      const payload = await readJson<ApiError>(response);
      setError(payload?.error ?? "Failed to update objective.");
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    setIsEditing(false);
    router.refresh();
  };

  const deleteCurrentObjective = async (): Promise<void> => {
    if (isSaving) return;
    const warning =
      keyResults.length > 0
        ? `Delete objective '${objective.title}'? This will also delete ${keyResults.length} key results and related KPIs.`
        : `Delete objective '${objective.title}'? This action cannot be undone.`;
    if (!window.confirm(warning)) return;

    setIsSaving(true);
    setError("");

    const response = await fetch(apiPath(`/api/objectives/${encodeURIComponent(objective.objectiveKey)}`), {
      method: "DELETE",
      headers: {
        "x-user-email": signedInEmail
      }
    });

    if (!response.ok) {
      const payload = await readJson<ApiError>(response);
      setError(payload?.error ?? "Failed to delete objective.");
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    setIsEditing(false);
    router.refresh();
  };

  return (
    <article className="ease-objective-card">
      <div className="ease-objective-shell">
        <div
          className="ease-objective-top"
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setIsExpanded((current) => !current);
            }
          }}
        >
          <button type="button" className={`ease-toggle ease-toggle-objective ${isExpanded ? "is-open" : ""}`} aria-hidden="true" tabIndex={-1}>
            <span aria-hidden="true">{isExpanded ? "⌄" : "›"}</span>
          </button>
          <div className="ease-objective-main">
            <div className="ease-objective-heading">
              <div className="ease-objective-heading-copy">
                <div className="ease-code-badge">{objectiveCode}</div>
                {isEditing ? (
                  <input className="objective-row-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Objective" autoFocus disabled={isSaving} />
                ) : (
                  <h3>{objective.title}</h3>
                )}
                {!isEditing && notes ? <p className="ease-card-copy">{notes}</p> : null}
              </div>
              <div className="ease-card-head-side">
                <span className={statusChipClass(isEditing ? status : objective.status)}>{formatStatus(isEditing ? status : objective.status)}</span>
                <div className="ease-progress-ring ease-progress-ring-objective" style={{ "--progress": `${progressValue}%` } as React.CSSProperties}>
                  <span>{Math.round(progressValue)}%</span>
                </div>
              </div>
            </div>
            {!isEditing ? (
              <div className="ease-objective-chip-row">
                <span className="ease-chip ease-chip-neutral">{objective.okrCycle}</span>
                <span className="ease-chip ease-chip-neutral">{objective.owner || "-"}</span>
                <span className="ease-chip ease-chip-neutral">{objective.metricType}</span>
                <span className="ease-chip ease-chip-neutral">{formatDate(objective.dueDate)}</span>
              </div>
            ) : null}
            {!isEditing ? (
              <div className="ease-objective-metrics">
                <div className="ease-progress-bar ease-progress-bar-large">
                  <span style={{ width: `${progressValue}%` }} />
                </div>
                <div className="ease-metric-line">
                  <span>{objective.currentValue} / {objective.targetValue}</span>
                  <span>{formatCheckinFrequency(objective.checkInFrequency)}</span>
                  <span>{objective.blockers || "No blockers"}</span>
                  <span>{objective.keyRisksDependency || "No key risks"}</span>
                </div>
              </div>
            ) : (
              <div className="ease-edit-grid">
                <input className="objective-row-input" value={code} onChange={(event) => setCode(event.target.value)} disabled={isSaving} />
                <OwnerInput id={`ease-objective-owner-${objective.objectiveKey}`} label="Owner (optional)" value={owner} onChange={setOwner} onSelectUser={(user: OwnerSuggestion | null) => setOwnerEmail(user ? user.mail || user.principalName : "")} disabled={isSaving} />
                <div className="field"><label>Owner Email</label><input className="objective-row-input" value={ownerEmail} readOnly disabled={isSaving} /></div>
                <div className="field"><label>Objective Type</label><select className="objective-row-select" value={objectiveType} onChange={(event) => setObjectiveType(event.target.value as ObjectiveType)} disabled={isSaving}>{objectiveTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
                <div className="field"><label>Health</label><select className="objective-row-select" value={status} onChange={(event) => setStatus(event.target.value as ObjectiveStatus)} disabled={isSaving}>{objectiveStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
                <div className="field"><label>OKR Cycle</label><select className="objective-row-select" value={okrCycle} onChange={(event) => setOkrCycle(event.target.value as OkrCycle)} disabled={isSaving}>{objectiveCycleOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
                <div className="field"><label>Metric Type</label><select className="objective-row-select" value={metricType} onChange={(event) => setMetricType(event.target.value as MetricType)} disabled={isSaving}>{metricTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
                <div className="field"><label>Baseline Value</label><input className="objective-row-input" type="number" step="any" value={baselineValue} onChange={(event) => setBaselineValue(event.target.value)} disabled={isSaving} /></div>
                <div className="field"><label>Target Value</label><input className="objective-row-input" type="number" step="any" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} disabled={isSaving} /></div>
                <div className="field"><label>Current Value</label><input className="objective-row-input" type="number" step="any" value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} disabled={isSaving} /></div>
                <div className="field"><label>Progress %</label><input className="objective-row-input" type="number" step="any" value={progressPct} onChange={(event) => setProgressPct(event.target.value)} disabled={isSaving} /></div>
                <div className="field"><label>Due Date</label><input className="objective-row-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={isSaving} /></div>
                <div className="field"><label>Check-in Frequency</label><select className="objective-row-select" value={checkInFrequency} onChange={(event) => setCheckInFrequency(event.target.value as CheckInFrequency)} disabled={isSaving}>{checkInFrequencyOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
                <div className="field ease-edit-span"><label>Blockers</label><textarea value={blockers} onChange={(event) => setBlockers(event.target.value)} disabled={isSaving} /></div>
                <div className="field ease-edit-span"><label>Key Risks/Dependency</label><textarea value={keyRisksDependency} onChange={(event) => setKeyRisksDependency(event.target.value)} disabled={isSaving} /></div>
                <div className="field ease-edit-span"><label>Notes</label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={isSaving} /></div>
              </div>
            )}
            {canEdit ? (
              <div className="ease-card-actions">
                {isEditing ? (
                  <>
                    <button className="btn" type="button" onClick={() => void saveEdit()} disabled={isSaving}>Save</button>
                    <button className="btn btn-danger" type="button" onClick={() => void deleteCurrentObjective()} disabled={isSaving}>Delete</button>
                    <button className="tab-btn" type="button" onClick={cancelEdit} disabled={isSaving}>Cancel</button>
                  </>
                ) : (
                  <button className="tab-btn" type="button" onClick={(event) => { event.stopPropagation(); setIsEditing(true); }} disabled={isSaving}>Edit Objective</button>
                )}
              </div>
            ) : null}
            {error ? <p className="message danger">{error}</p> : null}
          </div>
        </div>
        {isExpanded ? (
          <div className="ease-kr-section">
            <div className="ease-subsection-head">
              <h4>Key Results ({keyResults.length})</h4>
              <DashboardKrControls objectiveKey={objective.objectiveKey} defaultDueDate={objective.endDate} defaultOwner={objective.owner || ""} positionOwnerEmail={positionOwnerEmail} adminEmails={adminEmails} metricTypeOptions={metricTypeOptions} keyResultStatusOptions={keyResultStatusOptions} checkInFrequencyOptions={checkInFrequencyOptions} />
            </div>
            <div className="ease-kr-list">
              {keyResults.length === 0 ? (
                <p className="meta">No key results for this objective yet.</p>
              ) : (
                keyResults.map((item) => (
                  <DashboardEaseKrCard key={item.keyResult.krKey} keyResult={item.keyResult} kpis={item.kpis ?? []} positionOwnerEmail={positionOwnerEmail} adminEmails={adminEmails} metricTypeOptions={metricTypeOptions} keyResultStatusOptions={keyResultStatusOptions} checkInFrequencyOptions={checkInFrequencyOptions} />
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
