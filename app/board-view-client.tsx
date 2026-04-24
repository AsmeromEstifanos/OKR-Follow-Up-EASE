"use client";

import DashboardObjectiveControls from "@/app/dashboard-objective-controls";
import DashboardPositionRowControls from "@/app/dashboard-position-row-controls";
import DashboardObjectiveRowEditor from "@/app/dashboard-objective-row-editor";
import DashboardEaseObjectiveCard from "@/app/dashboard-ease-objective-card";
import { appProfile } from "@/lib/app-profile";
import {
  includesAssignedOwnerEmail,
  includesSerializedOwnerEmail,
} from "@/lib/owner";
import type {
  BoardCardColors,
  CheckInFrequency,
  FieldOptions,
  Kpi,
  KeyResult,
  KrStatus,
  MetricType,
  Objective,
  ObjectiveStatus,
  ObjectiveType,
  OkrCycle,
} from "@/lib/types";
import { useMemo, useState, type CSSProperties, Fragment } from "react";
import useCurrentUserEmail from "./use-current-user-email";

type BoardKpiData = {
  kpi: Kpi;
  latestUpdateNotes?: string;
  latestUpdatedAt?: string | null;
};

type BoardKrData = {
  keyResult: KeyResult;
  kpis: BoardKpiData[];
  latestUpdateNotes?: string;
  latestUpdatedAt?: string | null;
};

type BoardObjectiveData = {
  objective: Objective;
  keyResults: BoardKrData[];
};

type BoardOwnerSection = {
  positionName: string;
  positionKey?: string;
  positionOwner?: string;
  positionOwnerEmail?: string;
  objectives: BoardObjectiveData[];
};

type Props = {
  selectedVentureKey?: string;
  selectedVentureName?: string;
  ownerSections: BoardOwnerSection[];
  adminEmails: string[];
  defaultStartDate?: string;
  defaultEndDate?: string;
  defaultCycle: OkrCycle;
  fieldOptions: FieldOptions;
  boardCardColors: BoardCardColors;
};

