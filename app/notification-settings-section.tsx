"use client";

import useCurrentUserEmail from "@/app/use-current-user-email";
import { apiPath } from "@/lib/base-path";
import type { NotificationSettings, RuleSettings } from "@/lib/notification-settings";
import {
  RULE_DEFINITIONS,
  RULE_IDS,
  effectiveRule,
  formatScheduleLabel,
  type RuleId
} from "@/lib/notification-rules";
import { useEffect, useState } from "react";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function defaultSettingsFor(id: RuleId): RuleSettings {
  const def = RULE_DEFINITIONS[id];
  return {
    enabled: true,
    hour: "hour" in def.schedule ? def.schedule.hour : 9,
    minute: "minute" in def.schedule ? def.schedule.minute : 0,
    dayOfWeek: def.schedule.kind === "weekly" ? def.schedule.dayOfWeek : 1,
    dayOfMonth: def.schedule.kind === "monthly" ? def.schedule.dayOfMonth : 1,
    message: def.message
  };
}

function buildFallbackSettings(): NotificationSettings {
  const rules = RULE_IDS.reduce(
    (acc, id) => {
      acc[id] = defaultSettingsFor(id);
      return acc;
    },
    {} as Record<RuleId, RuleSettings>
  );
  return { rules, changeAlerts: { enabled: false, recipients: [], trigger: "all" as const } };
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function parseTimeInput(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export default function NotificationSettingsSection(): JSX.Element {
  const userEmail = useCurrentUserEmail();
  const [settings, setSettings] = useState<NotificationSettings>(() => buildFallbackSettings());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [expandedId, setExpandedId] = useState<RuleId | null>(null);

  useEffect(() => {
    if (!userEmail) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const res = await fetch(apiPath("/api/notifications/settings"), {
          headers: { "x-user-email": userEmail },
          cache: "no-store"
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Failed to load settings.");
        }
        const data = (await res.json()) as NotificationSettings;
        if (!cancelled) setSettings(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load settings.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userEmail]);

  async function saveSettings(): Promise<void> {
    if (!userEmail || isSaving) return;
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(apiPath("/api/notifications/settings"), {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-user-email": userEmail },
        body: JSON.stringify(settings)
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to save settings.");
      }
      const saved = (await res.json()) as NotificationSettings;
      setSettings(saved);
      setMessage("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateRule(id: RuleId, patch: Partial<RuleSettings>): void {
    setSettings((prev) => {
      const next = {
        ...prev,
        rules: { ...prev.rules, [id]: { ...prev.rules[id], ...patch } }
      };
      // Auto-save immediately when toggling enabled so the user doesn't need to
      // remember to click Save for simple on/off changes.
      if ("enabled" in patch) {
        void (async () => {
          if (!userEmail) return;
          await fetch(apiPath("/api/notifications/settings"), {
            method: "PATCH",
            headers: { "content-type": "application/json", "x-user-email": userEmail },
            body: JSON.stringify(next)
          });
        })();
      }
      return next;
    });
  }

  function resetRule(id: RuleId): void {
    setSettings((prev) => ({
      ...prev,
      rules: { ...prev.rules, [id]: { ...defaultSettingsFor(id), enabled: prev.rules[id]?.enabled ?? true } }
    }));
  }

  if (isLoading) {
    return <p className="meta">Loading notification settings…</p>;
  }

  return (
    <>
      {error ? <p className="message danger">{error}</p> : null}
      {message ? <p className="message success">{message}</p> : null}

      <div className="notif-compact-list">
        {RULE_IDS.map((id) => {
          const def = RULE_DEFINITIONS[id];
          const cfg = settings.rules[id] ?? defaultSettingsFor(id);
          const eff = effectiveRule(id, cfg);
          const kind = def.schedule.kind;
          const timeValue = `${pad2(cfg.hour)}:${pad2(cfg.minute)}`;
          const isExpanded = expandedId === id;

          return (
            <div key={id} className={`notif-compact-row${isExpanded ? " notif-compact-row-open" : ""}`}>
              {/* Summary line */}
              <div className="notif-compact-head">
                <label className="notif-compact-toggle">
                  <input
                    type="checkbox"
                    checked={cfg.enabled}
                    onChange={(e) => updateRule(id, { enabled: e.target.checked })}
                    disabled={isSaving}
                  />
                </label>
                <div className="notif-compact-info">
                  <span className="notif-compact-name">{def.label}</span>
                  <span className="notif-compact-schedule">{formatScheduleLabel(eff.schedule)}</span>
                </div>
                <button
                  type="button"
                  className="notif-compact-edit-btn"
                  onClick={() => setExpandedId(isExpanded ? null : id)}
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? "Collapse" : "Edit schedule and message"}
                >
                  {isExpanded ? "▲" : "▼"}
                </button>
              </div>

              {/* Expanded edit panel */}
              {isExpanded && (
                <div className="notif-compact-body">
                  <div className="notif-rule-fields">
                    {kind === "weekly" && (
                      <label className="notif-rule-field">
                        Day
                        <select
                          value={cfg.dayOfWeek}
                          onChange={(e) => updateRule(id, { dayOfWeek: Number(e.target.value) })}
                          disabled={isSaving || !cfg.enabled}
                        >
                          {DAY_NAMES.map((dayLabel, idx) => (
                            <option key={idx} value={idx}>{dayLabel}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    {kind === "monthly" && (
                      <label className="notif-rule-field">
                        Day of month
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={cfg.dayOfMonth}
                          onChange={(e) => updateRule(id, { dayOfMonth: Number(e.target.value) || 1 })}
                          disabled={isSaving || !cfg.enabled}
                        />
                      </label>
                    )}
                    <label className="notif-rule-field">
                      Time
                      <input
                        type="time"
                        value={timeValue}
                        onChange={(e) => {
                          const parsed = parseTimeInput(e.target.value);
                          if (parsed) updateRule(id, { hour: parsed.hour, minute: parsed.minute });
                        }}
                        disabled={isSaving || !cfg.enabled}
                      />
                    </label>
                  </div>
                  <label className="notif-rule-field notif-rule-field-message">
                    Message
                    <textarea
                      value={cfg.message}
                      onChange={(e) => updateRule(id, { message: e.target.value })}
                      disabled={isSaving || !cfg.enabled}
                      rows={2}
                    />
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.4rem" }}>
                    <p className="notif-rule-shows" style={{ margin: 0 }}>
                      <span className="notif-rule-shows-label">Shows: </span>{def.contentLabel}
                    </p>
                    <button
                      type="button"
                      className="notif-rule-reset"
                      onClick={() => resetRule(id)}
                      disabled={isSaving}
                    >
                      Reset to defaults
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="notif-settings-save-row">
        <button type="button" className="btn" onClick={() => void saveSettings()} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </>
  );
}
