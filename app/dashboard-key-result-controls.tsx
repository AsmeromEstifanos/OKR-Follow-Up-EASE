"use client";

import OwnerInput from "@/app/owner-input";
import useCurrentUserEmail from "@/app/use-current-user-email";
import { apiPath } from "@/lib/base-path";
import { beginOperationBatch } from "@/lib/client-operation-batch";
import { formatOwnerEmailLabel, includesSerializedOwnerEmail, resolveOwnerEmail } from "@/lib/owner";
import type { CheckInFrequency, KrStatus, MetricType } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  objectiveKey: string;
  krKey: string;
  defaultDueDate: string;
  defaultOwner: string;
  defaultOwnerEmail?: string;
  positionOwnerEmail?: string;
  adminEmails: string[];
  metricTypeOptions: MetricType[];
  keyResultStatusOptions: KrStatus[];
  checkInFrequencyOptions: CheckInFrequency[];
};

type ApiError = { error?: string };
type PendingKpi = {
  title: string;
  owner: string;
  ownerEmail: string;
  metricType: MetricType;
  baselineValue: number;
  targetValue: number;
  currentValue: number;
  status: KrStatus;
  dueDate: string;
  checkInFrequency: CheckInFrequency;
  blockers: string;
  comment: string;
  notes: string;
};

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function toDateInput(value: string): string {
  return value ? value.slice(0, 10) : "";
}

function sanitizeDefaultOwner(value: string): string {
  const normalized = value.trim();
  return normalized.toLowerCase().includes("@contoso") ? "" : normalized;
}

