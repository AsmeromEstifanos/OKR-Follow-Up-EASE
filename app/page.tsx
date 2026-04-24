import DashboardObjectiveControls from "@/app/dashboard-objective-controls";
import DashboardPositionControls from "@/app/dashboard-position-controls";
import DashboardPositionRowControls from "@/app/dashboard-position-row-controls";
import DashboardObjectiveRowEditor from "@/app/dashboard-objective-row-editor";
import DashboardEaseObjectiveCard from "@/app/dashboard-ease-objective-card";
import DashboardVentureTabs from "@/app/dashboard-venture-tabs";
import { appProfile } from "@/lib/app-profile";
import { objectiveBelongsToVenture } from "@/lib/objective-scope";
import {
  getConfig,
  listAdminEmails,
  listCheckIns,
  listKeyResults,
  listKpis,
  listObjectives,
  listPeriods,
} from "@/lib/store";
import type { CheckIn, Objective, OkrCycle, Venture } from "@/lib/types";
import { Fragment, type CSSProperties } from "react";

export const dynamic = "force-dynamic";

type OwnerSection = {
  positionName: string;
  positionKey?: string;
  positionOwner?: string;
  positionOwnerEmail?: string;
  objectives: Objective[];
};

type DashboardPageProps = {
  searchParams?:
    | {
        ventureKey?: string | string[];
      }
    | Promise<{
        ventureKey?: string | string[];
      }>;
};

function getSearchParamValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

async function resolveSearchParams(
  searchParams: DashboardPageProps["searchParams"],
): Promise<{ ventureKey?: string | string[] }> {
  if (!searchParams) {
    return {};
  }

  if ("then" in searchParams) {
    return searchParams;
  }

  return searchParams;
}

function getCycleFromDate(value: string): OkrCycle {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Q1";
  }

  const quarter = Math.floor(date.getMonth() / 3) + 1;
  if (quarter === 1) {
    return "Q1";
  }

  if (quarter === 2) {
    return "Q2";
  }

  if (quarter === 3) {
    return "Q3";
  }

  return "Q4";
}

function getMostRecentTimestamp(
  primary: string | null | undefined,
  fallback: string | null | undefined,
): string | null {
  const candidates = [primary, fallback]
    .map((value) => (typeof value === "string" ? value : ""))
    .filter((value) => Boolean(value))
    .sort((left, right) => left.localeCompare(right));

  return candidates.at(-1) ?? null;
}