function normalizeEmail(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export default function BoardViewClient({
  selectedVentureKey,
  selectedVentureName,
  ownerSections,
  adminEmails,
  defaultStartDate,
  defaultEndDate,
  defaultCycle,
  fieldOptions,
  boardCardColors,
}: Props): JSX.Element {
  const labels = appProfile.labels;
  const objectiveLabel =
    appProfile.key === "ease-okr" ? "Objective" : labels.midLevelSingular;
  const objectiveLabelPlural =
    appProfile.key === "ease-okr" ? "Objectives" : labels.midLevelPlural;
  const positionLabel = "Position";
  const currentUserEmail = useCurrentUserEmail();
  const normalizedUserEmail = normalizeEmail(currentUserEmail);
  const [showAssignedOnly, setShowAssignedOnly] = useState(false);

  const boardColorVars = useMemo(
    () =>
      ({
        "--department-card-bg": boardCardColors.department,
        "--objective-card-bg": boardCardColors.objective,
        "--kr-card-bg": boardCardColors.keyResult,
        "--kpi-card-bg": boardCardColors.kpi,
        "--group-color": "#0f766e",
      }) as CSSProperties,
    [boardCardColors],
  );

  const filteredSections = useMemo(() => {
    if (!showAssignedOnly || !normalizedUserEmail) {
      return ownerSections;
    }

    return ownerSections
      .map((section) => {
        const matchedObjectives = section.objectives
          .map((objectiveEntry) => {
            const objectiveMatches = includesAssignedOwnerEmail(
              objectiveEntry.objective.owner,
              objectiveEntry.objective.ownerEmail,
              normalizedUserEmail,
            );

            const matchedKeyResults = objectiveEntry.keyResults
              .map((krEntry) => {
                const krMatches = includesAssignedOwnerEmail(
                  krEntry.keyResult.owner,
                  krEntry.keyResult.ownerEmail,
                  normalizedUserEmail,
                );

                const matchedKpis = krEntry.kpis.filter((item) =>
                  includesAssignedOwnerEmail(
                    item.kpi.owner,
                    item.kpi.ownerEmail,
                    normalizedUserEmail,
                  ),
                );

                if (!krMatches && matchedKpis.length === 0) {
                  return null;
                }

                return {
                  ...krEntry,
                  kpis: krMatches ? krEntry.kpis : matchedKpis,
                };
              })
              .filter((entry): entry is BoardKrData => Boolean(entry));

            if (!objectiveMatches && matchedKeyResults.length === 0) {
              return null;
            }

            return {
              ...objectiveEntry,
              keyResults: objectiveMatches
                ? objectiveEntry.keyResults
                : matchedKeyResults,
            };
          })
          .filter((entry): entry is BoardObjectiveData => Boolean(entry));

        const sectionMatches = includesSerializedOwnerEmail(
          section.positionOwnerEmail,
          normalizedUserEmail,
        );

        if (!sectionMatches && matchedObjectives.length === 0) {
          return null;
        }

        return {
          ...section,
          objectives: matchedObjectives,
        };
      })
      .filter((entry): entry is BoardOwnerSection => Boolean(entry));
  }, [normalizedUserEmail, ownerSections, showAssignedOnly]);

  return (
    <>
      <div className="section-header">
        <div className="section-header-left">
          <h2>OKR Board View</h2>
        </div>
        {normalizedUserEmail ? (
          <div className="board-visibility-filters">
            <button
              type="button"
              className={`tab-btn ${showAssignedOnly ? "tab-btn-active" : ""}`}
              onClick={() => setShowAssignedOnly((current) => !current)}
            >
              Assigned To Me
            </button>
          </div>
        ) : null}
      </div>
      {filteredSections.length === 0 ? (
        <p className="meta">
          {showAssignedOnly
            ? `No ${objectiveLabelPlural.toLowerCase()} assigned to you.`
            : `No ${objectiveLabelPlural.toLowerCase()} available.`}
        </p>
      ) : (
        <div className="board-groups">
          {filteredSections.map((section) => {
            const positionScopeKey = [
              selectedVentureKey ?? "default",
              section.positionKey ?? section.positionName,
            ].join("::");

            return (
              <section
                className="board-group"
                key={positionScopeKey}
                style={boardColorVars}
              >
                <DashboardPositionRowControls
                  key={`${positionScopeKey}::position`}
                  selectedVentureKey={selectedVentureKey}
                  departmentKey={section.positionKey}
                  positionName={section.positionName}
                  positionOwner={section.positionOwner}
                  positionOwnerEmail={section.positionOwnerEmail}
                  objectiveCount={section.objectives.length}
                  objectiveWeights={section.objectives.map((entry) => ({
                    key: entry.objective.objectiveKey,
                    label:
                      entry.objective.objectiveCode ?? entry.objective.title,
                    weight: entry.objective.baselineValue,
                  }))}
                  adminEmails={adminEmails}
                >
                  <div className="board-group-title-wrap">
                    <div className="board-group-title-row">
                      <DashboardObjectiveControls
                        key={`${positionScopeKey}::objectives`}
                        positionName={section.positionName}
                        strategicTheme={selectedVentureName ?? "SVH"}
                        defaultStartDate={defaultStartDate}
                        defaultEndDate={defaultEndDate}
                        defaultCycle={defaultCycle}
                        defaultOwner={section.positionOwner ?? ""}
                        positionOwnerEmail={section.positionOwnerEmail}
                        adminEmails={adminEmails}
                        objectiveTypeOptions={
                          fieldOptions.objectiveTypes as ObjectiveType[]
                        }
                        objectiveStatusOptions={
                          fieldOptions.objectiveStatuses as ObjectiveStatus[]
                        }
                        objectiveCycleOptions={
                          fieldOptions.objectiveCycles as OkrCycle[]
                        }
                        metricTypeOptions={
                          fieldOptions.keyResultMetricTypes as MetricType[]
                        }
                        checkInFrequencyOptions={
                          fieldOptions.checkInFrequencies as CheckInFrequency[]
                        }
                      />
                    </div>
                  </div>
                  {appProfile.key === "ease-okr" ? (
                    <div className="ease-objective-list">
                      {section.objectives.length === 0 ? (
                        <p className="meta">
                          No {objectiveLabelPlural.toLowerCase()} yet for this
                          department.
                        </p>
                      ) : (
                        section.objectives.map((entry) => (
                          <DashboardEaseObjectiveCard
                            key={entry.objective.objectiveKey}
                            objective={entry.objective}
                            keyResults={entry.keyResults}
                            positionOwnerEmail={section.positionOwnerEmail}
                            adminEmails={adminEmails}
                            objectiveTypeOptions={
                              fieldOptions.objectiveTypes as ObjectiveType[]
                            }
                            objectiveStatusOptions={
                              fieldOptions.objectiveStatuses as ObjectiveStatus[]
                            }
                            objectiveCycleOptions={
                              fieldOptions.objectiveCycles as OkrCycle[]
                            }
                            metricTypeOptions={
                              fieldOptions.keyResultMetricTypes as MetricType[]
                            }
                            keyResultStatusOptions={
                              fieldOptions.keyResultStatuses as KrStatus[]
                            }
                            checkInFrequencyOptions={
                              fieldOptions.checkInFrequencies as CheckInFrequency[]
                            }
                          />
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table className="board-table">
                        <thead>
                          <tr>
                            <th>{objectiveLabel}</th>
                            <th>Owner</th>
                            <th>{objectiveLabel} Metric Type</th>
                            <th>Weight</th>
                            <th>Target Value</th>
                            <th>Current Value</th>
                            <th>Progress %</th>
                            <th>Health</th>
                            <th>Due Date</th>
                            <th>Check-in Frequency</th>
                            <th>Blockers</th>
                            <th>Key Risks/Dependancy</th>
                            <th>Notes</th>
                            <th>Last updated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.objectives.length === 0 ? (
                            <tr className="board-empty-row">
                              <td colSpan={14}>
                                No {objectiveLabelPlural.toLowerCase()} yet for
                                this {positionLabel.toLowerCase()}.
                              </td>
                            </tr>
                          ) : (
                            section.objectives.map((entry) => (
                              <Fragment key={entry.objective.objectiveKey}>
                                <DashboardObjectiveRowEditor
                                  objective={entry.objective}
                                  keyResults={entry.keyResults}
                                  positionOwnerEmail={section.positionOwnerEmail}
                                  adminEmails={adminEmails}
                                  objectiveTypeOptions={
                                    fieldOptions.objectiveTypes as ObjectiveType[]
                                  }
                                  objectiveStatusOptions={
                                    fieldOptions.objectiveStatuses as ObjectiveStatus[]
                                  }
                                  objectiveCycleOptions={
                                    fieldOptions.objectiveCycles as OkrCycle[]
                                  }
                                  metricTypeOptions={
                                    fieldOptions.keyResultMetricTypes as MetricType[]
                                  }
                                  keyResultStatusOptions={
                                    fieldOptions.keyResultStatuses as KrStatus[]
                                  }
                                  checkInFrequencyOptions={
                                    fieldOptions.checkInFrequencies as CheckInFrequency[]
                                  }
                                />
                              </Fragment>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </DashboardPositionRowControls>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