function normalizeEmail(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function getNextDisplayCode(code: string, fallbackPrefix: string): string {
  const match = /^([A-Z]+)-(\d+)$/i.exec(code.trim());
  if (!match) return `${fallbackPrefix}-001`;
  const numeric = Number(match[2]);
  if (!Number.isInteger(numeric) || numeric < 1) return `${match[1].toUpperCase()}-001`;
  return `${match[1].toUpperCase()}-${String(numeric + 1).padStart(match[2].length, "0")}`;
}

export default function DashboardKeyResultControls({
  objectiveKey,
  krKey,
  defaultDueDate,
  defaultOwner,
  defaultOwnerEmail,
  positionOwnerEmail,
  adminEmails,
  metricTypeOptions,
  keyResultStatusOptions,
  checkInFrequencyOptions
}: Props): JSX.Element {
  const itemLabel = "KPI";
  const itemLabelPlural = "KPIs";
  const router = useRouter();
  const signedInEmail = useCurrentUserEmail();
  const normalizedUserEmail = normalizeEmail(signedInEmail);
  const isAdmin = adminEmails.map((entry) => normalizeEmail(entry)).includes(normalizedUserEmail);
  const canCreate = Boolean(normalizedUserEmail) && (isAdmin || includesSerializedOwnerEmail(positionOwnerEmail, normalizedUserEmail));
  const sanitizedDefaultOwner = sanitizeDefaultOwner(defaultOwner);

  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [codePreview, setCodePreview] = useState("");
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState(sanitizedDefaultOwner);
  const [ownerEmail, setOwnerEmail] = useState(resolveOwnerEmail(defaultOwner, defaultOwnerEmail));
  const [metricType, setMetricType] = useState<MetricType>(metricTypeOptions[0] ?? "Operational");
  const [baselineValue, setBaselineValue] = useState("1");
  const [targetValue, setTargetValue] = useState("100");
  const [currentValue, setCurrentValue] = useState("0");
  const [status, setStatus] = useState<KrStatus>(keyResultStatusOptions[0] ?? "NotStarted");
  const [dueDate, setDueDate] = useState(toDateInput(defaultDueDate));
  const [checkInFrequency, setCheckInFrequency] = useState<CheckInFrequency>(checkInFrequencyOptions[0] ?? "Weekly");
  const [blockers, setBlockers] = useState("");
  const [comment, setComment] = useState("");
  const [notes, setNotes] = useState("");
  const [pendingItems, setPendingItems] = useState<PendingKpi[]>([]);
  const [error, setError] = useState("");
  const progressPreview = (() => {
    const target = Number(targetValue);
    const current = Number(currentValue);
    if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(current)) {
      return 0;
    }

    return Math.max(0, Math.min(100, (current / target) * 100));
  })();

  const loadCodePreview = async (): Promise<void> => {
    const response = await fetch(apiPath(`/api/codes/kpi?krKey=${encodeURIComponent(krKey)}`), { cache: "no-store" });
    if (!response.ok) {
      setCodePreview("KPI-001");
      return;
    }

    const payload = (await response.json()) as { code?: string };
    setCodePreview(payload.code?.trim() || "KPI-001");
  };

  const resetDraft = (): void => {
    setTitle("");
    setOwner("");
    setOwnerEmail("");
    setMetricType(metricTypeOptions[0] ?? "Operational");
    setBaselineValue("1");
    setTargetValue("100");
    setCurrentValue("0");
    setStatus(keyResultStatusOptions[0] ?? "NotStarted");
    setDueDate(toDateInput(defaultDueDate));
    setCheckInFrequency(checkInFrequencyOptions[0] ?? "Weekly");
    setBlockers("");
    setComment("");
    setNotes("");
  };

  const closeAdd = (): void => {
    if (isSaving) return;
    setError("");
    setIsAdding(false);
    setCodePreview("");
    setPendingItems([]);
    resetDraft();
    setOwner(sanitizedDefaultOwner);
    setOwnerEmail(resolveOwnerEmail(defaultOwner, defaultOwnerEmail));
  };

  useEffect(() => {
    if (!isAdding) return;
    void loadCodePreview();
  }, [isAdding, krKey]);

  useEffect(() => {
    if (!isAdding) {
      setOwner(sanitizedDefaultOwner);
      setOwnerEmail(resolveOwnerEmail(defaultOwner, defaultOwnerEmail));
    }
  }, [defaultOwner, defaultOwnerEmail, isAdding, sanitizedDefaultOwner]);

  const buildPendingItem = (): PendingKpi | null => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(`${itemLabel} title is required.`);
      return null;
    }

    const baseline = Number(baselineValue);
    const target = Number(targetValue);
    const current = Number(currentValue);
    if (!Number.isFinite(baseline) || !Number.isFinite(target) || !Number.isFinite(current)) {
      setError("Weight, target, and current values must be numbers.");
      return null;
    }

    if (baseline < 0 || baseline > 1) {
      setError("Weight must be between 0 and 1.");
      return null;
    }

    if (target <= 0) {
      setError("Target value must be greater than 0.");
      return null;
    }

    if (!dueDate) {
      setError("Due date is required.");
      return null;
    }

    return {
      title: trimmedTitle,
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
    };
  };

  const queueItem = (): void => {
    const draft = buildPendingItem();
    if (!draft) return;
    setPendingItems((current) => [...current, draft]);
    resetDraft();
    setError("");
    setCodePreview((current) => getNextDisplayCode(current, "KPI"));
  };

  const saveAll = async (): Promise<void> => {
    if (isSaving) return;
    const staged = [...pendingItems];
    if (staged.length === 0 && title.trim()) {
      const current = buildPendingItem();
      if (!current) return;
      staged.push(current);
    }

    if (staged.length === 0) {
      setError(`Add at least one ${itemLabel.toLowerCase()} first.`);
      return;
    }

    setIsSaving(true);
    setError("");
    const batch = beginOperationBatch("Saving KPIs", staged.length);

    try {
      for (let index = 0; index < staged.length; index += 1) {
        batch.setCurrentStep(index + 1);
        const item = staged[index];
        const response = await fetch(apiPath("/api/kpis"), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-user-email": signedInEmail
          },
          body: JSON.stringify({
            objectiveKey,
            krKey,
            ...item
          })
        });
        const payload = await readJson<ApiError>(response);
        if (!response.ok) {
          setError(payload?.error ?? `Failed to add ${itemLabel.toLowerCase()} at line ${index + 1}.`);
          setIsSaving(false);
          batch.finish();
          return;
        }
      }

      batch.finish();
      setIsSaving(false);
      closeAdd();
      router.refresh();
    } catch (err) {
      batch.finish();
      setError(err instanceof Error ? err.message : `Failed to save ${itemLabelPlural.toLowerCase()}.`);
      setIsSaving(false);
    }
  };

  return (
    <div className="kr-controls">
      {canCreate ? (
        <button className={`tab-btn tab-btn-add kr-add-btn ${isAdding ? "tab-btn-active" : ""}`} type="button" onClick={() => {
          if (isAdding) closeAdd();
          else {
            setError("");
            setIsAdding(true);
            void loadCodePreview();
          }
        }} disabled={isSaving}>
          Add {itemLabel}
        </button>
      ) : null}
      {canCreate && isAdding ? (
        <form className="kr-form" onSubmit={(event) => {
          event.preventDefault();
          void saveAll();
        }}>
          <div className="kr-form-grid">
            <div className="field">
              <label>{itemLabel} Code</label>
              <input value={codePreview} readOnly disabled={isSaving} />
            </div>
            <div className="field kr-field-wide">
              <label>{itemLabel}</label>
              <textarea value={title} onChange={(event) => setTitle(event.target.value)} placeholder={itemLabel} autoFocus disabled={isSaving} />
            </div>
            <OwnerInput
              id={`kpi-owner-${krKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`}
              label="Owner (optional)"
              value={owner}
              onChange={setOwner}
              emailValue={ownerEmail}
              onEmailChange={setOwnerEmail}
              multiple
              disabled={isSaving}
              placeholder="Owner (optional)"
            />
            <div className="field">
              <label>Owner Email</label>
              <input value={formatOwnerEmailLabel(owner, ownerEmail)} readOnly disabled={isSaving} />
            </div>
            <div className="field">
              <label>{itemLabel} Metric Type</label>
              <select value={metricType} onChange={(event) => setMetricType(event.target.value as MetricType)} disabled={isSaving}>
                {metricTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Weight</label>
              <input type="number" step="0.01" min="0" max="1" value={baselineValue} onChange={(event) => setBaselineValue(event.target.value)} disabled={isSaving} />
            </div>
            <div className="field">
              <label>Target Value</label>
              <input type="number" step="any" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} disabled={isSaving} />
            </div>
            <div className="field">
              <label>Current Value</label>
              <input type="number" step="any" value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} disabled={isSaving} />
            </div>
            <div className="field">
              <label>Progress %</label>
              <input value={String(Math.round(progressPreview * 100) / 100)} readOnly disabled />
            </div>
            <div className="field">
              <label>{itemLabel} Status</label>
              <select value={status} onChange={(event) => setStatus(event.target.value as KrStatus)} disabled={isSaving}>
                {keyResultStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Due Date</label>
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={isSaving} />
            </div>
            <div className="field">
              <label>Check-in Frequency</label>
              <select value={checkInFrequency} onChange={(event) => setCheckInFrequency(event.target.value as CheckInFrequency)} disabled={isSaving}>
                {checkInFrequencyOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div className="field kr-field-wide">
              <label>Blockers</label>
              <textarea value={blockers} onChange={(event) => setBlockers(event.target.value)} disabled={isSaving} />
            </div>
            <div className="field kr-field-wide">
              <label>Comment</label>
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} disabled={isSaving} />
            </div>
            <div className="field kr-field-wide">
              <label>Notes</label>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={isSaving} />
            </div>
          </div>
          <div className="actions">
            <button className="btn" type="button" onClick={queueItem} disabled={isSaving}>Add More</button>
            <button className="btn btn-add" type="submit" disabled={isSaving}>Save All{pendingItems.length > 0 ? ` (${pendingItems.length})` : ""}</button>
            <button className="tab-btn" type="button" onClick={closeAdd} disabled={isSaving}>Cancel</button>
          </div>
          {pendingItems.length > 0 ? (
            <div className="field kr-field-wide">
              <label>Pending {itemLabelPlural}</label>
              <ul>
                {pendingItems.map((item, index) => (
                  <li key={`${item.title}-${index}`}>
                    {item.title}{" "}
                    <button type="button" className="tab-btn" onClick={() => setPendingItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={isSaving}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </form>
      ) : null}
      {error ? <p className="message danger">{error}</p> : null}
    </div>
  );
}
