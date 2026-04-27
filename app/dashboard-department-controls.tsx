"use client";

import OwnerInput from "@/app/owner-input";
import useCurrentUserEmail from "@/app/use-current-user-email";
import { apiPath } from "@/lib/base-path";
import { appProfile } from "@/lib/app-profile";
import {
  formatOwnerEmailLabel,
  includesAssignedOwnerEmail,
} from "@/lib/owner";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Props = {
  selectedVentureKey?: string;
  selectedVentureOwner?: string;
  selectedVentureOwnerEmail?: string;
  adminEmails: string[];
  compact?: boolean;
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

function normalizeEmail(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export default function DashboardDepartmentControls({
  selectedVentureKey,
  selectedVentureOwner,
  selectedVentureOwnerEmail,
  adminEmails,
  compact = false,
}: Props): JSX.Element | null {
  const router = useRouter();
  const currentUserEmail = useCurrentUserEmail();
  const labels = appProfile.labels;
  const itemLabel = appProfile.key === "ease-okr" ? "OKR" : labels.topLevelSingular;
  const normalizedUserEmail = normalizeEmail(currentUserEmail);
  const isAdmin = adminEmails
    .map((entry) => normalizeEmail(entry))
    .includes(normalizedUserEmail);
  const canCreate =
    Boolean(selectedVentureKey && normalizedUserEmail) &&
    (isAdmin ||
      includesAssignedOwnerEmail(
        selectedVentureOwner,
        selectedVentureOwnerEmail,
        normalizedUserEmail,
      ));

  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [error, setError] = useState("");

  if (!canCreate || !selectedVentureKey) {
    return null;
  }

  const closeAdd = (): void => {
    if (isSaving) {
      return;
    }

    setIsAdding(false);
    setName("");
    setOwner("");
    setOwnerEmail("");
    setError("");
  };

  const openAdd = (): void => {
    setIsAdding(true);
    setError("");
  };

  const createDepartment = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(`${itemLabel} name is required.`);
      return;
    }

    setIsSaving(true);
    setError("");

    const response = await fetch(
      apiPath(
        `/api/config/ventures/${encodeURIComponent(selectedVentureKey)}/departments`,
      ),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-email": currentUserEmail,
        },
        body: JSON.stringify({
          name: trimmedName,
          owner: owner.trim(),
          ownerEmail: ownerEmail.trim(),
        }),
      },
    );
    const payload = await readJson<ApiError>(response);

    if (!response.ok) {
      setError(payload?.error ?? `Failed to add ${itemLabel}.`);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    closeAdd();
    router.refresh();
  };

  return (
    <div className="board-top-level-controls">
      <button
        type="button"
        className={`${
          compact ? "board-add-icon-btn" : "tab-btn"
        } ${isAdding ? "tab-btn-active" : ""}`.trim()}
        onClick={isAdding ? closeAdd : openAdd}
        disabled={isSaving}
        aria-label={`Add ${itemLabel}`}
        title={`Add ${itemLabel}`}
      >
        {compact ? (
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M12 5c.55 0 1 .45 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6c0-.55.45-1 1-1Z"
              fill="currentColor"
            />
          </svg>
        ) : (
          `Add ${itemLabel}`
        )}
      </button>
      {isAdding ? (
        <form
          className="board-top-level-form"
          onSubmit={(event) => void createDepartment(event)}
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={`${itemLabel} name`}
            aria-label={`${itemLabel} name`}
            autoFocus
            disabled={isSaving}
          />
          <OwnerInput
            id="board-department-owner"
            value={owner}
            onChange={setOwner}
            emailValue={ownerEmail}
            onEmailChange={setOwnerEmail}
            multiple
            showLabel={false}
            placeholder={`${itemLabel} owner (optional)`}
            disabled={isSaving}
            inputClassName="objective-row-input"
          />
          <input
            value={formatOwnerEmailLabel(owner, ownerEmail)}
            readOnly
            placeholder="Owner emails"
            aria-label={`${itemLabel} owner emails`}
            disabled={isSaving}
          />
          <button className="btn btn-add" type="submit" disabled={isSaving}>
            Save
          </button>
          <button
            className="tab-btn"
            type="button"
            onClick={closeAdd}
            disabled={isSaving}
          >
            Cancel
          </button>
        </form>
      ) : null}
      {error ? <p className="message danger">{error}</p> : null}
    </div>
  );
}
