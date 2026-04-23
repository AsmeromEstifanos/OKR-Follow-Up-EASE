"use client";

import DashboardEaseKpiCard from "@/app/dashboard-ease-kpi-card";
import DashboardKeyResultControls from "@/app/dashboard-key-result-controls";
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
import type { CheckInFrequency, Kpi, KeyResult, KrStatus, MetricType } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type KpiRowData = {
  kpi: Kpi;
  latestUpdateNotes?: string;
  latestUpdatedAt?: string | null;
};

type Props = {
  keyResult: KeyResult;
  kpis: KpiRowData[];
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

function deriveProgressPct(baseline: number, target: number, current: number, fallback: number): number {
  if (!Number.isFinite(target) || Math.abs(target) < 0.000001) {
    return clampPercent(fallback);
  }

  return clampPercent((current / target) * 100);
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

export default function DashboardEaseKrCard({
  keyResult,
  kpis,
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
      includesAssignedOwnerEmail(keyResult.owner, keyResult.ownerEmail, normalizedUserEmail) ||
      includesSerializedOwnerEmail(positionOwnerEmail, normalizedUserEmail)
    );

  const codeValue = keyResult.krCode ?? keyResult.krKey;

  const [isExpanded, setIsExpanded] = useState(true);
  const [isKpiSectionOpen, setIsKpiSectionOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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

  const progressValue = useMemo(
    () => deriveProgressPct(Number(baselineValue), Number(targetValue), Number(currentValue), Number(progressPct)),
    [baselineValue, currentValue, progressPct, targetValue]
  );

  const cancelEdit = (): void => {
    setIsEditing(false);
    setError("");
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
  };

  const saveEdit = async (): Promise<void> => {
    if (isSaving) return;
    if (!title.trim()) {
      setError("Key result title is required.");
      return;
    }

    const baseline = Number(baselineValue);
    const target = Number(targetValue);
    const current = Number(currentValue);

    if (!Number.isFinite(baseline) || !Number.isFinite(target) || !Number.isFinite(current)) {
      setError("Metric values must be numeric.");
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
    if (!window.confirm(`Delete key result '${keyResult.title}'? Related KPIs and check-ins will also be deleted.`)) return;

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
    <article className="ease-kr-card">
      <div
        className="ease-kr-head"
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
        <button type="button" className={`ease-toggle ${isExpanded ? "is-open" : ""}`} aria-hidden="true" tabIndex={-1}>
          <span aria-hidden="true">{isExpanded ? "⌄" : "›"}</span>
        </button>
        <div className="ease-kr-main">
          <div className="ease-code-badge">{codeValue}</div>
          {isEditing ? (
            <textarea
              className="objective-row-input ease-title-textarea"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Key Result"
              autoFocus
              disabled={isSaving}
            />
          ) : (
            <h4>{keyResult.title}</h4>
          )}
          {!isEditing && notes ? <p className="ease-card-copy">{notes}</p> : null}
        </div>
        <div className="ease-card-head-side">
          <span className={statusChipClass(isEditing ? status : keyResult.status)}>{formatStatus(isEditing ? status : keyResult.status)}</span>
          <div className="ease-progress-ring ease-progress-ring-kr" style={{ "--progress": `${progressValue}%` } as React.CSSProperties}>
            <span>{Math.round(progressValue)}%</span>
          </div>
        </div>
      </div>
      {!isEditing ? (
        <>
          <div className="ease-kr-meta">
            <span className="ease-chip ease-chip-neutral">{formatOwnerLabel(keyResult.owner, keyResult.ownerEmail) || "-"}</span>
            <span className="ease-chip ease-chip-neutral">{keyResult.metricType}</span>
            <span className="ease-chip ease-chip-neutral">{formatCheckinFrequency(keyResult.checkInFrequency)}</span>
            <span className="ease-chip ease-chip-neutral">{getQuarterLabel(keyResult.dueDate)}</span>
          </div>
          <div className="ease-progress-bar">
            <span style={{ width: `${progressValue}%` }} />
          </div>
          <div className="ease-footer-line">
            <span>Progress: {keyResult.currentValue} / {keyResult.targetValue}</span>
            <span>Due Date: {formatDate(keyResult.dueDate)}</span>
            <span>Last Updated: {formatDate(latestUpdatedAt ?? keyResult.lastCheckinAt)}</span>
          </div>
        </>
      ) : (
        <div className="ease-edit-grid">
          <input className="objective-row-input" value={code} onChange={(event) => setCode(event.target.value)} disabled={isSaving} />
          <OwnerInput id={`ease-kr-owner-${keyResult.krKey}`} label="Owner (optional)" value={owner} onChange={setOwner} emailValue={ownerEmail} onEmailChange={setOwnerEmail} multiple disabled={isSaving} />
          <div className="field"><label>Owner Email</label><input className="objective-row-input" value={formatOwnerEmailLabel(owner, ownerEmail)} readOnly disabled={isSaving} /></div>
          <div className="field"><label>Metric Type</label><select className="objective-row-select" value={metricType} onChange={(event) => setMetricType(event.target.value as MetricType)} disabled={isSaving}>{metricTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
          <div className="field"><label>Baseline Value</label><input className="objective-row-input" type="number" step="any" value={baselineValue} onChange={(event) => setBaselineValue(event.target.value)} disabled={isSaving} /></div>
          <div className="field"><label>Target Value</label><input className="objective-row-input" type="number" step="any" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} disabled={isSaving} /></div>
          <div className="field"><label>Current Value</label><input className="objective-row-input" type="number" step="any" value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} disabled={isSaving} /></div>
          <div className="field"><label>Progress %</label><input className="objective-row-input" type="number" step="any" value={String(Math.round(progressValue * 100) / 100)} readOnly disabled /></div>
          <div className="field"><label>Status</label><select className="objective-row-select" value={status} onChange={(event) => setStatus(event.target.value as KrStatus)} disabled={isSaving}>{keyResultStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
          <div className="field"><label>Due Date</label><input className="objective-row-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={isSaving} /></div>
          <div className="field"><label>Check-in Frequency</label><select className="objective-row-select" value={checkInFrequency} onChange={(event) => setCheckInFrequency(event.target.value as CheckInFrequency)} disabled={isSaving}>{checkInFrequencyOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
          <div className="field ease-edit-span"><label>Blockers</label><textarea value={blockers} onChange={(event) => setBlockers(event.target.value)} disabled={isSaving} /></div>
          <div className="field ease-edit-span"><label>Notes</label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={isSaving} /></div>
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
            <button className="tab-btn" type="button" onClick={(event) => { event.stopPropagation(); setIsEditing(true); }} disabled={isSaving}>Edit Key Result</button>
          )}
        </div>
      ) : null}
      {error ? <p className="message danger">{error}</p> : null}
      {isExpanded ? (
        <div className="ease-kpi-section">
          <div className="ease-subsection-head">
            <button
              type="button"
              className={`ease-section-toggle ${isKpiSectionOpen ? "is-open" : ""}`}
              aria-expanded={isKpiSectionOpen}
              onClick={() => setIsKpiSectionOpen((current) => !current)}
            >
              <span aria-hidden="true">{isKpiSectionOpen ? "⌄" : "›"}</span>
              <h5>KPIs ({kpis.length})</h5>
            </button>
            <DashboardKeyResultControls objectiveKey={keyResult.objectiveKey} krKey={keyResult.krKey} defaultDueDate={keyResult.dueDate} defaultOwner={resolveOwnerName(keyResult.owner, keyResult.ownerEmail)} defaultOwnerEmail={resolveOwnerEmail(keyResult.owner, keyResult.ownerEmail)} positionOwnerEmail={positionOwnerEmail} adminEmails={adminEmails} metricTypeOptions={metricTypeOptions} keyResultStatusOptions={keyResultStatusOptions} checkInFrequencyOptions={checkInFrequencyOptions} />
          </div>
          {isKpiSectionOpen ? (
            <div className="ease-kpi-list">
              {kpis.length === 0 ? (
                <p className="meta">No KPIs for this key result yet.</p>
              ) : (
                kpis.map((item) => (
                  <DashboardEaseKpiCard key={item.kpi.kpiKey} kpi={item.kpi} latestUpdateNotes={item.latestUpdateNotes} latestUpdatedAt={item.latestUpdatedAt} positionOwnerEmail={positionOwnerEmail} adminEmails={adminEmails} metricTypeOptions={metricTypeOptions} keyResultStatusOptions={keyResultStatusOptions} checkInFrequencyOptions={checkInFrequencyOptions} />
                ))
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
