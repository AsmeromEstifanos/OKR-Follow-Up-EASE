"use client";

import EaseCardDetailBlocks from "@/app/ease-card-detail-blocks";
import DashboardEaseKpiCard from "@/app/dashboard-ease-kpi-card";
import DashboardKeyResultControls from "@/app/dashboard-key-result-controls";
import OwnerInput from "@/app/owner-input";
import useCurrentUserEmail from "@/app/use-current-user-email";
import WeightGroupControls from "@/app/weight-group-controls";
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
import type { CheckInFrequency, Kpi, KeyResult, KrStatus, MetricType } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type KpiRowData = {
  kpi: Kpi;
  latestUpdateNotes?: string;
  latestUpdatedAt?: string | null;
};

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
  keyResult: KeyResult;
  kpis: KpiRowData[];
  latestUpdatedAt?: string | null;
  forcedKpiSectionOpen?: boolean;
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

export default function DashboardEaseKrCard({
  keyResult,
  kpis,
  latestUpdatedAt,
  forcedKpiSectionOpen,
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
      includesAssignedOwnerEmail(keyResult.owner, keyResult.ownerEmail, normalizedUserEmail) ||
      includesSerializedOwnerEmail(positionOwnerEmail, normalizedUserEmail)
    );

  const codeValue = keyResult.krCode ?? keyResult.krKey;

  const [isBodyOpen, setIsBodyOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isDialogEditing, setIsDialogEditing] = useState(false);
  const [isKpiSectionOpen, setIsKpiSectionOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState(codeValue);
  const [title, setTitle] = useState(keyResult.title);
  const [owner, setOwner] = useState(resolveOwnerName(keyResult.owner, keyResult.ownerEmail));
  const [ownerEmail, setOwnerEmail] = useState(resolveOwnerEmail(keyResult.owner, keyResult.ownerEmail));
  const [metricType, setMetricType] = useState<MetricType>(keyResult.metricType);
  const [baselineValue, setBaselineValue] = useState(String(normalizeWeightValue(keyResult.baselineValue)));
  const [status, setStatus] = useState<KrStatus>(keyResult.status);
  const [dueDate, setDueDate] = useState(toDateInput(keyResult.dueDate));
  const [checkInFrequency, setCheckInFrequency] = useState<CheckInFrequency>(keyResult.checkInFrequency);
  const [blockers, setBlockers] = useState(keyResult.blockers ?? "");
  const [comment, setComment] = useState(keyResult.comment ?? "");
  const [notes, setNotes] = useState(keyResult.notes ?? "");

  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setCode(codeValue);
    setTitle(keyResult.title);
    setOwner(resolveOwnerName(keyResult.owner, keyResult.ownerEmail));
    setOwnerEmail(resolveOwnerEmail(keyResult.owner, keyResult.ownerEmail));
    setMetricType(keyResult.metricType);
    setBaselineValue(String(normalizeWeightValue(keyResult.baselineValue)));
    setStatus(keyResult.status);
    setDueDate(toDateInput(keyResult.dueDate));
    setCheckInFrequency(keyResult.checkInFrequency);
    setBlockers(keyResult.blockers ?? "");
    setComment(keyResult.comment ?? "");
    setNotes(keyResult.notes ?? "");
  }, [keyResult, codeValue]);

  useEffect(() => {
    if (typeof forcedKpiSectionOpen === "boolean") {
      setIsKpiSectionOpen(forcedKpiSectionOpen);
    }
  }, [forcedKpiSectionOpen]);

  useEffect(() => {
    if (typeof forcedBodyOpen === "boolean") setIsBodyOpen(forcedBodyOpen);
  }, [forcedBodyOpen]);

  const showBody = isBodyOpen || isEditing;
  const progressValue = clampPercent(keyResult.progressPct);
  const displayWeight = normalizeWeightValue(keyResult.baselineValue);

  const hasDetails = !!(keyResult.notes?.trim() || keyResult.blockers?.trim() || keyResult.comment?.trim());

  const cancelEdit = (): void => {
    setIsEditing(false);
    setIsDialogEditing(false);
    setError("");
    setCode(codeValue);
    setTitle(keyResult.title);
    setOwner(resolveOwnerName(keyResult.owner, keyResult.ownerEmail));
    setOwnerEmail(resolveOwnerEmail(keyResult.owner, keyResult.ownerEmail));
    setMetricType(keyResult.metricType);
    setBaselineValue(String(normalizeWeightValue(keyResult.baselineValue)));
    setStatus(keyResult.status);
    setDueDate(toDateInput(keyResult.dueDate));
    setCheckInFrequency(keyResult.checkInFrequency);
    setBlockers(keyResult.blockers ?? "");
    setComment(keyResult.comment ?? "");
    setNotes(keyResult.notes ?? "");
  };

  const openDetails = (): void => {
    cancelEdit();
    dialogRef.current?.showModal();
  };

  const closeDetails = (): void => {
    cancelEdit();
    dialogRef.current?.close();
  };

  const saveEdit = async (): Promise<void> => {
    if (isSaving) return;
    if (!title.trim()) {
      setError("Key result title is required.");
      return;
    }

    const baseline = Number(baselineValue);
    if (!Number.isFinite(baseline)) {
      setError("Weight must be numeric.");
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
      setError(payload?.error ?? "Failed to update key result.");
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
    const warning =
      kpis.length > 0
        ? `Delete key result '${keyResult.title}'?\n\nThis permanently deletes this key result and all descendants:\n- ${kpis.length} KPIs\n- related check-ins\n\nThis action cannot be undone.`
        : `Delete key result '${keyResult.title}'?\n\nThis permanently deletes this key result and any related check-ins.\n\nThis action cannot be undone.`;
    if (!window.confirm(warning)) return;

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
    setIsDialogEditing(false);
    dialogRef.current?.close();
    router.refresh();
  };

  return (
    <article
      className="ease-kr-card"
      onClick={!isEditing ? () => setIsBodyOpen((v) => !v) : undefined}
      style={!isEditing ? { cursor: "pointer" } : undefined}
    >
      <div className="ease-kr-layout">
        {/* Left: all content */}
        <div className="ease-kr-content">
          {/* Header: badge + title */}
          <div className="ease-kr-header">
            <div className="ease-code-badge">{codeValue}</div>
            {isEditing ? (
              <textarea
                className="objective-row-input ease-title-textarea"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Key Result"
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
                    <h4><HighlightText text={keyResult.title} /></h4>
                  </button>
                ) : (
                  <h4 onClick={(e) => e.stopPropagation()}><HighlightText text={keyResult.title} /></h4>
                )}
                {hasDetails ? <span className="ease-has-details-dot" aria-hidden="true" /> : null}
              </div>
            )}
          </div>

          {showBody && (
            <>
              {!isEditing ? (
                <>
                  <div className="ease-kr-meta">
                    <span className="ease-chip ease-chip-neutral">{formatOwnerLabel(keyResult.owner, keyResult.ownerEmail) || "-"}</span>
                    <span className="ease-chip ease-chip-neutral">{keyResult.metricType}</span>
                    <span className="ease-chip ease-chip-neutral">{formatCheckinFrequency(keyResult.checkInFrequency)}</span>
                    <span className="ease-chip ease-chip-neutral">{getQuarterLabel(keyResult.dueDate)}</span>
                  </div>
                  <div className="ease-footer-line">
                    <span>Weight: {displayWeight}</span>
                    <span>Due Date: {formatDate(keyResult.dueDate)}</span>
                    <span>Last Updated: {formatDate(latestUpdatedAt ?? keyResult.lastCheckinAt)}</span>
                  </div>
                </>
              ) : (
                <div className="ease-edit-grid" onClick={(e) => e.stopPropagation()}>
                  <input className="objective-row-input" value={code} onChange={(event) => setCode(event.target.value)} disabled={isSaving} />
                  <OwnerInput id={`ease-kr-owner-${keyResult.krKey}`} label="Owner (optional)" value={owner} onChange={setOwner} emailValue={ownerEmail} onEmailChange={setOwnerEmail} multiple disabled={isSaving} className="ease-edit-span" />
                  <div className="field ease-edit-span"><label>Owner Email</label><input className="objective-row-input" value={formatOwnerEmailLabel(owner, ownerEmail)} readOnly disabled={isSaving} /></div>
                  <div className="field"><label>Metric Type</label><select className="objective-row-select" value={metricType} onChange={(event) => setMetricType(event.target.value as MetricType)} disabled={isSaving}>{metricTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
                  <div className="field"><label>Weight</label><input className="objective-row-input" type="number" step="0.01" min="0" max="1" value={baselineValue} onChange={(event) => setBaselineValue(event.target.value)} disabled={isSaving} /></div>
                  <div className="field"><label>Progress %</label><input className="objective-row-input" type="number" step="any" value={String(Math.round(progressValue * 100) / 100)} readOnly disabled /></div>
                  <div className="field"><label>Status</label><select className="objective-row-select" value={status} onChange={(event) => setStatus(event.target.value as KrStatus)} disabled={isSaving}>{keyResultStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
                  <div className="field"><label>Due Date</label><input className="objective-row-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={isSaving} /></div>
                  <div className="field"><label>Check-in Frequency</label><select className="objective-row-select" value={checkInFrequency} onChange={(event) => setCheckInFrequency(event.target.value as CheckInFrequency)} disabled={isSaving}>{checkInFrequencyOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
                  <div className="field ease-edit-span"><label>Blockers</label><textarea value={blockers} onChange={(event) => setBlockers(event.target.value)} disabled={isSaving} /></div>
                  <div className="field ease-edit-span"><label>Comment</label><textarea value={comment} onChange={(event) => setComment(event.target.value)} disabled={isSaving} /></div>
                  <div className="field ease-edit-span"><label>Notes</label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={isSaving} /></div>
                </div>
              )}
              {canEdit ? (
                <div className="ease-card-actions">
                  {isEditing ? (
                    <>
                      <button className="btn" type="button" onClick={(e) => { e.stopPropagation(); void saveEdit(); }} disabled={isSaving}>Save</button>
                      <button className="btn btn-danger" type="button" onClick={(e) => { e.stopPropagation(); void deleteCurrent(); }} disabled={isSaving}>Delete</button>
                      <button className="tab-btn" type="button" onClick={(e) => { e.stopPropagation(); cancelEdit(); }} disabled={isSaving}>Cancel</button>
                    </>
                  ) : (
                    <button className="tab-btn" type="button" onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} disabled={isSaving}>Edit Key Result</button>
                  )}
                </div>
              ) : null}
              {error ? <p className="message danger">{error}</p> : null}
            </>
          )}

          {/* KPI section always visible so toggle shows even when card is collapsed */}
          <div className="ease-kpi-section" onClick={(e) => e.stopPropagation()}>
            <div className="ease-subsection-head">
              <button
                className={`ease-section-toggle ${isKpiSectionOpen ? "is-open" : ""}`}
                type="button"
                onClick={() => setIsKpiSectionOpen((current) => !current)}
                aria-expanded={isKpiSectionOpen}
              >
                <span className="ease-section-toggle-indicator" aria-hidden="true">{isKpiSectionOpen ? "v" : ">"}</span>
                <span className="ease-section-toggle-label">KPIs ({kpis.length})</span>
              </button>
              <DashboardKeyResultControls objectiveKey={keyResult.objectiveKey} krKey={keyResult.krKey} defaultDueDate={keyResult.dueDate} defaultOwner={resolveOwnerName(keyResult.owner, keyResult.ownerEmail)} defaultOwnerEmail={resolveOwnerEmail(keyResult.owner, keyResult.ownerEmail)} positionOwnerEmail={positionOwnerEmail} adminEmails={adminEmails} metricTypeOptions={metricTypeOptions} keyResultStatusOptions={keyResultStatusOptions} checkInFrequencyOptions={checkInFrequencyOptions} />
            </div>
            {isKpiSectionOpen ? (
              <div className="ease-kpi-list">
                {kpis.length > 0 ? (
                  <WeightGroupControls
                    title="KPI Weights"
                    actionLabel="Edit KPI Weights"
                    requestPath={`/api/krs/${encodeURIComponent(keyResult.krKey)}/kpis/weights`}
                    items={kpis.map((item) => ({
                      key: item.kpi.kpiKey,
                      label: item.kpi.kpiCode ?? item.kpi.title,
                      weight: normalizeWeightValue(item.kpi.baselineValue)
                    }))}
                    canEdit={canEdit}
                    emptyMessage="No KPIs to weight yet."
                  />
                ) : null}
                {kpis.length === 0 ? (
                  <p className="meta">No KPIs for this key result yet.</p>
                ) : (
                  kpis.map((item) => (
                    <DashboardEaseKpiCard key={item.kpi.kpiKey} kpi={item.kpi} latestUpdateNotes={item.latestUpdateNotes} latestUpdatedAt={item.latestUpdatedAt} forcedBodyOpen={forcedKpiSectionOpen} positionOwnerEmail={positionOwnerEmail} adminEmails={adminEmails} metricTypeOptions={metricTypeOptions} keyResultStatusOptions={keyResultStatusOptions} checkInFrequencyOptions={checkInFrequencyOptions} />
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Right sidebar: status chip, progress ring, chevron */}
        <div className="ease-kr-sidebar" onClick={(e) => e.stopPropagation()}>
          <span className={statusChipClass(isEditing ? status : keyResult.status)}>
            {formatStatus(isEditing ? status : keyResult.status)}
          </span>
          <div className="ease-progress-ring ease-progress-ring-kr" style={{ "--progress": `${progressValue}%` } as React.CSSProperties}>
            <span>{Math.round(progressValue)}%</span>
          </div>
          <button type="button" className="card-chevron-btn" onClick={(e) => { e.stopPropagation(); setIsBodyOpen((v) => !v); }} aria-expanded={showBody} aria-label={showBody ? "Collapse" : "Expand"}>
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
                <h4 className="okr-details-title">{keyResult.title}</h4>
              )}
            </div>
            <div className="okr-details-header-actions">
              {!isDialogEditing && canEdit && (
                <button type="button" className="okr-details-edit-btn" onClick={() => setIsDialogEditing(true)} disabled={isSaving} aria-label="Edit">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10.5 1.5l3 3L4 14H1v-3L10.5 1.5z" />
                  </svg>
                </button>
              )}
              <button type="button" className="okr-details-close" onClick={closeDetails} aria-label="Close">✕</button>
            </div>
          </div>

          {isDialogEditing ? (
            <>
              <div className="ease-edit-grid okr-dialog-edit-grid">
                <input className="objective-row-input" value={code} onChange={(e) => setCode(e.target.value)} disabled={isSaving} placeholder="KR Code" />
                <OwnerInput id={`dialog-kr-owner-${keyResult.krKey}`} label="Owner (optional)" value={owner} onChange={setOwner} emailValue={ownerEmail} onEmailChange={setOwnerEmail} multiple disabled={isSaving} className="ease-edit-span" />
                <div className="field ease-edit-span"><label>Owner Email</label><input className="objective-row-input" value={formatOwnerEmailLabel(owner, ownerEmail)} readOnly disabled={isSaving} /></div>
                <div className="field"><label>Metric Type</label><select className="objective-row-select" value={metricType} onChange={(e) => setMetricType(e.target.value as MetricType)} disabled={isSaving}>{metricTypeOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
                <div className="field"><label>Weight</label><input className="objective-row-input" type="number" step="0.01" min="0" max="1" value={baselineValue} onChange={(e) => setBaselineValue(e.target.value)} disabled={isSaving} /></div>
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
                <span className={statusChipClass(keyResult.status)}>{formatStatus(keyResult.status)}</span>
                <span className="ease-chip ease-chip-neutral">{formatOwnerLabel(keyResult.owner, keyResult.ownerEmail) || "-"}</span>
                <span className="ease-chip ease-chip-neutral">Due: {formatDate(keyResult.dueDate)}</span>
                <span className="ease-chip ease-chip-neutral">Weight: {displayWeight}</span>
                <span className="ease-chip ease-chip-neutral">{keyResult.metricType}</span>
                <span className="ease-chip ease-chip-neutral">{formatCheckinFrequency(keyResult.checkInFrequency)}</span>
                <span className="ease-chip ease-chip-neutral">Progress: {Math.round(progressValue)}%</span>
              </div>
              <EaseCardDetailBlocks note={keyResult.notes} blockers={keyResult.blockers} comment={keyResult.comment} />
              {!keyResult.notes?.trim() && !keyResult.blockers?.trim() && !keyResult.comment?.trim() ? (
                <p className="meta">No additional details.</p>
              ) : null}
            </>
          )}
        </div>
      </dialog>
    </article>
  );
}
