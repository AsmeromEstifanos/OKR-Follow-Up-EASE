"use client";

type Props = {
  note?: string | null;
  blockers?: string | null;
  comment?: string | null;
  keyRisksDependency?: string | null;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export default function EaseCardDetailBlocks({
  note,
  blockers,
  comment,
  keyRisksDependency,
}: Props): JSX.Element | null {
  const noteText = normalizeText(note);
  const blockerText = normalizeText(blockers);
  const commentText = normalizeText(comment);
  const keyRisksDependencyText = normalizeText(keyRisksDependency);

  if (!noteText && !blockerText && !commentText && !keyRisksDependencyText) {
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
      {commentText ? (
        <div className="ease-card-detail ease-card-detail-comment">
          <span className="ease-card-detail-tag ease-card-detail-tag-comment">
            Comment
          </span>
          <div className="ease-card-detail-body">{commentText}</div>
        </div>
      ) : null}
      {keyRisksDependencyText ? (
        <div className="ease-card-detail ease-card-detail-risks">
          <span className="ease-card-detail-tag ease-card-detail-tag-risks">
            Key Risks/Dependency
          </span>
          <div className="ease-card-detail-body">{keyRisksDependencyText}</div>
        </div>
      ) : null}
    </div>
  );
}
