"use client";

import EaseCardDetailBlocks from "@/app/ease-card-detail-blocks";
import DashboardEaseKrCard from "@/app/dashboard-ease-kr-card";
import DashboardKrControls from "@/app/dashboard-kr-controls";
import OwnerInput from "@/app/owner-input";
import WeightGroupControls from "@/app/weight-group-controls";
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
import type { CheckInFrequency, Kpi, KeyResult, KrStatus, MetricType, Objective, ObjectiveStatus, ObjectiveType, OkrCycle, Rag } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  forcedKrSectionOpen?: boolean;
  positionOwnerEmail?: string;
  adminEmails: string[];
  objectiveTypeOptions: ObjectiveType[];
  objectiveStatusOptions: ObjectiveStatus[];
  objectiveCycleOptions: OkrCycle[];
  metricTypeOptions: MetricType[];
  keyResultStatusOptions: KrStatus[];
  checkInFrequencyOptions: CheckInFrequency[];
};

type ApiError = { error?: string };

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

function normalizeWeightValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value;
}

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

function RagDot({ rag }: { rag: Rag }): JSX.Element {
  const color = rag === "Green" ? "#22c55e" : rag === "Amber" ? "#f59e0b" : "#ef4444";
  return (
    <span className="ease-rag-dot" style={{ background: color }} title={`RAG: ${rag}`} aria-label={`RAG: ${rag}`} />
  );
}

function HighlightText({ text }: { text: string }): JSX.Element {
  const query = useSearchQuery().trim().toLowerCase();
  if (!query) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    const idx = remaining.toLowerCase().indexOf(query);
    if (idx === -1) { parts.push(<span key={key++}>{remaining}</span>); break; }
    if (idx > 0) parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>);
    parts.push(<mark key={key++} className="search-highlight">{remaining.slice(idx, idx + query.length)}</mark>);
    remaining = remaining.slice(idx + query.length);
  }
  return <>{parts}</>;
}

