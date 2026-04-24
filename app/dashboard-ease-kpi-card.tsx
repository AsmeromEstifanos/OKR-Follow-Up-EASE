"use client";

import EaseCardDetailBlocks from "@/app/ease-card-detail-blocks";
import OwnerInput from "@/app/owner-input";
import useCurrentUserEmail from "@/app/use-current-user-email";
import { apiPath } from "@/lib/base-path";
import {
  formatOwnerEmailLabel,
  formatOwnerLabel,
  includesAssignedOwnerEmail,
  includesSerializedOwnerEmail,
  resolveOwnerEmail,
  resolveOwnerName
} from "@/lib/owner";
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

type ApiError = {
  error?: string;
};

function normalizeEmail(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

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

function getQuarterLabel(value: string | null): string {
  if (!value) return "Q1";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Q1";
  return `Q${Math.floor(date.getMonth() / 3) + 1}`;
}

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function readMetricValue(value: number): string {
  return value.toLocaleString();
}

function statusChipClass(status: KrStatus): string {
  if (status === "OnTrack") return "ease-chip ease-chip-green";
  if (status === "AtRisk") return "ease-chip ease-chip-amber";
  if (status === "OffTrack") return "ease-chip ease-chip-red";
  return "ease-chip ease-chip-neutral";
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function deriveProgressPct(target: number, current: number, fallback: number): number {
  if (!Number.isFinite(target) || Math.abs(target) < 0.000001) {
    return clampPercent(fallback);
  }

  return clampPercent((current / target) * 100);
}

function normalizeWeightValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return value;
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

export default function DashboardEaseKpiCard({
  kpi,
  latestUpdateNotes,
  latestUpdatedAt,
  positionOwnerEmail,
  adminEmails,
  metricTypeOptions,
  keyResultStatusOptions,
  checkInFrequencyOptions
}: Props): JSX.Element {
  const router = useRouter();
  const signedInEmail = useCurrentUserEmail();
  const normalizedUserEmail = normalizeEmail(signedInEmail);
  const isAdmin = adminEmails.map((entry) => normalizeEmail(entry)).includes(normalizedUserEmail);
  const canEdit =
    Boolean(normalizedUserEmail) &&
    (
      isAdmin ||
      includesAssignedOwnerEmail(kpi.owner, kpi.ownerEmail, normalizedUserEmail) ||
      includesSerializedOwnerEmail(positionOwnerEmail, normalizedUserEmail)
    );

  const codeValue = kpi.kpiCode ?? kpi.kpiKey;
  const effectiveNotes = kpi.notes || latestUpdateNotes || "";

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState(codeValue);
  const [title, setTitle] = useState(kpi.title);
  const [owner, setOwner] = useState(resolveOwnerName(kpi.owner, kpi.ownerEmail));
  const [ownerEmail, setOwnerEmail] = useState(resolveOwnerEmail(kpi.owner, kpi.ownerEmail));
  const [metricType, setMetricType] = useState<MetricType>(kpi.metricType);
  const [baselineValue, setBaselineValue] = useState(String(normalizeWeightValue(kpi.baselineValue)));
  const [targetValue, setTargetValue] = useState(String(kpi.targetValue));
  const [currentValue, setCurrentValue] = useState(String(kpi.currentValue));
  const [status, setStatus] = useState<KrStatus>(kpi.status);
  const [dueDate, setDueDate] = useState(toDateInput(kpi.dueDate));
  const [checkInFrequency, setCheckInFrequency] = useState<CheckInFrequency>(kpi.checkInFrequency);
  const [blockers, setBlockers] = useState(kpi.blockers ?? "");
  const [comment, setComment] = useState(kpi.comment ?? "");
  const [notes, setNotes] = useState(effectiveNotes);

  useEffect(() => {
    setCode(codeValue);
    setTitle(kpi.title);
    setOwner(resolveOwnerName(kpi.owner, kpi.ownerEmail));
    setOwnerEmail(resolveOwnerEmail(kpi.owner, kpi.ownerEmail));
    setMetricType(kpi.metricType);
    setBaselineValue(String(normalizeWeightValue(kpi.baselineValue)));
    setTargetValue(String(kpi.targetValue));
    setCurrentValue(String(kpi.currentValue));
    setStatus(kpi.status);
    setDueDate(toDateInput(kpi.dueDate));
    setCheckInFrequency(kpi.checkInFrequency);
    setBlockers(kpi.blockers ?? "");
    setComment(kpi.comment ?? "");
    setNotes(effectiveNotes);
  }, [kpi, codeValue, effectiveNotes]);

  const progressValue = deriveProgressPct(Number(targetValue), Number(currentValue), kpi.progressPct);
  const displayWeight = normalizeWeightValue(kpi.baselineValue);

  const cancelEdit = (): void => {
    setIsEditing(false);
    setError("");
    setCode(codeValue);
    setTitle(kpi.title);
    setOwner(resolveOwnerName(kpi.owner, kpi.ownerEmail));
    setOwnerEmail(resolveOwnerEmail(kpi.owner, kpi.ownerEmail));
    setMetricType(kpi.metricType);
    setBaselineValue(String(normalizeWeightValue(kpi.baselineValue)));
    setTargetValue(String(kpi.targetValue));
    setCurrentValue(String(kpi.currentValue));
    setStatus(kpi.status);
    setDueDate(toDateInput(kpi.dueDate));
    setCheckInFrequency(kpi.checkInFrequency);
    setBlockers(kpi.blockers ?? "");
    setComment(kpi.comment ?? "");
    setNotes(effectiveNotes);
  };

  const saveEdit = async (): Promise<void> => {
    if (isSaving) return;
    if (!title.trim()) {
      setError("KPI title is required.");
      return;
    }

    const baseline = Number(baselineValue);
    const target = Number(targetValue);
    const current = Number(currentValue);

    if (!Number.isFinite(baseline) || !Number.isFinite(target) || !Number.isFinite(current)) {
      setError("Weight, target, and current must be numeric.");
      return;
    }

    if (baseline < 0 || baseline > 1) {
      setError("Weight must be between 0 and 1.");
      return;
    }

    if (target <= 0) {
      setError("Target value must be greater than 0.");
      return;
    }

    if (!dueDate) {
      setError("Due date is required.");
      return;
    }

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
        comment: comment.trim(),
        notes: notes.trim()
      })
    });

    if (!response.ok) {
      const payload = await readJson<ApiError>(response);
      setError(payload?.error ?? "Failed to update KPI.");
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    setIsEditing(false);
    router.refresh();
  };

  const deleteCurrent = async (): Promise<void> => {
    if (isSaving) return;
    if (!window.confirm(`Delete KPI '${kpi.title}'? Related check-ins will also be deleted.`)) return;

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
      setError(payload?.error ?? "Failed to delete KPI.");
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    setIsEditing(false);
    router.refresh();
  };

  return (
    <article className="ease-kpi-card">
      <div className="ease-kpi-head">
        <div className="ease-kpi-title-block">
          <div className="ease-code-badge">{codeValue}</div>
          {isEditing ? (
            <textarea
              className="objective-row-input ease-title-textarea"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="KPI"
              autoFocus
              disabled={isSaving}
            />
          ) : (
            <h5>{kpi.title}</h5>
          )}
          {!isEditing ? (
            <EaseCardDetailBlocks note={effectiveNotes} blockers={blockers} comment={comment} />
          ) : null}
        </div>
        <div className="ease-card-head-side">
          <span className={statusChipClass(isEditing ? status : kpi.status)}>
            {formatStatus(isEditing ? status : kpi.status)}
          </span>
          <div className="ease-progress-ring ease-progress-ring-kpi" style={{ "--progress": `${progressValue}%` } as React.CSSProperties}>
            <span>{Math.round(progressValue)}%</span>
          </div>
        </div>
      </div>
      {!isEditing ? (
        <div className="ease-kpi-meta">
          <span className="ease-chip ease-chip-neutral">{formatOwnerLabel(kpi.owner, kpi.ownerEmail) || "-"}</span>
          <span className="ease-chip ease-chip-neutral">{kpi.metricType}</span>
          <span className="ease-chip ease-chip-neutral">{formatCheckinFrequency(kpi.checkInFrequency)}</span>
          <span className="ease-chip ease-chip-neutral">{getQuarterLabel(kpi.dueDate)}</span>
        </div>
      ) : null}
      <div className="ease-progress-bar">
        <span style={{ width: `${progressValue}%` }} />
      </div>
      {isEditing ? (
        <div className="ease-edit-grid">
          <input className="objective-row-input" value={code} onChange={(event) => setCode(event.target.value)} disabled={isSaving} />
          <OwnerInput
            id={`ease-kpi-owner-${kpi.kpiKey}`}
            label="Owner (optional)"
            value={owner}
            onChange={setOwner}
            emailValue={ownerEmail}
            onEmailChange={setOwnerEmail}
            multiple
            disabled={isSaving}
            className="ease-edit-span"
          />
          <div className="field ease-edit-span">
            <label>Owner Email</label>
            <input className="objective-row-input" value={formatOwnerEmailLabel(owner, ownerEmail)} readOnly disabled={isSaving} />
          </div>
          <div className="field">
            <label>Metric Type</label>
            <select className="objective-row-select" value={metricType} onChange={(event) => setMetricType(event.target.value as MetricType)} disabled={isSaving}>
              {metricTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Weight</label>
            <input className="objective-row-input" type="number" step="0.01" min="0" max="1" value={baselineValue} onChange={(event) => setBaselineValue(event.target.value)} disabled={isSaving} />
          </div>
          <div className="field">
            <label>Target Value</label>
            <input className="objective-row-input" type="number" step="any" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} disabled={isSaving} />
          </div>
          <div className="field">
            <label>Current Value</label>
            <input className="objective-row-input" type="number" step="any" value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} disabled={isSaving} />
          </div>
          <div className="field">
            <label>Progress %</label>
            <input className="objective-row-input" type="number" step="any" value={String(Math.round(progressValue * 100) / 100)} readOnly disabled />
          </div>
          <div className="field">
            <label>Status</label>
            <select className="objective-row-select" value={status} onChange={(event) => setStatus(event.target.value as KrStatus)} disabled={isSaving}>
              {keyResultStatusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Due Date</label>
            <input className="objective-row-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={isSaving} />
          </div>
          <div className="field">
            <label>Check-in Frequency</label>
            <select className="objective-row-select" value={checkInFrequency} onChange={(event) => setCheckInFrequency(event.target.value as CheckInFrequency)} disabled={isSaving}>
              {checkInFrequencyOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="field ease-edit-span">
            <label>Blockers</label>
            <textarea value={blockers} onChange={(event) => setBlockers(event.target.value)} disabled={isSaving} />
          </div>
          <div className="field ease-edit-span">
            <label>Comment</label>
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} disabled={isSaving} />
          </div>
          <div className="field ease-edit-span">
            <label>Notes</label>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={isSaving} />
          </div>
        </div>
      ) : (
        <div className="ease-footer-line">
          <span>Progress: {readMetricValue(kpi.currentValue)} / {readMetricValue(kpi.targetValue)}</span>
          <span>Weight: {readMetricValue(displayWeight)}</span>
          <span>Due Date: {formatDate(kpi.dueDate)}</span>
          <span>Last Updated: {formatDate(latestUpdatedAt ?? kpi.lastCheckinAt)}</span>
        </div>
      )}
      {canEdit ? (
        <div className="ease-card-actions">
          {isEditing ? (
            <>
              <button className="btn" type="button" onClick={() => void saveEdit()} disabled={isSaving}>Save</button>
              <button className="btn btn-danger" type="button" onClick={() => void deleteCurrent()} disabled={isSaving}>Delete</button>
              <button className="tab-btn" type="button" onClick={cancelEdit} disabled={isSaving}>Cancel</button>
            </>
          ) : (
            <button className="tab-btn" type="button" onClick={() => setIsEditing(true)} disabled={isSaving}>Edit KPI</button>
          )}
        </div>
      ) : null}
      {error ? <p className="message danger">{error}</p> : null}
    </article>
  );
}
