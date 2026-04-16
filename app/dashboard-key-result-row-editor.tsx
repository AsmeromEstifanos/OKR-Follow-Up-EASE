"use client";

import OwnerInput from "@/app/owner-input";
import useCurrentUserEmail from "@/app/use-current-user-email";
import { apiPath } from "@/lib/base-path";
import { resolveOwnerEmail, resolveOwnerName } from "@/lib/owner";
import type { CheckInFrequency, Kpi, KrStatus, MetricType } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  kpi: Kpi;
  latestUpdateNotes?: string;
  latestUpdatedAt?: string | null;
  positionOwnerEmail?: string;
  adminEmails: string[];
  metricTypeOptions: MetricType[];
  keyResultStatusOptions: KrStatus[];
  checkInFrequencyOptions: CheckInFrequency[];
};

type ApiError = { error?: string };
type OwnerSuggestion = { displayName: string; principalName: string; mail: string };

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

export default function DashboardKeyResultRowEditor({
  kpi,
  latestUpdateNotes,
  latestUpdatedAt,
  positionOwnerEmail,
  adminEmails,
  metricTypeOptions,
  keyResultStatusOptions,
  checkInFrequencyOptions
}: Props): JSX.Element {
  const itemLabel = "KPI";
  const router = useRouter();
  const signedInEmail = useCurrentUserEmail();
  const codeValue = kpi.kpiCode ?? kpi.kpiKey;

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState(codeValue);
  const [title, setTitle] = useState(kpi.title);
  const [owner, setOwner] = useState(resolveOwnerName(kpi.owner));
  const [ownerEmail, setOwnerEmail] = useState(resolveOwnerEmail(kpi.owner, kpi.ownerEmail));
  const [metricType, setMetricType] = useState<MetricType>(kpi.metricType);
  const [baselineValue, setBaselineValue] = useState(String(kpi.baselineValue));
  const [targetValue, setTargetValue] = useState(String(kpi.targetValue));
  const [currentValue, setCurrentValue] = useState(String(kpi.currentValue));
  const [progressPct, setProgressPct] = useState(String(kpi.progressPct));
  const [status, setStatus] = useState<KrStatus>(kpi.status);
  const [dueDate, setDueDate] = useState(toDateInput(kpi.dueDate));
  const [checkInFrequency, setCheckInFrequency] = useState<CheckInFrequency>(kpi.checkInFrequency);
  const [blockers, setBlockers] = useState(kpi.blockers ?? "");
  const [notes, setNotes] = useState(kpi.notes || latestUpdateNotes || "");

  const normalizedOwnerEmail = normalizeEmail(resolveOwnerEmail(kpi.owner, kpi.ownerEmail));
  const normalizedPositionOwnerEmail = normalizeEmail(positionOwnerEmail);
  const normalizedUserEmail = normalizeEmail(signedInEmail);
  const isAdmin = adminEmails.map((entry) => normalizeEmail(entry)).includes(normalizedUserEmail);
  const canEdit =
    Boolean(normalizedUserEmail) &&
    (isAdmin || normalizedOwnerEmail === normalizedUserEmail || normalizedPositionOwnerEmail === normalizedUserEmail);

  useEffect(() => {
    setCode(codeValue);
    setTitle(kpi.title);
    setOwner(resolveOwnerName(kpi.owner));
    setOwnerEmail(resolveOwnerEmail(kpi.owner, kpi.ownerEmail));
    setMetricType(kpi.metricType);
    setBaselineValue(String(kpi.baselineValue));
    setTargetValue(String(kpi.targetValue));
    setCurrentValue(String(kpi.currentValue));
    setProgressPct(String(kpi.progressPct));
    setStatus(kpi.status);
    setDueDate(toDateInput(kpi.dueDate));
    setCheckInFrequency(kpi.checkInFrequency);
    setBlockers(kpi.blockers ?? "");
    setNotes(kpi.notes || latestUpdateNotes || "");
  }, [kpi, codeValue, latestUpdateNotes]);

  const cancelEdit = (): void => {
    setError("");
    setIsEditing(false);
  };

  const saveEdit = async (): Promise<void> => {
    if (isSaving) return;
    if (!title.trim()) {
      setError(`${itemLabel} title is required.`);
      return;
    }

    const baseline = Number(baselineValue);
    const target = Number(targetValue);
    let current = Number(currentValue);
    if (!Number.isFinite(baseline) || !Number.isFinite(target) || !Number.isFinite(current)) {
      setError("Baseline, target, and current values must be numbers.");
      return;
    }

    if (!dueDate) {
      setError("Due date is required.");
      return;
    }

    const progress = Number(progressPct);
    if (!Number.isFinite(progress)) {
      setError("Progress % must be numeric.");
      return;
    }
    current = baseline + ((target - baseline) * progress) / 100;

    setIsSaving(true);
    setError("");
    const response = await fetch(apiPath(`/api/kpis/${encodeURIComponent(kpi.kpiKey)}`), {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-user-email": signedInEmail
      },
      body: JSON.stringify({
        title: title.trim(),
        kpiCode: code.trim(),
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
      setError(payload?.error ?? `Failed to update ${itemLabel.toLowerCase()}.`);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    setIsEditing(false);
    router.refresh();
  };

  const deleteCurrent = async (): Promise<void> => {
    if (isSaving) return;
    if (!window.confirm(`Delete ${itemLabel.toLowerCase()} '${kpi.title}'? Related check-ins will also be deleted.`)) {
      return;
    }

    setIsSaving(true);
    setError("");
    const response = await fetch(apiPath(`/api/kpis/${encodeURIComponent(kpi.kpiKey)}`), {
      method: "DELETE",
      headers: {
        "x-user-email": signedInEmail
      }
    });

    if (!response.ok) {
      const payload = await readJson<ApiError>(response);
      setError(payload?.error ?? `Failed to delete ${itemLabel.toLowerCase()}.`);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    setIsEditing(false);
    router.refresh();
  };

  return (
    <tr className={`board-kr-row ${isEditing ? "board-kr-row-editing" : ""}`}>
      <td className="board-subitem-cell">
        <div className="objective-title-wrap">
          {isEditing ? (
            <input className="objective-row-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={itemLabel} autoFocus disabled={isSaving} />
          ) : (
            <span className="objective-title-text">{kpi.title}</span>
          )}
          {!isEditing && canEdit ? (
            <button type="button" className="objective-edit-trigger" aria-label={`Edit ${itemLabel.toLowerCase()} ${kpi.title}`} title={`Edit ${itemLabel.toLowerCase()}`} onClick={() => setIsEditing(true)} disabled={isSaving}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 17.25V21h3.75L18.81 8.94l-3.75-3.75L3 17.25zm17.71-10.04a1 1 0 0 0 0-1.41l-2.5-2.5a1 1 0 0 0-1.41 0l-1.96 1.96 3.75 3.75 2.12-2.1z" fill="currentColor" /></svg>
            </button>
          ) : null}
        </div>
        <div className="board-meta">{codeValue}</div>
        {isEditing ? <input className="objective-row-input" value={code} onChange={(event) => setCode(event.target.value)} disabled={isSaving} /> : null}
        {isEditing ? (
          <div className="objective-row-actions">
            <button className="btn" type="button" onClick={() => void saveEdit()} disabled={isSaving}>Save</button>
            <button className="btn btn-danger" type="button" onClick={() => void deleteCurrent()} disabled={isSaving}>Delete</button>
            <button className="tab-btn" type="button" onClick={cancelEdit} disabled={isSaving}>Cancel</button>
          </div>
        ) : null}
        {error ? <p className="message danger objective-row-error">{error}</p> : null}
      </td>
      <td>
        {isEditing ? (
          <>
            <OwnerInput id={`kpi-owner-inline-${kpi.kpiKey}`} value={owner} onChange={setOwner} onSelectUser={(user: OwnerSuggestion | null) => setOwnerEmail(user ? user.mail || user.principalName : "")} disabled={isSaving} showLabel={false} inputClassName="objective-row-input" placeholder="Owner (optional)" />
            <input className="objective-row-input" value={ownerEmail} readOnly disabled={isSaving} aria-label={`Owner email for ${kpi.title}`} />
          </>
        ) : (
          kpi.owner || "-"
        )}
      </td>
      <td>{isEditing ? <select className="objective-row-select" value={metricType} onChange={(event) => setMetricType(event.target.value as MetricType)} disabled={isSaving}>{metricTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select> : kpi.metricType}</td>
      <td>{isEditing ? <input className="objective-row-input" type="number" step="any" value={baselineValue} onChange={(event) => setBaselineValue(event.target.value)} disabled={isSaving} /> : formatMetricValue(kpi.baselineValue)}</td>
      <td>{isEditing ? <input className="objective-row-input" type="number" step="any" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} disabled={isSaving} /> : formatMetricValue(kpi.targetValue)}</td>
      <td>{isEditing ? <input className="objective-row-input" type="number" step="any" value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} disabled={isSaving} /> : formatMetricValue(kpi.currentValue)}</td>
      <td>{isEditing ? <input className="objective-row-input" type="number" step="any" value={progressPct} onChange={(event) => setProgressPct(event.target.value)} disabled={isSaving} /> : `${kpi.progressPct}%`}</td>
      <td>{isEditing ? <select className="objective-row-select" value={status} onChange={(event) => setStatus(event.target.value as KrStatus)} disabled={isSaving}>{keyResultStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select> : formatStatus(kpi.status)}</td>
      <td>{isEditing ? <input className="objective-row-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={isSaving} /> : formatDate(kpi.dueDate)}</td>
      <td>{isEditing ? <select className="objective-row-select" value={checkInFrequency} onChange={(event) => setCheckInFrequency(event.target.value as CheckInFrequency)} disabled={isSaving}>{checkInFrequencyOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select> : formatCheckinFrequency(kpi.checkInFrequency)}</td>
      <td>{isEditing ? <input className="objective-row-input" value={blockers} onChange={(event) => setBlockers(event.target.value)} disabled={isSaving} /> : kpi.blockers || "-"}</td>
      <td>-</td>
      <td>{isEditing ? <input className="objective-row-input" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={isSaving} /> : kpi.notes || latestUpdateNotes || "-"}</td>
      <td>{formatDate(latestUpdatedAt ?? kpi.lastCheckinAt)}</td>
    </tr>
  );
}
