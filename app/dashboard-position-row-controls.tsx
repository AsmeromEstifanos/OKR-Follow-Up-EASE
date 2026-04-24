"use client";

import { appProfile } from "@/lib/app-profile";
import OwnerInput from "@/app/owner-input";
import WeightGroupControls from "@/app/weight-group-controls";
import { apiPath } from "@/lib/base-path";
import { formatOwnerEmailLabel, formatOwnerLabel, resolveOwnerEmail, resolveOwnerName } from "@/lib/owner";
import { broadcastOkrRefresh } from "@/lib/tab-sync";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import useCurrentUserEmail from "./use-current-user-email";

type Props = {
  selectedVentureKey?: string;
  departmentKey?: string;
  positionName: string;
  positionOwner?: string;
  positionOwnerEmail?: string;
  objectiveCount: number;
  objectiveWeights?: Array<{
    key: string;
    label: string;
    weight: number;
  }>;
  forcedOpen?: boolean;
  adminEmails: string[];
  children: ReactNode;
};

type ApiError = {
  error?: string;
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

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export default function DashboardPositionRowControls({
  selectedVentureKey,
  departmentKey,
  positionName,
  positionOwner,
  positionOwnerEmail,
  objectiveCount,
  objectiveWeights = [],
  forcedOpen,
  adminEmails,
  children
}: Props): JSX.Element {
  const labels = appProfile.labels;
  const itemLabel = "Position";
  const objectiveCountLabel = objectiveCount === 1 ? "objective" : "objectives";
  const router = useRouter();
  const contentId = useId();
  const currentUserEmail = useCurrentUserEmail();
  const isAdmin = adminEmails.map((entry) => normalizeEmail(entry)).includes(normalizeEmail(currentUserEmail));
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [nameDraft, setNameDraft] = useState<string>(positionName);
  const [ownerDraft, setOwnerDraft] = useState<string>(resolveOwnerName(positionOwner, positionOwnerEmail));
  const [ownerEmailDraft, setOwnerEmailDraft] = useState<string>(resolveOwnerEmail(positionOwner, positionOwnerEmail));
  const [displayName, setDisplayName] = useState<string>(positionName);
  const [displayOwner, setDisplayOwner] = useState<string>(formatOwnerLabel(positionOwner, positionOwnerEmail));
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setNameDraft(positionName);
    setOwnerDraft(resolveOwnerName(positionOwner, positionOwnerEmail));
    setOwnerEmailDraft(resolveOwnerEmail(positionOwner, positionOwnerEmail));
    setDisplayName(positionName);
    setDisplayOwner(formatOwnerLabel(positionOwner, positionOwnerEmail));
  }, [positionName, positionOwner, positionOwnerEmail, selectedVentureKey, departmentKey]);

  useEffect(() => {
    if (typeof forcedOpen === "boolean") {
      setIsOpen(forcedOpen);
    }
  }, [forcedOpen]);

  const canManage = isAdmin && Boolean(selectedVentureKey && departmentKey);
  const editTrigger =
    !isEditing && canManage ? (
      <button
        type="button"
        className="position-edit-trigger"
        aria-label={`Edit ${itemLabel.toLowerCase()} ${positionName}`}
        title={`Edit ${itemLabel.toLowerCase()}`}
        onClick={() => {
          setError("");
          setIsEditing(true);
        }}
        disabled={isSaving}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M3 17.25V21h3.75L18.81 8.94l-3.75-3.75L3 17.25zm17.71-10.04a1 1 0 0 0 0-1.41l-2.5-2.5a1 1 0 0 0-1.41 0l-1.96 1.96 3.75 3.75 2.12-2.1z"
            fill="currentColor"
          />
        </svg>
      </button>
    ) : null;
  const objectiveWeightTrigger =
    isOpen && objectiveWeights.length > 0 ? (
      <WeightGroupControls
        title="Objective Weights"
        actionLabel="Edit Objective Weights"
        requestPath="/api/objectives/weights"
        items={objectiveWeights}
        adminEmails={adminEmails}
        ownerEmail={positionOwnerEmail}
        emptyMessage="No objectives to weight yet."
      />
    ) : null;

  const closeEdit = (): void => {
    if (isSaving) {
      return;
    }

    setIsEditing(false);
    setNameDraft(positionName);
    setOwnerDraft(resolveOwnerName(positionOwner, positionOwnerEmail));
    setOwnerEmailDraft(resolveOwnerEmail(positionOwner, positionOwnerEmail));
    setError("");
  };

  const savePosition = async (): Promise<void> => {
    if (isSaving) {
      return;
    }

    if (!selectedVentureKey || !departmentKey) {
      setError(`${itemLabel} cannot be edited right now.`);
      return;
    }

    const name = nameDraft.trim();
    if (!name) {
      setError(`${itemLabel} name is required.`);
      return;
    }

    if (
      name.toLowerCase() === positionName.toLowerCase() &&
      ownerDraft.trim() === resolveOwnerName(positionOwner, positionOwnerEmail).trim() &&
      ownerEmailDraft.trim() === resolveOwnerEmail(positionOwner, positionOwnerEmail).trim()
    ) {
      closeEdit();
      return;
    }

    setIsSaving(true);
    setError("");

    const response = await fetch(
      apiPath(`/api/config/ventures/${encodeURIComponent(selectedVentureKey)}/departments/${encodeURIComponent(departmentKey)}`),
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-user-email": currentUserEmail
        },
        body: JSON.stringify({
          name,
          owner: ownerDraft.trim(),
          ownerEmail: ownerEmailDraft.trim()
        })
      }
    );

    if (!response.ok) {
      const payload = await readJson<ApiError>(response);
      setError(payload?.error ?? `Failed to update ${labels.topLevelSingular.toLowerCase()}.`);
      setIsSaving(false);
      return;
    }

    setDisplayName(name);
    setDisplayOwner(formatOwnerLabel(ownerDraft, ownerEmailDraft));
    setIsSaving(false);
    setIsEditing(false);
    broadcastOkrRefresh("position-updated");
    router.refresh();
  };

  const deletePosition = async (): Promise<void> => {
    if (isSaving) {
      return;
    }

    if (!selectedVentureKey || !departmentKey) {
      setError(`${itemLabel} cannot be deleted right now.`);
      return;
    }

    const warning =
      objectiveCount > 0
        ? `Delete ${itemLabel.toLowerCase()} '${positionName}'? It currently has ${objectiveCount} ${objectiveCountLabel}. This will also delete related key results and KPIs.`
        : `Delete ${itemLabel.toLowerCase()} '${positionName}'? This action cannot be undone.`;

    if (!window.confirm(warning)) {
      return;
    }

    setIsSaving(true);
    setError("");

    const response = await fetch(
      apiPath(`/api/config/ventures/${encodeURIComponent(selectedVentureKey)}/departments/${encodeURIComponent(departmentKey)}`),
      {
        method: "DELETE",
        headers: {
          "x-user-email": currentUserEmail
        }
      }
    );

    if (!response.ok) {
      const payload = await readJson<ApiError>(response);
      setError(payload?.error ?? `Failed to delete ${labels.topLevelSingular.toLowerCase()}.`);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    setIsEditing(false);
    broadcastOkrRefresh("position-deleted");
    router.refresh();
  };

  return (
    <div className="board-position-shell">
      <div className="board-position-header-bar">
        <button
          type="button"
          className="board-position-toggle"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span className="board-position-toggle-indicator" aria-hidden="true" />
          <span className="board-position-toggle-main">
            <span className="board-position-toggle-text">
              <h3 className="board-group-title">{displayName}</h3>
              {displayOwner ? <p className="meta">{displayOwner}</p> : null}
            </span>
          </span>
        </button>
        <div className="board-position-header-actions">
          {objectiveWeightTrigger}
          <span className="meta">{objectiveCount} {objectiveCountLabel}</span>
          {editTrigger}
        </div>
      </div>
      {isEditing ? (
        <div className="board-position-edit-panel">
          <div className="position-header-controls">
            <div className="position-title-wrap">
              <input
                className="objective-row-input position-title-input"
                name="positionName"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                placeholder={itemLabel}
                aria-label={`${itemLabel} name`}
                autoFocus
                disabled={isSaving}
              />
            </div>
            <div className="position-title-actions">
              <div className="position-owner-edit-fields">
                <OwnerInput
                  id={`position-owner-inline-${departmentKey ?? positionName}`}
                  value={ownerDraft}
                  onChange={setOwnerDraft}
                  emailValue={ownerEmailDraft}
                  onEmailChange={setOwnerEmailDraft}
                  multiple
                  showLabel={false}
                  placeholder={`${labels.topLevelSingular} owner (optional)`}
                  disabled={isSaving}
                  inputClassName="objective-row-input"
                />
                <input
                  className="objective-row-input"
                  name="positionOwnerEmail"
                  value={formatOwnerEmailLabel(ownerDraft, ownerEmailDraft)}
                  readOnly
                  placeholder="Owner emails"
                  aria-label={`Owner email for ${labels.topLevelSingular.toLowerCase()} ${positionName}`}
                  disabled={isSaving}
                />
              </div>
              <button className="btn" type="button" onClick={() => void savePosition()} disabled={isSaving}>
                Save
              </button>
              <button className="btn btn-danger" type="button" onClick={() => void deletePosition()} disabled={isSaving}>
                Delete
              </button>
              <button className="tab-btn" type="button" onClick={closeEdit} disabled={isSaving}>
                Cancel
              </button>
            </div>
            {error ? <p className="message danger position-title-error">{error}</p> : null}
          </div>
        </div>
      ) : null}
      <div id={contentId} hidden={!isOpen}>
        {children}
      </div>
    </div>
  );
}
