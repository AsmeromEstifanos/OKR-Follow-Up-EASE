"use client";

import DashboardKeyResultControls from "@/app/dashboard-key-result-controls";
import DashboardKeyResultRowEditor from "@/app/dashboard-key-result-row-editor";
import OwnerInput from "@/app/owner-input";
import useCurrentUserEmail from "@/app/use-current-user-email";
import { appProfile } from "@/lib/app-profile";
import { apiPath } from "@/lib/base-path";
import {
  formatOwnerEmailLabel,
  formatOwnerLabel,
  includesAssignedOwnerEmail,
  includesSerializedOwnerEmail,
  resolveOwnerEmail,
  resolveOwnerName
} from "@/lib/owner";
import type { CheckInFrequency, Kpi, KeyResult, KrStatus, MetricType } from "@/lib/types";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";

type KpiRowData = {
  kpi: Kpi;
  latestUpdateNotes?: string;
  latestUpdatedAt?: string | null;
};

type Props = {
  keyResult: KeyResult;
  kpis: KpiRowData[];
  positionOwnerEmail?: string;
  adminEmails: string[];
  metricTypeOptions: MetricType[];
  keyResultStatusOptions: KrStatus[];
  checkInFrequencyOptions: CheckInFrequency[];
};

type ApiError = { error?: string };
function formatStatus(value: KrStatus): string {
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

function formatMetricValue(value: number): string {
  return value.toLocaleString();
}

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
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

function normalizeEmail(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export default function DashboardKrRowEditor({
  keyResult,
  kpis,
  positionOwnerEmail,
  adminEmails,
  metricTypeOptions,
  keyResultStatusOptions,
  checkInFrequencyOptions
}: Props): JSX.Element {
  const router = useRouter();
  const signedInEmail = useCurrentUserEmail();
  const codeValue = keyResult.krCode ?? keyResult.krKey;
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState(codeValue);
  const [title, setTitle] = useState(keyResult.title);
  const [owner, setOwner] = useState(resolveOwnerName(keyResult.owner, keyResult.ownerEmail));
  const [ownerEmail, setOwnerEmail] = useState(resolveOwnerEmail(keyResult.owner, keyResult.ownerEmail));
  const [metricType, setMetricType] = useState<MetricType>(keyResult.metricType);
  const [baselineValue, setBaselineValue] = useState(String(keyResult.baselineValue));
  const [targetValue, setTargetValue] = useState(String(keyResult.targetValue));
  const [currentValue, setCurrentValue] = useState(String(keyResult.currentValue));
  const [progressPct, setProgressPct] = useState(String(keyResult.progressPct));
  const [status, setStatus] = useState<KrStatus>(keyResult.status);
  const [dueDate, setDueDate] = useState(toDateInput(keyResult.dueDate));
  const [checkInFrequency, setCheckInFrequency] = useState<CheckInFrequency>(keyResult.checkInFrequency);
  const [blockers, setBlockers] = useState(keyResult.blockers ?? "");
  const [notes, setNotes] = useState(keyResult.notes ?? "");

  const normalizedUserEmail = normalizeEmail(signedInEmail);
  const isAdmin = adminEmails.map((entry) => normalizeEmail(entry)).includes(normalizedUserEmail);
  const canEdit =
    Boolean(normalizedUserEmail) &&
    (
      isAdmin ||
      includesAssignedOwnerEmail(keyResult.owner, keyResult.ownerEmail, normalizedUserEmail) ||
      includesSerializedOwnerEmail(positionOwnerEmail, normalizedUserEmail)
    );

  useEffect(() => {
    setCode(codeValue);
    setTitle(keyResult.title);
    setOwner(resolveOwnerName(keyResult.owner, keyResult.ownerEmail));
    setOwnerEmail(resolveOwnerEmail(keyResult.owner, keyResult.ownerEmail));
    setMetricType(keyResult.metricType);
    setBaselineValue(String(keyResult.baselineValue));
    setTargetValue(String(keyResult.targetValue));
    setCurrentValue(String(keyResult.currentValue));
    setProgressPct(String(keyResult.progressPct));
    setStatus(keyResult.status);
    setDueDate(toDateInput(keyResult.dueDate));
    setCheckInFrequency(keyResult.checkInFrequency);
    setBlockers(keyResult.blockers ?? "");
    setNotes(keyResult.notes ?? "");
  }, [keyResult, codeValue]);

  const saveEdit = async (): Promise<void> => {
    if (isSaving) return;
    if (!title.trim()) {
      setError("Key Result title is required.");
      return;
    }
    const baseline = Number(baselineValue);
    let target = Number(targetValue);
    let current = Number(currentValue);
    const progress = Number(progressPct);
    if (!Number.isFinite(baseline) || !Number.isFinite(target) || !Number.isFinite(current) || !Number.isFinite(progress)) {
      setError("Weight, metric values, and progress must be numeric.");
      return;
    }

    if (baseline < 0 || baseline > 1) {
      setError("Weight must be between 0 and 1.");
      return;
    }
    if (!dueDate) {
      setError("Due date is required.");
      return;
    }

    target = 100;
    current = Math.max(0, Math.min(100, progress));
    setIsSaving(true);
    setError("");
    const response = await fetch(apiPath(`/api/krs/${encodeURIComponent(keyResult.krKey)}`), {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-user-email": signedInEmail
      },
      body: JSON.stringify({
        title: title.trim(),
        krCode: code.trim(),
        owner: owner.trim(),
        ownerEmail: ownerEmail.trim(),
        metricType,
        baselineValue: baseline,
        targetValue: target,
        currentValue: current,
        status,
        dueDate,
        checkInFrequency,
        blockers: blockers.trim(),
        notes: notes.trim()
      })
    });

    if (!response.ok) {
      const payload = await readJson<ApiError>(response);
      setError(payload?.error ?? "Failed to update key result.");
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    setIsEditing(false);
    router.refresh();
  };

  const deleteCurrent = async (): Promise<void> => {
    if (isSaving) return;
    const warning =
      kpis.length > 0
        ? `Delete key result '${keyResult.title}'?\n\nThis permanently deletes this key result and all descendants:\n- ${kpis.length} KPIs\n- related check-ins\n\nThis action cannot be undone.`
        : `Delete key result '${keyResult.title}'?\n\nThis permanently deletes this key result and any related check-ins.\n\nThis action cannot be undone.`;
    if (!window.confirm(warning)) {
      return;
    }

    setIsSaving(true);
    setError("");
    const response = await fetch(apiPath(`/api/krs/${encodeURIComponent(keyResult.krKey)}`), {
      method: "DELETE",
      headers: {
        "x-user-email": signedInEmail
      }
    });
    if (!response.ok) {
      const payload = await readJson<ApiError>(response);
      setError(payload?.error ?? "Failed to delete key result.");
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    setIsEditing(false);
    router.refresh();
  };

  return (
    <Fragment>
      <tr className={`board-kr-row ${isEditing ? "board-kr-row-editing" : ""}`}>
        <td className="board-subitem-cell">
          <div className="objective-title-wrap">
            {isEditing ? (
              <input className="objective-row-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Key Result" autoFocus disabled={isSaving} />
            ) : (
              <span className="objective-title-text">{keyResult.title}</span>
            )}
            {!isEditing && canEdit ? (
              <button type="button" className="objective-edit-trigger" aria-label={`Edit key result ${keyResult.title}`} title="Edit key result" onClick={() => setIsEditing(true)} disabled={isSaving}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 17.25V21h3.75L18.81 8.94l-3.75-3.75L3 17.25zm17.71-10.04a1 1 0 0 0 0-1.41l-2.5-2.5a1 1 0 0 0-1.41 0l-1.96 1.96 3.75 3.75 2.12-2.1z" fill="currentColor" /></svg>
              </button>
            ) : null}
          </div>
          <div className="board-meta">{codeValue}</div>
          {!isEditing ? (
            <button type="button" className={`objective-kr-toggle ${isExpanded ? "is-open" : ""}`} aria-expanded={isExpanded} onClick={() => setIsExpanded((current) => !current)}>
              KPIs ({kpis.length})
            </button>
          ) : null}
          {isEditing ? <input className="objective-row-input" value={code} onChange={(event) => setCode(event.target.value)} disabled={isSaving} /> : null}
          {isEditing ? (
            <div className="objective-row-actions">
              <button className="btn" type="button" onClick={() => void saveEdit()} disabled={isSaving}>Save</button>
              <button className="btn btn-danger" type="button" onClick={() => void deleteCurrent()} disabled={isSaving}>Delete</button>
              <button className="tab-btn" type="button" onClick={() => setIsEditing(false)} disabled={isSaving}>Cancel</button>
            </div>
          ) : null}
          {error ? <p className="message danger objective-row-error">{error}</p> : null}
        </td>
        <td>{isEditing ? (
          <>
            <OwnerInput id={`kr-owner-inline-${keyResult.krKey}`} value={owner} onChange={setOwner} emailValue={ownerEmail} onEmailChange={setOwnerEmail} multiple disabled={isSaving} showLabel={false} inputClassName="objective-row-input" placeholder="Owner (optional)" />
            <input className="objective-row-input" value={formatOwnerEmailLabel(owner, ownerEmail)} readOnly disabled={isSaving} />
          </>
        ) : (formatOwnerLabel(keyResult.owner, keyResult.ownerEmail) || "-")}</td>
        <td>{isEditing ? <select className="objective-row-select" value={metricType} onChange={(event) => setMetricType(event.target.value as MetricType)} disabled={isSaving}>{metricTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select> : keyResult.metricType}</td>
        <td>{isEditing ? <input className="objective-row-input" type="number" step="0.01" min="0" max="1" value={baselineValue} onChange={(event) => setBaselineValue(event.target.value)} disabled={isSaving} /> : formatMetricValue(keyResult.baselineValue)}</td>
        <td>{isEditing ? <input className="objective-row-input" type="number" step="any" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} disabled={isSaving} /> : formatMetricValue(keyResult.targetValue)}</td>
        <td>{isEditing ? <input className="objective-row-input" type="number" step="any" value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} disabled={isSaving} /> : formatMetricValue(keyResult.currentValue)}</td>
        <td>{isEditing ? <input className="objective-row-input" type="number" step="any" value={progressPct} onChange={(event) => setProgressPct(event.target.value)} disabled={isSaving} /> : `${keyResult.progressPct}%`}</td>
        <td>{isEditing ? <select className="objective-row-select" value={status} onChange={(event) => setStatus(event.target.value as KrStatus)} disabled={isSaving}>{keyResultStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select> : formatStatus(keyResult.status)}</td>
        <td>{isEditing ? <input className="objective-row-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={isSaving} /> : formatDate(keyResult.dueDate)}</td>
        <td>{isEditing ? <select className="objective-row-select" value={checkInFrequency} onChange={(event) => setCheckInFrequency(event.target.value as CheckInFrequency)} disabled={isSaving}>{checkInFrequencyOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select> : formatCheckinFrequency(keyResult.checkInFrequency)}</td>
        <td>{isEditing ? <input className="objective-row-input" value={blockers} onChange={(event) => setBlockers(event.target.value)} disabled={isSaving} /> : keyResult.blockers || "-"}</td>
        <td>-</td>
        <td>{isEditing ? <input className="objective-row-input" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={isSaving} /> : keyResult.notes || "-"}</td>
        <td>{formatDate(keyResult.lastCheckinAt)}</td>
      </tr>
      {isExpanded && appProfile.key === "ease-okr" ? (
        <tr className="board-details-row">
          <td colSpan={14}>
            <div className="board-objective-details">
              <div className="board-objective-content">
                <DashboardKeyResultControls
                  objectiveKey={keyResult.objectiveKey}
                  krKey={keyResult.krKey}
                  defaultDueDate={keyResult.dueDate}
                  defaultOwner={resolveOwnerName(keyResult.owner, keyResult.ownerEmail)}
                  defaultOwnerEmail={resolveOwnerEmail(keyResult.owner, keyResult.ownerEmail)}
                  positionOwnerEmail={positionOwnerEmail}
                  adminEmails={adminEmails}
                  metricTypeOptions={metricTypeOptions}
                  keyResultStatusOptions={keyResultStatusOptions}
                  checkInFrequencyOptions={checkInFrequencyOptions}
                />
                <table className="board-subtable">
                  <thead>
                    <tr className="board-subheader-row">
                      <th>KPI</th>
                      <th>Owner</th>
                      <th>KPI Metric Type</th>
                      <th>Weight</th>
                      <th>Target Value</th>
                      <th>Current Value</th>
                      <th>KPI Progress %</th>
                      <th>KPI Status</th>
                      <th>Due Date</th>
                      <th>Check-in Frequency</th>
                      <th>Blockers</th>
                      <th>Key Risks/Dependancy</th>
                      <th>Notes</th>
                      <th>Last updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpis.length === 0 ? (
                      <tr className="board-empty-row">
                        <td colSpan={14}>No KPIs for this key result yet.</td>
                      </tr>
                    ) : (
                      kpis.map((item) => (
                        <DashboardKeyResultRowEditor
                          key={item.kpi.kpiKey}
                          kpi={item.kpi}
                          latestUpdateNotes={item.latestUpdateNotes}
                          latestUpdatedAt={item.latestUpdatedAt}
                          positionOwnerEmail={positionOwnerEmail}
                          adminEmails={adminEmails}
                          metricTypeOptions={metricTypeOptions}
                          keyResultStatusOptions={keyResultStatusOptions}
                          checkInFrequencyOptions={checkInFrequencyOptions}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}
