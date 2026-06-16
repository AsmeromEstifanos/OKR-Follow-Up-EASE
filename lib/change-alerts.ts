import { readNotificationSettings } from "@/lib/notification-settings";
import { parseAssignedOwners } from "@/lib/owner";
import { emailAppButton } from "@/lib/app-url";

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

type GraphAppConfig = { tenantId: string; clientId: string; clientSecret: string };

const STATUS_PROGRESS_FIELDS = new Set([
  "status", "progressPct", "rag", "currentValue", "health", "confidence"
]);

const SKIP_FIELDS = new Set([
  "lastCheckinAt", "objectiveKey", "krKey", "kpiKey", "periodKey",
  "kpiCode", "krCode", "objectiveCode"
]);

const FIELD_LABELS: Record<string, string> = {
  title: "Title", owner: "Owner", ownerEmail: "Owner Email",
  status: "Status", progressPct: "Progress %", rag: "RAG",
  currentValue: "Current Value", targetValue: "Target Value", baselineValue: "Weight",
  objectiveType: "Objective Type", okrCycle: "OKR Cycle",
  checkInFrequency: "Check-in Frequency", dueDate: "Due Date",
  blockers: "Blockers", notes: "Notes", comment: "Comment",
  keyRisksDependency: "Key Risks / Dependency", constraintGuardrails: "Constraint / Guardrails",
  health: "Health", confidence: "Confidence", department: "Department",
  strategicTheme: "Strategic Theme"
};

export type CascadeContext = {
  krLabel: string;
  krProgressBefore: number;
  krProgressAfter: number;
  objectiveLabel: string;
  objectiveProgressBefore: number;
  objectiveProgressAfter: number;
};

export type ChangeAlertPayload = {
  entityType: "objective" | "kr" | "kpi";
  entityLabel: string;
  ownerEmail?: string;
  changedBy: string;
  diffJson: string;
  isNew: boolean;
  cascade?: CascadeContext;
};

function getGraphAppConfig(): GraphAppConfig | null {
  const tenantId = (process.env.AZURE_APP_TENANT_ID ?? process.env.AZURE_TENANT_ID ?? process.env.NEXT_PUBLIC_AAD_TENANT_ID ?? "").trim();
  const clientId = (process.env.AZURE_APP_CLIENT_ID ?? process.env.AZURE_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.AZURE_APP_CLIENT_SECRET ?? process.env.AZURE_CLIENT_SECRET ?? "").trim();
  if (!tenantId || !clientId || !clientSecret) return null;
  return { tenantId, clientId, clientSecret };
}

async function acquireToken(config: GraphAppConfig): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default"
  });
  const response = await fetch(tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString(), cache: "no-store" });
  if (!response.ok) throw new Error(`Token error: ${response.status}`);
  const json = (await response.json()) as { access_token: string };
  return json.access_token;
}

function entityTypeLabel(type: string): string {
  if (type === "kr") return "Key Result";
  if (type === "kpi") return "KPI";
  return "Objective";
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(empty)";
  return String(value);
}

function buildDiffRows(diffJson: string): Array<{ field: string; from: string; to: string }> {
  try {
    const parsed = JSON.parse(diffJson) as { changes?: Array<{ field: string; from: unknown; to: unknown }> };
    if (!Array.isArray(parsed.changes)) return [];
    return parsed.changes
      .filter((c) => !SKIP_FIELDS.has(c.field))
      .map((c) => ({ field: FIELD_LABELS[c.field] ?? c.field, from: formatValue(c.from), to: formatValue(c.to) }));
  } catch {
    return [];
  }
}

function progressBar(pct: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const color = clamped >= 70 ? "#22c55e" : clamped >= 40 ? "#f59e0b" : "#ef4444";
  return `<span style="display:inline-block;width:80px;height:8px;background:#e5e7eb;border-radius:4px;vertical-align:middle;margin-right:6px"><span style="display:block;width:${clamped}%;height:100%;background:${color};border-radius:4px"></span></span>${clamped}%`;
}