export default function DashboardEaseObjectiveCard({
  objective,
  keyResults,
  forcedKrSectionOpen,
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
  const normalizedUserEmail = normalizeEmail(signedInEmail);
  const isAdmin = adminEmails.map((e) => normalizeEmail(e)).includes(normalizedUserEmail);
  const canEdit =
    Boolean(normalizedUserEmail) &&
    (isAdmin ||
      includesAssignedOwnerEmail(objective.owner, objective.ownerEmail, normalizedUserEmail) ||
      includesSerializedOwnerEmail(positionOwnerEmail, normalizedUserEmail));

  const objectiveCode = objective.objectiveCode ?? objective.objectiveKey;

  const dialogRef = useRef<HTMLDialogElement>(null);
  const hasDetails = !!(objective.notes?.trim() || objective.blockers?.trim() || objective.comment?.trim() || objective.keyRisksDependency?.trim());

  const [isKrSectionOpen, setIsKrSectionOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDialogEditing, setIsDialogEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState(objectiveCode);
  const [title, setTitle] = useState(objective.title);
  const [owner, setOwner] = useState(resolveOwnerName(objective.owner, objective.ownerEmail));
  const [ownerEmail, setOwnerEmail] = useState(resolveOwnerEmail(objective.owner, objective.ownerEmail));
  const [objectiveType, setObjectiveType] = useState<ObjectiveType>(objective.objectiveType);
  const [status, setStatus] = useState<ObjectiveStatus>(objective.status);
  const [okrCycle, setOkrCycle] = useState<OkrCycle>(objective.okrCycle);
  const [metricType, setMetricType] = useState<MetricType>(objective.metricType);
  const [baselineValue, setBaselineValue] = useState(String(normalizeWeightValue(objective.baselineValue)));
  const [dueDate, setDueDate] = useState(toDateInput(objective.dueDate));
  const [checkInFrequency, setCheckInFrequency] = useState<CheckInFrequency>(objective.checkInFrequency);
  const [blockers, setBlockers] = useState(objective.blockers ?? "");
  const [comment, setComment] = useState(objective.comment ?? "");
  const [keyRisksDependency, setKeyRisksDependency] = useState(objective.keyRisksDependency ?? "");
  const [notes, setNotes] = useState(objective.notes ?? objective.description ?? "");

  useEffect(() => {
    setCode(objectiveCode);
    setTitle(objective.title);
    setOwner(resolveOwnerName(objective.owner, objective.ownerEmail));
    setOwnerEmail(resolveOwnerEmail(objective.owner, objective.ownerEmail));
    setObjectiveType(objective.objectiveType);
    setStatus(objective.status);
    setOkrCycle(objective.okrCycle);
    setMetricType(objective.metricType);
    setBaselineValue(String(normalizeWeightValue(objective.baselineValue)));
    setDueDate(toDateInput(objective.dueDate));
    setCheckInFrequency(objective.checkInFrequency);
    setBlockers(objective.blockers ?? "");
    setComment(objective.comment ?? "");
    setKeyRisksDependency(objective.keyRisksDependency ?? "");
    setNotes(objective.notes ?? objective.description ?? "");
  }, [objective, objectiveCode]);

  useEffect(() => {
    if (typeof forcedKrSectionOpen === "boolean") setIsKrSectionOpen(forcedKrSectionOpen);
  }, [forcedKrSectionOpen]);

  const progressValue = clampPercent(objective.progressPct);
  const displayWeight = normalizeWeightValue(objective.baselineValue);

  const cancelEdit = (): void => {
    setIsEditing(false);
    setIsDialogEditing(false);
    setError("");
    setCode(objectiveCode);
    setTitle(objective.title);
    setOwner(resolveOwnerName(objective.owner, objective.ownerEmail));
    setOwnerEmail(resolveOwnerEmail(objective.owner, objective.ownerEmail));
    setObjectiveType(objective.objectiveType);
    setStatus(objective.status);
    setOkrCycle(objective.okrCycle);
    setMetricType(objective.metricType);
    setBaselineValue(String(normalizeWeightValue(objective.baselineValue)));
    setDueDate(toDateInput(objective.dueDate));
    setCheckInFrequency(objective.checkInFrequency);
    setBlockers(objective.blockers ?? "");
    setComment(objective.comment ?? "");
    setKeyRisksDependency(objective.keyRisksDependency ?? "");
    setNotes(objective.notes ?? objective.description ?? "");
  };

  const openDetails = (): void => { cancelEdit(); dialogRef.current?.showModal(); };
  const closeDetails = (): void => { cancelEdit(); dialogRef.current?.close(); };

  const saveEdit = async (): Promise<void> => {
    if (isSaving) return;
    if (!title.trim()) { setError("Objective title is required."); return; }
    const baseline = Number(baselineValue);
    if (!Number.isFinite(baseline)) { setError("Weight must be numeric."); return; }
    if (baseline < 0 || baseline > 1) { setError("Weight must be between 0 and 1."); return; }
    if (!dueDate) { setError("Due date is required."); return; }
    setIsSaving(true); setError("");
    const response = await fetch(apiPath(`/api/objectives/${encodeURIComponent(objective.objectiveKey)}`), {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-user-email": signedInEmail },
      body: JSON.stringify({ objectiveCode: code.trim(), title: title.trim(), owner: owner.trim(), ownerEmail: ownerEmail.trim(), objectiveType, okrCycle, metricType, baselineValue: baseline, status, dueDate, endDate: dueDate, checkInFrequency, blockers: blockers.trim(), comment: comment.trim(), keyRisksDependency: keyRisksDependency.trim(), notes: notes.trim() })
    });
    if (!response.ok) { const p = await readJson<ApiError>(response); setError(p?.error ?? "Failed to update objective."); setIsSaving(false); return; }
    setIsSaving(false); setIsEditing(false); setIsDialogEditing(false); dialogRef.current?.close(); router.refresh();
  };

  const deleteCurrentObjective = async (): Promise<void> => {
    if (isSaving) return;
    const kpiCount = keyResults.reduce((sum, item) => sum + (item.kpis?.length ?? 0), 0);
    const warning = keyResults.length > 0
      ? `Delete objective '${objective.title}'?\n\nThis permanently deletes this objective and all descendants:\n- ${keyResults.length} key results\n- ${kpiCount} KPIs\n- related check-ins\n\nThis action cannot be undone.`
      : `Delete objective '${objective.title}'?\n\nThis permanently deletes this objective and any related check-ins.\n\nThis action cannot be undone.`;
    if (!window.confirm(warning)) return;
    setIsSaving(true); setError("");
    const response = await fetch(apiPath(`/api/objectives/${encodeURIComponent(objective.objectiveKey)}`), {
      method: "DELETE", headers: { "x-user-email": signedInEmail }
    });
    if (!response.ok) { const p = await readJson<ApiError>(response); setError(p?.error ?? "Failed to delete objective."); setIsSaving(false); return; }
    setIsSaving(false); setIsEditing(false); setIsDialogEditing(false); dialogRef.current?.close(); router.refresh();
  };

  return (
    <article className="ease-objective-card">
      {/* 2-column layout: content left, sidebar right */}
      <div className="ease-objective-layout">
        <div className="ease-objective-content">
          <div className="ease-code-badge">{objectiveCode}</div>
          {isEditing ? (
            <textarea className="objective-row-input ease-title-textarea" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Objective" autoFocus disabled={isSaving} />
          ) : (
            <div className="ease-kr-title-row">
              {hasDetails ? (
                <button type="button" className="ease-title-btn" onClick={openDetails} title="Click to view details">
                  <h3><HighlightText text={objective.title} /></h3>
                </button>
              ) : (
                <h3><HighlightText text={objective.title} /></h3>
              )}
              {hasDetails ? <span className="ease-has-details-dot" aria-hidden="true" /> : null}
            </div>
          )}
          {!isEditing && (
            <div className="ease-objective-chip-row">
              <span className="ease-chip ease-chip-neutral">{formatOwnerLabel(objective.owner, objective.ownerEmail) || "-"}</span>
              <span className="ease-chip ease-chip-neutral">{objective.metricType}</span>
              <span className="ease-chip ease-chip-neutral">{objective.okrCycle || getQuarterLabel(objective.dueDate)}</span>
              <span className={statusChipClass(objective.status)}>{formatStatus(objective.status)}</span>
            </div>
          )}
          {!isEditing && (
            <div className="ease-footer-line">
              <span>Weight: {displayWeight}</span>
              <span>Due Date: {formatDate(objective.dueDate)}</span>
              <span>Last Updated: {formatDate(objective.lastCheckinAt)}</span>
            </div>
          )}
          {isEditing && (
            <div className="ease-edit-grid">
              <input className="objective-row-input" value={code} onChange={(e) => setCode(e.target.value)} disabled={isSaving} />
              <OwnerInput id={`ease-objective-owner-${objective.objectiveKey}`} label="Owner (optional)" value={owner} onChange={setOwner} emailValue={ownerEmail} onEmailChange={setOwnerEmail} multiple disabled={isSaving} className="ease-edit-span" />
              <div className="field ease-edit-span"><label>Owner Email</label><input className="objective-row-input" value={formatOwnerEmailLabel(owner, ownerEmail)} readOnly disabled={isSaving} /></div>
              <div className="field"><label>Objective Type</label><select className="objective-row-select" value={objectiveType} onChange={(e) => setObjectiveType(e.target.value as ObjectiveType)} disabled={isSaving}>{objectiveTypeOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
              <div className="field"><label>Health</label><select className="objective-row-select" value={status} onChange={(e) => setStatus(e.target.value as ObjectiveStatus)} disabled={isSaving}>{objectiveStatusOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
              <div className="field"><label>OKR Cycle</label><select className="objective-row-select" value={okrCycle} onChange={(e) => setOkrCycle(e.target.value as OkrCycle)} disabled={isSaving}>{objectiveCycleOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
              <div className="field"><label>Metric Type</label><select className="objective-row-select" value={metricType} onChange={(e) => setMetricType(e.target.value as MetricType)} disabled={isSaving}>{metricTypeOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
              <div className="field"><label>Weight</label><input className="objective-row-input" type="number" step="0.01" min="0" max="1" value={baselineValue} onChange={(e) => setBaselineValue(e.target.value)} disabled={isSaving} /></div>
              <div className="field"><label>Progress %</label><input className="objective-row-input" type="number" step="any" value={String(Math.round(progressValue * 100) / 100)} readOnly disabled /></div>
              <div className="field"><label>Due Date</label><input className="objective-row-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={isSaving} /></div>
              <div className="field"><label>Check-in Frequency</label><select className="objective-row-select" value={checkInFrequency} onChange={(e) => setCheckInFrequency(e.target.value as CheckInFrequency)} disabled={isSaving}>{checkInFrequencyOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
              <div className="field ease-edit-span"><label>Blockers</label><textarea value={blockers} onChange={(e) => setBlockers(e.target.value)} disabled={isSaving} /></div>
              <div className="field ease-edit-span"><label>Comment</label><textarea value={comment} onChange={(e) => setComment(e.target.value)} disabled={isSaving} /></div>
              <div className="field ease-edit-span"><label>Key Risks/Dependency</label><textarea value={keyRisksDependency} onChange={(e) => setKeyRisksDependency(e.target.value)} disabled={isSaving} /></div>
              <div className="field ease-edit-span"><label>Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isSaving} /></div>
            </div>
          )}
          {canEdit && (
            <div className="ease-card-actions">
              {isEditing ? (
                <>
                  <button className="btn" type="button" onClick={() => void saveEdit()} disabled={isSaving}>Save</button>
                  <button className="btn btn-danger" type="button" onClick={() => void deleteCurrentObjective()} disabled={isSaving}>Delete</button>
                  <button className="tab-btn" type="button" onClick={cancelEdit} disabled={isSaving}>Cancel</button>
                </>
              ) : (
                <button className="tab-btn" type="button" onClick={() => setIsEditing(true)} disabled={isSaving}>Edit Objective</button>
              )}
            </div>
          )}
          {error ? <p className="message danger">{error}</p> : null}
          <div className="ease-kr-section">
            <div className="ease-subsection-head">
              <button type="button" className={`ease-section-toggle ${isKrSectionOpen ? "is-open" : ""}`} aria-expanded={isKrSectionOpen} onClick={() => setIsKrSectionOpen((v) => !v)}>
                <span className="ease-section-toggle-indicator" aria-hidden="true">{isKrSectionOpen ? "v" : ">"}</span>
                <span className="ease-section-toggle-label">Key Results ({keyResults.length})</span>
              </button>
              <DashboardKrControls objectiveKey={objective.objectiveKey} defaultDueDate={objective.endDate} defaultOwner={resolveOwnerName(objective.owner, objective.ownerEmail)} defaultOwnerEmail={resolveOwnerEmail(objective.owner, objective.ownerEmail)} positionOwnerEmail={positionOwnerEmail} adminEmails={adminEmails} metricTypeOptions={metricTypeOptions} keyResultStatusOptions={keyResultStatusOptions} checkInFrequencyOptions={checkInFrequencyOptions} />
            </div>
            {isKrSectionOpen && (
              <div className="ease-kr-list">
                {keyResults.length > 0 ? (
                  <WeightGroupControls title="Key Result Weights" actionLabel="Edit KR Weights" requestPath={`/api/objectives/${encodeURIComponent(objective.objectiveKey)}/key-results/weights`}
                    items={keyResults.map((item) => ({ key: item.keyResult.krKey, label: item.keyResult.krCode ?? item.keyResult.title, weight: normalizeWeightValue(item.keyResult.baselineValue) }))}
                    canEdit={canEdit} emptyMessage="No key results to weight yet." />
                ) : null}
                {keyResults.length === 0 ? (
                  <p className="meta">No key results for this objective yet.</p>
                ) : (
                  keyResults.map((item) => (
                    <DashboardEaseKrCard key={item.keyResult.krKey} keyResult={item.keyResult} kpis={item.kpis ?? []} latestUpdatedAt={item.latestUpdatedAt}
                      forcedKpiSectionOpen={forcedKrSectionOpen} forcedBodyOpen={forcedKrSectionOpen}
                      positionOwnerEmail={positionOwnerEmail} adminEmails={adminEmails} metricTypeOptions={metricTypeOptions} keyResultStatusOptions={keyResultStatusOptions} checkInFrequencyOptions={checkInFrequencyOptions} />
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar: RAG dot top, progress ring below */}
        <div className="ease-objective-sidebar">
          {!isEditing && <RagDot rag={objective.rag} />}
          <div className="ease-progress-ring ease-progress-ring-objective" style={{ "--progress": `${progressValue}%` } as React.CSSProperties}>
            <span>{Math.round(progressValue)}%</span>
          </div>
        </div>
      </div>

      {/* Details popup */}
      <dialog ref={dialogRef} className="okr-details-dialog" onClick={(e) => { if (e.target === e.currentTarget) closeDetails(); }}>
        <div className="okr-details-inner">
          <div className="okr-details-header">
            <div className="okr-details-title-area">
              <div className="ease-code-badge">{objectiveCode}</div>
              {isDialogEditing ? (
                <textarea
                  className="objective-row-input ease-title-textarea okr-details-title-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isSaving}
                  autoFocus
                />
              ) : (
                <h3 className="okr-details-title">{objective.title}</h3>
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
                <input className="objective-row-input" value={code} onChange={(e) => setCode(e.target.value)} disabled={isSaving} placeholder="Objective Code" />
                <OwnerInput id={`dialog-obj-owner-${objective.objectiveKey}`} label="Owner (optional)" value={owner} onChange={setOwner} emailValue={ownerEmail} onEmailChange={setOwnerEmail} multiple disabled={isSaving} className="ease-edit-span" />
                <div className="field ease-edit-span"><label>Owner Email</label><input className="objective-row-input" value={formatOwnerEmailLabel(owner, ownerEmail)} readOnly disabled={isSaving} /></div>
                <div className="field"><label>Objective Type</label><select className="objective-row-select" value={objectiveType} onChange={(e) => setObjectiveType(e.target.value as ObjectiveType)} disabled={isSaving}>{objectiveTypeOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
                <div className="field"><label>Health</label><select className="objective-row-select" value={status} onChange={(e) => setStatus(e.target.value as ObjectiveStatus)} disabled={isSaving}>{objectiveStatusOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
                <div className="field"><label>OKR Cycle</label><select className="objective-row-select" value={okrCycle} onChange={(e) => setOkrCycle(e.target.value as OkrCycle)} disabled={isSaving}>{objectiveCycleOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
                <div className="field"><label>Metric Type</label><select className="objective-row-select" value={metricType} onChange={(e) => setMetricType(e.target.value as MetricType)} disabled={isSaving}>{metricTypeOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
                <div className="field"><label>Weight</label><input className="objective-row-input" type="number" step="0.01" min="0" max="1" value={baselineValue} onChange={(e) => setBaselineValue(e.target.value)} disabled={isSaving} /></div>
                <div className="field"><label>Progress %</label><input className="objective-row-input" type="number" value={String(Math.round(progressValue * 100) / 100)} readOnly disabled /></div>
                <div className="field"><label>Due Date</label><input className="objective-row-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={isSaving} /></div>
                <div className="field"><label>Check-in Frequency</label><select className="objective-row-select" value={checkInFrequency} onChange={(e) => setCheckInFrequency(e.target.value as CheckInFrequency)} disabled={isSaving}>{checkInFrequencyOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
                <div className="field ease-edit-span"><label>Blockers</label><textarea value={blockers} onChange={(e) => setBlockers(e.target.value)} disabled={isSaving} /></div>
                <div className="field ease-edit-span"><label>Comment</label><textarea value={comment} onChange={(e) => setComment(e.target.value)} disabled={isSaving} /></div>
                <div className="field ease-edit-span"><label>Key Risks/Dependency</label><textarea value={keyRisksDependency} onChange={(e) => setKeyRisksDependency(e.target.value)} disabled={isSaving} /></div>
                <div className="field ease-edit-span"><label>Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isSaving} /></div>
              </div>
              {error ? <p className="message danger">{error}</p> : null}
              <div className="okr-dialog-actions">
                <button className="btn" type="button" onClick={() => void saveEdit()} disabled={isSaving}>Save</button>
                <button className="btn btn-danger" type="button" onClick={() => void deleteCurrentObjective()} disabled={isSaving}>Delete</button>
                <button className="tab-btn" type="button" onClick={cancelEdit} disabled={isSaving}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className="okr-details-fields">
                <RagDot rag={objective.rag} />
                <span className={statusChipClass(objective.status)}>{formatStatus(objective.status)}</span>
                <span className="ease-chip ease-chip-neutral">{formatOwnerLabel(objective.owner, objective.ownerEmail) || "-"}</span>
                <span className="ease-chip ease-chip-neutral">Due: {formatDate(objective.dueDate)}</span>
                <span className="ease-chip ease-chip-neutral">Weight: {displayWeight}</span>
                <span className="ease-chip ease-chip-neutral">{objective.metricType}</span>
                <span className="ease-chip ease-chip-neutral">{objective.okrCycle || getQuarterLabel(objective.dueDate)}</span>
                <span className="ease-chip ease-chip-neutral">Progress: {Math.round(progressValue)}%</span>
              </div>
              <EaseCardDetailBlocks note={objective.notes ?? objective.description} blockers={objective.blockers} comment={objective.comment} keyRisksDependency={objective.keyRisksDependency} />
              {!objective.notes?.trim() && !objective.description?.trim() && !objective.blockers?.trim() && !objective.comment?.trim() && !objective.keyRisksDependency?.trim() ? (
                <p className="meta">No additional details.</p>
              ) : null}
            </>
          )}
        </div>
      </dialog>
    </article>
  );
}
