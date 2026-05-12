"use client";

import EaseCardDetailBlocks from "@/app/ease-card-detail-blocks";
import OwnerInput from "@/app/owner-input";
import useCurrentUserEmail from "@/app/use-current-user-email";
import { useSearchQuery } from "@/app/search-context";
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
import { useEffect, useRef, useState } from "react";

function ChevronIcon({ open }: { open: boolean }): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ transition: "transform 0.18s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
      <polyline points="2,5 7,10 12,5" />
    </svg>
  );
}

type Props = {
  kpi: Kpi;
  latestUpdateNotes?: string;
  latestUpdatedAt?: string | null;
  forcedBodyOpen?: boolean;
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

function HighlightText({ text }: { text: string }): JSX.Element {
  const query = useSearchQuery().trim().toLowerCase();
  if (!query) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const idx = remaining.toLowerCase().indexOf(query);
    if (idx === -1) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
    if (idx > 0) parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>);
    parts.push(
      <mark key={key++} className="search-highlight">
        {remaining.slice(idx, idx + query.length)}
      </mark>
    );
    remaining = remaining.slice(idx + query.length);
  }

  return <>{parts}</>;
}

export default function DashboardEaseKpiCard({
  kpi,
  latestUpdateNotes,
  latestUpdatedAt,
  forcedBodyOpen,
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

  const [isBodyOpen, setIsBodyOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isDialogEditing, setIsDialogEditing] = useState(false);
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

  const dialogRef = useRef<HTMLDialogElement>(null);
  const hasDetails = !!(effectiveNotes.trim() || kpi.blockers?.trim() || kpi.comment?.trim());

  useEffect(() => {
    if (typeof forcedBodyOpen === "boolean") setIsBodyOpen(forcedBodyOpen);
  }, [forcedBodyOpen]);

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

  const showBody = isBodyOpen || isEditing;
  const progressValue = deriveProgressPct(Number(targetValue), Number(currentValue), kpi.progressPct);
  const displayWeight = normalizeWeightValue(kpi.baselineValue);

  const cancelEdit = (): void => {
    setIsEditing(false);
    setIsDialogEditing(false);
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

  const openDetails = (): void => { cancelEdit(); dialogRef.current?.showModal(); };
  const closeDetails = (): void => { cancelEdit(); dialogRef.current?.close(); };

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
    setIsDialogEditing(false);
    dialogRef.current?.close();
    router.refresh();
  };

  const deleteCurrent = async (): Promise<void> => {
    if (isSaving) return;
    if (!window.confirm(`Delete KPI '${kpi.title}'?\n\nThis permanently deletes this KPI and all related check-ins.\n\nThis action cannot be undone.`)) return;

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
    setIsDialogEditing(false);
    dialogRef.current?.close();
    router.refresh();
  };

  return (
    <article className="ease-kpi-card">
      <div className="ease-kr-layout">
        {/* Left: all content */}
        <div className="ease-kr-content">
          {/* Clickable header: badge + title */}
          <div
            className={!isEditing ? "ease-card-head-clickable" : undefined}
            onClick={!isEditing ? () => setIsBodyOpen((v) => !v) : undefined}
            role={!isEditing ? "button" : undefined}
            tabIndex={!isEditing ? 0 : undefined}
            onKeyDown={!isEditing ? (e) => { if (e.key === "Enter" || e.key === " ") setIsBodyOpen((v) => !v); } : undefined}
            aria-expanded={!isEditing ? showBody : undefined}
          >
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
              <div className="ease-kr-title-row">
                {hasDetails ? (
                  <button
                    type="button"
                    className="ease-title-btn"
                    onClick={(e) => { e.stopPropagation(); openDetails(); }}
                    title="Click to view details"
                  >
                    <h5><HighlightText text={kpi.title} /></h5>
                  </button>
                ) : (
                  <h5 onClick={(e) => e.stopPropagation()}><HighlightText text={kpi.title} /></h5>
                )}
                {hasDetails ? <span className="ease-has-details-dot" aria-hidden="true" /> : null}
              </div>
            )}
          </div>

          {showBody && (
            <>
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
                  <OwnerInput id={`ease-kpi-owner-${kpi.kpiKey}`} label="Owner (optional)" value={owner} onChange={setOwner} emailValue={ownerEmail} onEmailChange={setOwnerEmail} multiple disabled={isSaving} className="ease-edit-span" />
                  <div className="field ease-edit-span"><label>Owner Email</label><input className="objective-row-input" value={formatOwnerEmailLabel(owner, ownerEmail)} readOnly disabled={isSaving} /></div>
                  <div className="field"><label>Metric Type</label><select className="objective-row-select" value={metricType} onChange={(event) => setMetricType(event.target.value as MetricType)} disabled={isSaving}>{metricTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
                  <div className="field"><label>Weight</label><input className="objective-row-input" type="number" step="0.01" min="0" max="1" value={baselineValue} onChange={(event) => setBaselineValue(event.target.value)} disabled={isSaving} /></div>
                  <div className="field"><label>Target Value</label><input className="objective-row-input" type="number" step="any" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} disabled={isSaving} /></div>
                  <div className="field"><label>Current Value</label><input className="objective-row-input" type="number" step="any" value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} disabled={isSaving} /></div>
                  <div className="field"><label>Progress %</label><input className="objective-row-input" type="number" step="any" value={String(Math.round(progressValue * 100) / 100)} readOnly disabled /></div>
                  <div className="field"><label>Status</label><select className="objective-row-select" value={status} onChange={(event) => setStatus(event.target.value as KrStatus)} disabled={isSaving}>{keyResultStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
                  <div className="field"><label>Due Date</label><input className="objective-row-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={isSaving} /></div>
                  <div className="field"><label>Check-in Frequency</label><select className="objective-row-select" value={checkInFrequency} onChange={(event) => setCheckInFrequency(event.target.value as CheckInFrequency)} disabled={isSaving}>{checkInFrequencyOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
                  <div className="field ease-edit-span"><label>Blockers</label><textarea value={blockers} onChange={(event) => setBlockers(event.target.value)} disabled={isSaving} /></div>
                  <div className="field ease-edit-span"><label>Comment</label><textarea value={comment} onChange={(event) => setComment(event.target.value)} disabled={isSaving} /></div>
                  <div className="field ease-edit-span"><label>Notes</label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={isSaving} /></div>
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
            </>
          )}
        </div>

        {/* Right sidebar: status chip, progress ring, chevron */}
        <div className="ease-kr-sidebar">
          <span className={statusChipClass(isEditing ? status : kpi.status)}>
            {formatStatus(isEditing ? status : kpi.status)}
          </span>
          <div className="ease-progress-ring ease-progress-ring-kpi" style={{ "--progress": `${progressValue}%` } as React.CSSProperties}>
            <span>{Math.round(progressValue)}%</span>
          </div>
          <button type="button" className="card-chevron-btn" onClick={() => setIsBodyOpen((v) => !v)} aria-expanded={showBody} aria-label={showBody ? "Collapse" : "Expand"}>
            <ChevronIcon open={showBody} />
          </button>
        </div>
      </div>

      {/* Details popup — always in DOM */}
      <dialog
        ref={dialogRef}
        className="okr-details-dialog"
        onClick={(e) => { if (e.target === e.currentTarget) closeDetails(); }}
      >
        <div className="okr-details-inner">
          <div className="okr-details-header">
            <div className="okr-details-title-area">
              <div className="ease-code-badge">{codeValue}</div>
              {isDialogEditing ? (
                <textarea
                  className="objective-row-input ease-title-textarea okr-details-title-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isSaving}
                  autoFocus
                />
              ) : (
                <h5 className="okr-details-title">{kpi.title}</h5>
              )}
            </div>
            <div className="okr-details-header-actions">
              {!isDialogEditing && canEdit && (
                <button type="button" className="tab-btn" onClick={() => setIsDialogEditing(true)} disabled={isSaving}>Edit</button>
              )}
              <button type="button" className="okr-details-close" onClick={closeDetails} aria-label="Close">✕</button>
            </div>
          </div>

          {isDialogEditing ? (
            <>
              <div className="ease-edit-grid okr-dialog-edit-grid">
                <input className="objective-row-input" value={code} onChange={(e) => setCode(e.target.value)} disabled={isSaving} placeholder="KPI Code" />
                <OwnerInput id={`dialog-kpi-owner-${kpi.kpiKey}`} label="Owner (optional)" value={owner} onChange={setOwner} emailValue={ownerEmail} onEmailChange={setOwnerEmail} multiple disabled={isSaving} className="ease-edit-span" />
                <div className="field ease-edit-span"><label>Owner Email</label><input className="objective-row-input" value={formatOwnerEmailLabel(owner, ownerEmail)} readOnly disabled={isSaving} /></div>
                <div className="field"><label>Metric Type</label><select className="objective-row-select" value={metricType} onChange={(e) => setMetricType(e.target.value as MetricType)} disabled={isSaving}>{metricTypeOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
                <div className="field"><label>Weight</label><input className="objective-row-input" type="number" step="0.01" min="0" max="1" value={baselineValue} onChange={(e) => setBaselineValue(e.target.value)} disabled={isSaving} /></div>
                <div className="field"><label>Target Value</label><input className="objective-row-input" type="number" step="any" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} disabled={isSaving} /></div>
                <div className="field"><label>Current Value</label><input className="objective-row-input" type="number" step="any" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} disabled={isSaving} /></div>
                <div className="field"><label>Progress %</label><input className="objective-row-input" type="number" value={String(Math.round(progressValue * 100) / 100)} readOnly disabled /></div>
                <div className="field"><label>Status</label><select className="objective-row-select" value={status} onChange={(e) => setStatus(e.target.value as KrStatus)} disabled={isSaving}>{keyResultStatusOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
                <div className="field"><label>Due Date</label><input className="objective-row-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={isSaving} /></div>
                <div className="field"><label>Check-in Frequency</label><select className="objective-row-select" value={checkInFrequency} onChange={(e) => setCheckInFrequency(e.target.value as CheckInFrequency)} disabled={isSaving}>{checkInFrequencyOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
                <div className="field ease-edit-span"><label>Blockers</label><textarea value={blockers} onChange={(e) => setBlockers(e.target.value)} disabled={isSaving} /></div>
                <div className="field ease-edit-span"><label>Comment</label><textarea value={comment} onChange={(e) => setComment(e.target.value)} disabled={isSaving} /></div>
                <div className="field ease-edit-span"><label>Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isSaving} /></div>
              </div>
              {error ? <p className="message danger">{error}</p> : null}
              <div className="okr-dialog-actions">
                <button className="btn" type="button" onClick={() => void saveEdit()} disabled={isSaving}>Save</button>
                <button className="btn btn-danger" type="button" onClick={() => void deleteCurrent()} disabled={isSaving}>Delete</button>
                <button className="tab-btn" type="button" onClick={cancelEdit} disabled={isSaving}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className="okr-details-fields">
                <span className={statusChipClass(kpi.status)}>{formatStatus(kpi.status)}</span>
                <span className="ease-chip ease-chip-neutral">{formatOwnerLabel(kpi.owner, kpi.ownerEmail) || "-"}</span>
                <span className="ease-chip ease-chip-neutral">Due: {formatDate(kpi.dueDate)}</span>
                <span className="ease-chip ease-chip-neutral">Weight: {displayWeight}</span>
                <span className="ease-chip ease-chip-neutral">{kpi.metricType}</span>
                <span className="ease-chip ease-chip-neutral">{formatCheckinFrequency(kpi.checkInFrequency)}</span>
                <span className="ease-chip ease-chip-neutral">Target: {readMetricValue(kpi.targetValue)}</span>
                <span className="ease-chip ease-chip-neutral">Current: {readMetricValue(kpi.currentValue)}</span>
                <span className="ease-chip ease-chip-neutral">Progress: {Math.round(progressValue)}%</span>
              </div>
              <EaseCardDetailBlocks note={effectiveNotes} blockers={kpi.blockers} comment={kpi.comment} />
              {!effectiveNotes.trim() && !kpi.blockers?.trim() && !kpi.comment?.trim() ? (
                <p className="meta">No additional details.</p>
              ) : null}
            </>
          )}
        </div>
      </dialog>
    </article>
  );
}