function buildCascadeHtml(cascade: CascadeContext): string {
  const krChanged = Math.round(cascade.krProgressBefore) !== Math.round(cascade.krProgressAfter);
  const objChanged = Math.round(cascade.objectiveProgressBefore) !== Math.round(cascade.objectiveProgressAfter);
  if (!krChanged && !objChanged) return "";

  const rows = [
    krChanged ? `
      <tr>
        <td style="padding:6px 10px;border:1px solid #e5e7eb;font-weight:600">Key Result</td>
        <td style="padding:6px 10px;border:1px solid #e5e7eb;color:#6b7280;font-size:0.85rem">${cascade.krLabel}</td>
        <td style="padding:6px 10px;border:1px solid #e5e7eb">${progressBar(cascade.krProgressBefore)}</td>
        <td style="padding:6px 10px;border:1px solid #e5e7eb">${progressBar(cascade.krProgressAfter)}</td>
      </tr>` : "",
    objChanged ? `
      <tr>
        <td style="padding:6px 10px;border:1px solid #e5e7eb;font-weight:600">Objective</td>
        <td style="padding:6px 10px;border:1px solid #e5e7eb;color:#6b7280;font-size:0.85rem">${cascade.objectiveLabel}</td>
        <td style="padding:6px 10px;border:1px solid #e5e7eb">${progressBar(cascade.objectiveProgressBefore)}</td>
        <td style="padding:6px 10px;border:1px solid #e5e7eb">${progressBar(cascade.objectiveProgressAfter)}</td>
      </tr>` : ""
  ].filter(Boolean).join("");

  return `
    <h3 style="color:#374151;font-size:0.9rem;margin:20px 0 8px;text-transform:uppercase;letter-spacing:0.05em">Cascade Impact</h3>
    <table style="border-collapse:collapse;width:100%;font-size:0.9rem">
      <thead><tr style="background:#f3f4f6">
        <th style="padding:6px 10px;text-align:left;border:1px solid #e5e7eb"></th>
        <th style="padding:6px 10px;text-align:left;border:1px solid #e5e7eb"></th>
        <th style="padding:6px 10px;text-align:left;border:1px solid #e5e7eb">Before</th>
        <th style="padding:6px 10px;text-align:left;border:1px solid #e5e7eb">After</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function buildHtml(payload: ChangeAlertPayload): string {
  const { entityType, entityLabel, changedBy, diffJson, isNew, cascade } = payload;
  const typeLabel = entityTypeLabel(entityType);
  const rows = isNew ? [] : buildDiffRows(diffJson);
  const now = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  const changesHtml = isNew
    ? `<p style="color:#374151">A new ${typeLabel.toLowerCase()} was created.</p>`
    : rows.length === 0
      ? `<p style="color:#374151">Fields were updated.</p>`
      : `<table style="border-collapse:collapse;width:100%;font-size:0.9rem">
          <thead><tr style="background:#f3f4f6">
            <th style="padding:6px 10px;text-align:left;border:1px solid #e5e7eb">Field</th>
            <th style="padding:6px 10px;text-align:left;border:1px solid #e5e7eb">Before</th>
            <th style="padding:6px 10px;text-align:left;border:1px solid #e5e7eb">After</th>
          </tr></thead>
          <tbody>${rows.map((r) => `
            <tr>
              <td style="padding:6px 10px;border:1px solid #e5e7eb;font-weight:600">${r.field}</td>
              <td style="padding:6px 10px;border:1px solid #e5e7eb;color:#6b7280">${r.from}</td>
              <td style="padding:6px 10px;border:1px solid #e5e7eb;color:#111827">${r.to}</td>
            </tr>`).join("")}
          </tbody>
        </table>`;

  const cascadeHtml = cascade ? buildCascadeHtml(cascade) : "";

  return `<div style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:24px">
    <h2 style="color:#111827;margin:0 0 4px">${isNew ? `New ${typeLabel} created` : `${typeLabel} updated`}</h2>
    <p style="color:#6b7280;margin:0 0 20px;font-size:0.9rem">${now} &mdash; by ${changedBy || "unknown"}</p>
    <p style="font-weight:600;margin:0 0 16px;color:#1d3d52">${entityLabel}</p>
    ${changesHtml}
    ${cascadeHtml}
    ${emailAppButton()}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
    <p style="color:#9ca3af;font-size:0.8rem">OKR Follow-Up &mdash; automated change alert</p>
  </div>`;
}

function buildRecipients(configuredRecipients: string[], ownerEmail?: string): string[] {
  const recipients = new Map<string, string>();
  const add = (value: string): void => {
    const email = value.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    recipients.set(email, email);
  };

  configuredRecipients.forEach(add);
  parseAssignedOwners(undefined, ownerEmail).forEach((owner) => add(owner.email));

  return Array.from(recipients.values());
}

export async function sendChangeAlert(payload: ChangeAlertPayload): Promise<void> {
  try {
    const settings = await readNotificationSettings();
    const { changeAlerts } = settings;
    if (!changeAlerts.enabled) return;

    if (!payload.isNew && changeAlerts.trigger === "new_only") return;
    if (!payload.isNew && changeAlerts.trigger === "status_progress") {
      try {
        const parsed = JSON.parse(payload.diffJson) as { changes?: Array<{ field: string }> };
        const hasRelevant = Array.isArray(parsed.changes) && parsed.changes.some((c) => STATUS_PROGRESS_FIELDS.has(c.field));
        if (!hasRelevant) return;
      } catch {
        return;
      }
    }

    const config = getGraphAppConfig();
    const fromEmail = (process.env.NOTIFICATION_FROM_EMAIL ?? "").trim();
    if (!config || !fromEmail) return;

    const token = await acquireToken(config);
    const typeLabel = entityTypeLabel(payload.entityType);
    const subject = payload.isNew
      ? `[OKR] New ${typeLabel}: ${payload.entityLabel}`
      : `[OKR] ${typeLabel} updated: ${payload.entityLabel}`;
    const recipients = buildRecipients(changeAlerts.recipients, payload.ownerEmail);
    if (recipients.length === 0) return;

    const url = `${GRAPH_BASE_URL}/users/${encodeURIComponent(fromEmail)}/sendMail`;
    const body = {
      message: {
        subject,
        body: { contentType: "HTML", content: buildHtml(payload) },
        toRecipients: recipients.map((addr) => ({ emailAddress: { address: addr } }))
      },
      saveToSentItems: false
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store"
    });

    if (!response.ok) {
      const msg = await response.text();
      throw new Error(`sendMail failed: ${response.status} ${msg}`);
    }
  } catch {
    // Change alerts are best-effort — never propagate
  }
}
