"use client";

type Props = {
  note?: string | null;
  blockers?: string | null;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export default function EaseCardDetailBlocks({
  note,
  blockers,
}: Props): JSX.Element | null {
  const noteText = normalizeText(note);
  const blockerText = normalizeText(blockers);

  if (!noteText && !blockerText) {
    return null;
  }

  return (
    <div className="ease-card-details">
      {noteText ? (
        <div className="ease-card-detail ease-card-detail-note">
          <span className="ease-card-detail-tag ease-card-detail-tag-note">
            Note
          </span>
          <div className="ease-card-detail-body">{noteText}</div>
        </div>
      ) : null}
      {blockerText ? (
        <div className="ease-card-detail ease-card-detail-blockers">
          <span className="ease-card-detail-tag ease-card-detail-tag-blockers">
            Blockers
          </span>
          <div className="ease-card-detail-body">{blockerText}</div>
        </div>
      ) : null}
    </div>
  );
}