function normalizeScopePart(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function getKrScopeKey(objectiveKey: string, krKey: string): string {
  return `${normalizeScopePart(objectiveKey)}::${normalizeScopePart(krKey)}`;
}

function getKpiScopeKey(
  objectiveKey: string,
  krKey: string,
  kpiKey: string,
): string {
  return `${getKrScopeKey(objectiveKey, krKey)}::${normalizeScopePart(kpiKey)}`;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps): Promise<JSX.Element> {
  const labels = appProfile.labels;
  const objectiveLabel = appProfile.key === "ease-okr" ? "Objective" : labels.midLevelSingular;
  const objectiveLabelPlural = appProfile.key === "ease-okr" ? "Objectives" : labels.midLevelPlural;
  const positionLabel = "Position";
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const config = await getConfig();
  const boardColorVars = {
    "--department-card-bg": config.boardCardColors.department,
    "--objective-card-bg": config.boardCardColors.objective,
    "--kr-card-bg": config.boardCardColors.keyResult,
    "--kpi-card-bg": config.boardCardColors.kpi,
    "--group-color": config.boardCardColors.department
  } as CSSProperties;
  const ventures = config.ventures;
  const fieldOptions = config.fieldOptions;
  const adminEmails = await listAdminEmails();
  if (ventures.length === 0) {
    return (
      <div className="dashboard-page">
        {appProfile.showVentureTabs ? (
          <DashboardVentureTabs
            ventures={ventures}
            selectedVentureKey={undefined}
            adminEmails={adminEmails}
          />
        ) : null}
        <section className="section">
          <p className="meta">No {labels.venturePlural.toLowerCase()} configured.</p>
        </section>
      </div>
    );
  }
  const periods = await listPeriods();
  const defaultPeriod =
    periods.find((period) => period.status === "Active") ?? periods[0];
  const defaultCycle = defaultPeriod
    ? getCycleFromDate(defaultPeriod.startDate)
    : "Q1";
  const requestedVentureKey = getSearchParamValue(
    resolvedSearchParams?.ventureKey,
  )?.trim();
  const selectedVenture = requestedVentureKey
    ? (ventures.find(
        (venture) =>
          venture.ventureKey.toLowerCase() ===
          requestedVentureKey.toLowerCase(),
      ) ?? ventures[0])
    : ventures[0];

  const allObjectives = (await listObjectives()).filter((objective) => {
    if (!selectedVenture) {
      return true;
    }

    return objectiveBelongsToVenture(objective, selectedVenture);
  });

  const objectiveKeys = new Set(
    allObjectives.map((objective) => objective.objectiveKey.toLowerCase()),
  );
  const allKeyResults = (await listKeyResults()).filter((kr) =>
    objectiveKeys.has(kr.objectiveKey.toLowerCase()),
  );
  const keyResultScopeKeys = new Set(
    allKeyResults.map((kr) => getKrScopeKey(kr.objectiveKey, kr.krKey)),
  );
  const allKpis = (await listKpis()).filter((kpi) =>
    keyResultScopeKeys.has(getKrScopeKey(kpi.objectiveKey, kpi.krKey)),
  );

  const latestCheckinByEntity = (await listCheckIns()).reduce<Map<string, CheckIn>>(
    (map, checkIn) => {
      const key = checkIn.kpiKey
        ? getKpiScopeKey(checkIn.objectiveKey, checkIn.krKey, checkIn.kpiKey)
        : getKrScopeKey(checkIn.objectiveKey, checkIn.krKey);
      const current = map.get(key);

      if (!current || current.checkInAt.localeCompare(checkIn.checkInAt) < 0) {
        map.set(key, checkIn);
      }

      return map;
    },
    new Map(),
  );

  const keyResultsByObjective = allKeyResults.reduce<
    Map<string, typeof allKeyResults>
  >((map, kr) => {
    const current = map.get(kr.objectiveKey) ?? [];
    current.push(kr);
    map.set(kr.objectiveKey, current);
    return map;
  }, new Map());
  const kpisByKr = allKpis.reduce<Map<string, typeof allKpis>>((map, kpi) => {
    const scopeKey = getKrScopeKey(kpi.objectiveKey, kpi.krKey);
    const current = map.get(scopeKey) ?? [];
    current.push(kpi);
    map.set(scopeKey, current);
    return map;
  }, new Map());
  const objectivesByPosition = allObjectives.reduce<Map<string, Objective[]>>(
    (map, objective) => {
      const key = objective.department.toLowerCase();
      const current = map.get(key) ?? [];
      current.push(objective);
      map.set(key, current);
      return map;
    },
    new Map(),
  );

  const configuredPositions =
    selectedVenture?.departments.map((department) => department.name) ?? [];
  const defaultDepartment = selectedVenture?.departments[0];
  const easeDepartmentName =
    defaultDepartment?.name ?? allObjectives[0]?.department ?? "";
  const easeDepartmentOwner = defaultDepartment?.owner ?? "";
  const easeDepartmentOwnerEmail = defaultDepartment?.ownerEmail ?? "";
  const configuredPositionByName = new Map(
    (selectedVenture?.departments ?? []).map(
      (department) =>
        [
          department.name.toLowerCase(),
          {
            departmentKey: department.departmentKey,
            owner: department.owner,
            ownerEmail: department.ownerEmail,
          },
        ] as const,
    ),
  );
  const objectivePositions = Array.from(
    new Set(allObjectives.map((objective) => objective.department)),
  );
  const orderedPositions = [...configuredPositions];

  objectivePositions.forEach((position) => {
    if (
      orderedPositions.some(
        (item) => item.toLowerCase() === position.toLowerCase(),
      )
    ) {
      return;
    }

    orderedPositions.push(position);
  });

  const ownerSections = orderedPositions.map<OwnerSection>((positionName) => {
    return {
      positionName,
      positionKey: configuredPositionByName.get(positionName.toLowerCase())
        ?.departmentKey,
      positionOwner: configuredPositionByName.get(positionName.toLowerCase())
        ?.owner,
      positionOwnerEmail: configuredPositionByName.get(
        positionName.toLowerCase(),
      )?.ownerEmail,
      objectives: objectivesByPosition.get(positionName.toLowerCase()) ?? [],
    };
  });

  return (
    <div className="dashboard-page">
      {appProfile.showVentureTabs ? (
        <DashboardVentureTabs
          ventures={ventures}
          selectedVentureKey={selectedVenture?.ventureKey}
          adminEmails={adminEmails}
        />
      ) : null}

      <section className="section">
        <div className="section-header">
          <div className="section-header-left">
            <h2>OKR Board View</h2>
            {appProfile.key === "ease-okr" ? null : (
              <DashboardPositionControls
                selectedVentureKey={selectedVenture?.ventureKey}
                existingPositionNames={configuredPositions}
                adminEmails={adminEmails}
              />
            )}
          </div>
        </div>
        {appProfile.key === "ease-okr" ? (
          ownerSections.length === 0 ? (
            <p className="meta">No {objectiveLabelPlural.toLowerCase()} available.</p>
        ) : (
          <div className="board-groups">
              {ownerSections.map((section) => {
                const sectionStyle = boardColorVars;
                const positionScopeKey = [
                  selectedVenture?.ventureKey ?? "default",
                  section.positionKey ?? section.positionName
                ].join("::");

                return (
                  <section className="board-group" key={positionScopeKey} style={sectionStyle}>
                    <DashboardPositionRowControls
                      key={`${positionScopeKey}::position`}
                      selectedVentureKey={selectedVenture?.ventureKey}
                      departmentKey={section.positionKey}
                      positionName={section.positionName}
                      positionOwner={section.positionOwner}
                      positionOwnerEmail={section.positionOwnerEmail}
                      objectiveCount={section.objectives.length}
                      objectiveWeights={section.objectives.map((objective) => ({
                        key: objective.objectiveKey,
                        label: objective.objectiveCode ?? objective.title,
                        weight: objective.baselineValue
                      }))}
                      adminEmails={adminEmails}
                    >
                      <div className="board-group-title-wrap">
                        <div className="board-group-title-row">
                          <DashboardObjectiveControls
                            key={`${positionScopeKey}::objectives`}
                            positionName={section.positionName}
                            strategicTheme={selectedVenture?.name ?? "SVH"}
                            defaultStartDate={defaultPeriod?.startDate}
                            defaultEndDate={defaultPeriod?.endDate}
                            defaultCycle={defaultCycle}
                            defaultOwner={section.positionOwner ?? ""}
                            positionOwnerEmail={section.positionOwnerEmail}
                            adminEmails={adminEmails}
                            objectiveTypeOptions={fieldOptions.objectiveTypes}
                            objectiveStatusOptions={fieldOptions.objectiveStatuses}
                            objectiveCycleOptions={fieldOptions.objectiveCycles}
                            metricTypeOptions={fieldOptions.keyResultMetricTypes}
                            checkInFrequencyOptions={fieldOptions.checkInFrequencies}
                          />
                        </div>
                      </div>
                      <div className="ease-objective-list">
                        {section.objectives.length === 0 ? (
                          <p className="meta">No {objectiveLabelPlural.toLowerCase()} yet for this department.</p>
                        ) : (
                          section.objectives.map((objective) => {
                            const keyResults = keyResultsByObjective.get(objective.objectiveKey) ?? [];
                            return (
                              <DashboardEaseObjectiveCard
                                key={objective.objectiveKey}
                                objective={objective}
                                keyResults={keyResults.map((kr) => {
                                  const krScopeKey = getKrScopeKey(kr.objectiveKey, kr.krKey);
                                  const latest = latestCheckinByEntity.get(krScopeKey);
                                  return {
                                    keyResult: kr,
                                    kpis: (kpisByKr.get(krScopeKey) ?? []).map((kpi) => {
                                      const latestKpi = latestCheckinByEntity.get(
                                        getKpiScopeKey(kpi.objectiveKey, kpi.krKey, kpi.kpiKey),
                                      );
                                      return {
                                        kpi,
                                        latestUpdateNotes: latestKpi?.updateNotes,
                                        latestUpdatedAt: getMostRecentTimestamp(latestKpi?.checkInAt, kpi.lastCheckinAt)
                                      };
                                    }),
                                    latestUpdateNotes: latest?.updateNotes,
                                    latestUpdatedAt: getMostRecentTimestamp(latest?.checkInAt, kr.lastCheckinAt)
                                  };
                                })}
                                positionOwnerEmail={section.positionOwnerEmail}
                                adminEmails={adminEmails}
                                objectiveTypeOptions={fieldOptions.objectiveTypes}
                                objectiveStatusOptions={fieldOptions.objectiveStatuses}
                                objectiveCycleOptions={fieldOptions.objectiveCycles}
                                metricTypeOptions={fieldOptions.keyResultMetricTypes}
                                keyResultStatusOptions={fieldOptions.keyResultStatuses}
                                checkInFrequencyOptions={fieldOptions.checkInFrequencies}
                              />
                            );
                          })
                        )}
                      </div>
                    </DashboardPositionRowControls>
                  </section>
                );
              })}
            </div>
          )
        ) : ownerSections.length === 0 ? (
          <p className="meta">No {objectiveLabelPlural.toLowerCase()} available.</p>
        ) : (
          <div className="board-groups">
            {ownerSections.map((section) => {
              const sectionStyle = boardColorVars;
              const positionScopeKey = [
                selectedVenture?.ventureKey ?? "default",
                section.positionKey ?? section.positionName,
              ].join("::");

              return (
                <section
                  className="board-group"
                  key={positionScopeKey}
                  style={sectionStyle}
                >
                  <DashboardPositionRowControls
                    key={`${positionScopeKey}::position`}
                    selectedVentureKey={selectedVenture?.ventureKey}
                    departmentKey={section.positionKey}
                    positionName={section.positionName}
                    positionOwner={section.positionOwner}
                    positionOwnerEmail={section.positionOwnerEmail}
                    objectiveCount={section.objectives.length}
                    objectiveWeights={section.objectives.map((objective) => ({
                      key: objective.objectiveKey,
                      label: objective.objectiveCode ?? objective.title,
                      weight: objective.baselineValue
                    }))}
                    adminEmails={adminEmails}
                  >
                    <div className="board-group-title-wrap">
                      <div className="board-group-title-row">
                        <DashboardObjectiveControls
                          key={`${positionScopeKey}::objectives`}
                          positionName={section.positionName}
                          strategicTheme={selectedVenture?.name ?? "SVH"}
                          defaultStartDate={defaultPeriod?.startDate}
                          defaultEndDate={defaultPeriod?.endDate}
                          defaultCycle={defaultCycle}
                          defaultOwner=""
                          positionOwnerEmail={section.positionOwnerEmail}
                          adminEmails={adminEmails}
                          objectiveTypeOptions={fieldOptions.objectiveTypes}
                          objectiveStatusOptions={
                            fieldOptions.objectiveStatuses
                          }
                          objectiveCycleOptions={fieldOptions.objectiveCycles}
                          metricTypeOptions={fieldOptions.keyResultMetricTypes}
                          checkInFrequencyOptions={fieldOptions.checkInFrequencies}
                        />
                      </div>
                    </div>
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
                                No {objectiveLabelPlural.toLowerCase()} yet for this {positionLabel.toLowerCase()}.
                              </td>
                            </tr>
                          ) : (
                            section.objectives.map((objective) => {
                              const keyResults =
                                keyResultsByObjective.get(
                                  objective.objectiveKey,
                                ) ?? [];
                              return (
                                <Fragment key={objective.objectiveKey}>
                                  <DashboardObjectiveRowEditor
                                    objective={objective}
                                    keyResults={keyResults.map((kr) => {
                                      const krScopeKey = getKrScopeKey(
                                        kr.objectiveKey,
                                        kr.krKey,
                                      );
                                      const latest = latestCheckinByEntity.get(
                                        krScopeKey,
                                      );
                                      return {
                                        keyResult: kr,
                                        kpis: (kpisByKr.get(krScopeKey) ?? []).map((kpi) => {
                                          const latest = latestCheckinByEntity.get(
                                            getKpiScopeKey(
                                              kpi.objectiveKey,
                                              kpi.krKey,
                                              kpi.kpiKey,
                                            ),
                                          );
                                          return {
                                            kpi,
                                            latestUpdateNotes: latest?.updateNotes,
                                            latestUpdatedAt: getMostRecentTimestamp(
                                              latest?.checkInAt,
                                              kpi.lastCheckinAt,
                                            ),
                                          };
                                        }),
                                        latestUpdateNotes: latest?.updateNotes,
                                        latestUpdatedAt: getMostRecentTimestamp(
                                          latest?.checkInAt,
                                          kr.lastCheckinAt,
                                        ),
                                      };
                                    })}
                                    positionOwnerEmail={
                                      section.positionOwnerEmail
                                    }
                                    adminEmails={adminEmails}
                                    objectiveTypeOptions={
                                      fieldOptions.objectiveTypes
                                    }
                                    objectiveStatusOptions={
                                      fieldOptions.objectiveStatuses
                                    }
                                    objectiveCycleOptions={
                                      fieldOptions.objectiveCycles
                                    }
                                    metricTypeOptions={
                                      fieldOptions.keyResultMetricTypes
                                    }
                                    keyResultStatusOptions={
                                      fieldOptions.keyResultStatuses
                                    }
                                    checkInFrequencyOptions={
                                      fieldOptions.checkInFrequencies
                                    }
                                  />
                                </Fragment>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </DashboardPositionRowControls>
                </section>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
