import DashboardFilters from "@/app/dashboard-filters";
import { objectiveBelongsToVenture } from "@/lib/objective-scope";
import {
  matchesAssignedOwner,
  parseAssignedOwners,
} from "@/lib/owner";
import { getConfig, listKeyResults, listKpis, listObjectives } from "@/lib/store";
import type {
  Kpi,
  KeyResult,
  Objective,
  ObjectiveStatus,
  Venture,
} from "@/lib/types";
import { Fragment } from "react";

export const dynamic = "force-dynamic";

type DashboardAnalyticsPageProps = {
  searchParams?:
    | {
        ventureKey?: string | string[];
        department?: string | string[];
        owner?: string | string[];
      }
    | Promise<{
        ventureKey?: string | string[];
        department?: string | string[];
        owner?: string | string[];
      }>;
};

type EntitySummary = {
  count: number;
  statusCounts: Record<string, number>;
  avgProgress: number;
};

type VentureRow = {
  ventureKey: string;
  ventureName: string;
  objectiveSummary: EntitySummary;
  krSummary: EntitySummary;
  kpiSummary: EntitySummary;
};

type DepartmentRow = {
  ventureName: string;
  departmentName: string;
  objectiveSummary: EntitySummary;
  krSummary: EntitySummary;
  kpiSummary: EntitySummary;
};

type OwnerRow = {
  ownerName: string;
  objectiveSummary: EntitySummary;
  krSummary: EntitySummary;
  kpiSummary: EntitySummary;
};

function getSearchParamValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

async function resolveSearchParams(
  searchParams: DashboardAnalyticsPageProps["searchParams"]
): Promise<{ ventureKey?: string | string[]; department?: string | string[]; owner?: string | string[] }> {
  if (!searchParams) {
    return {};
  }

  if ("then" in searchParams) {
    return searchParams;
  }

  return searchParams;
}

function computeEntitySummary<T extends { status: string; progressPct: number }>(
  items: T[]
): EntitySummary {
  const count = items.length;
  const statusCounts = items.reduce<Record<string, number>>((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});
  const avgProgress =
    count > 0
      ? items.reduce(
          (sum, item) => sum + (Number.isFinite(item.progressPct) ? item.progressPct : 0),
          0
        ) / count
      : 0;

  return {
    count,
    statusCounts,
    avgProgress
  };
}

function formatStatus(value: ObjectiveStatus): string {
  if (value === "OnTrack") {
    return "On Track";
  }

  if (value === "AtRisk") {
    return "At Risk";
  }

  if (value === "OffTrack") {
    return "Off Track";
  }

  if (value === "NotStarted") {
    return "Not Started";
  }

  return value;
}

function toStatusClass(status: ObjectiveStatus): string {
  if (status === "OnTrack" || status === "Done") {
    return "analytics-status-ontrack";
  }

  if (status === "AtRisk") {
    return "analytics-status-atrisk";
  }

  if (status === "OffTrack") {
    return "analytics-status-offtrack";
  }

  return "analytics-status-notstarted";
}

function buildStatusCards<T extends { status: string }>(
  items: T[],
  statusOptions: string[]
): Array<{
  status: string;
  label: string;
  count: number;
  className: string;
}> {
  return statusOptions.map((statusOption) => ({
    status: statusOption,
    label: formatStatus(statusOption),
    count: items.filter((item) => item.status === statusOption).length,
    className: toStatusClass(statusOption)
  }));
}

function formatProgressPercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0%";
  }

  if (value < 1) {
    return `${value.toFixed(2)}%`;
  }

  if (value < 10) {
    return `${value.toFixed(1)}%`;
  }

  return `${Math.round(value)}%`;
}

function entityMatchesOwner(
  entity: Objective | KeyResult | Kpi,
  selectedOwner: string
): boolean {
  if (!selectedOwner) {
    return true;
  }

  return matchesAssignedOwner(entity.owner, entity.ownerEmail, selectedOwner);
}

function scopeObjectivesBySelection(
  objectives: Objective[],
  selectedVenture: Venture | undefined,
  selectedDepartment: string
): Objective[] {
  return objectives.filter((objective) => {
    if (selectedVenture && !objectiveBelongsToVenture(objective, selectedVenture)) {
      return false;
    }

    if (selectedDepartment && objective.department.toLowerCase() !== selectedDepartment.toLowerCase()) {
      return false;
    }

    return true;
  });
}

function collectOwnerOptions(
  objectives: Objective[],
  keyResults: KeyResult[],
  kpis: Kpi[]
): string[] {
  const owners = new Set<string>();

  [objectives, keyResults, kpis].forEach((items) => {
    items.forEach((item) => {
      parseAssignedOwners(item.owner, item.ownerEmail).forEach((owner) => {
        const label = owner.name || owner.email;
        if (label.trim()) {
          owners.add(label.trim());
        }
      });
    });
  });

  return Array.from(owners).sort((left, right) => left.localeCompare(right));
}

function getEntitiesForVenture(
  venture: Venture,
  scopedObjectives: Objective[],
  scopedKeyResults: KeyResult[],
  scopedKpis: Kpi[],
  objectiveByKey: Map<string, Objective>,
  selectedOwner: string
): VentureRow {
  const ventureObjectives = scopedObjectives.filter((objective) =>
    objectiveBelongsToVenture(objective, venture)
  );
  const ventureObjectiveKeys = new Set(
    ventureObjectives.map((objective) => objective.objectiveKey.toLowerCase())
  );
  const ventureKeyResults = scopedKeyResults.filter((keyResult) =>
    ventureObjectiveKeys.has(keyResult.objectiveKey.toLowerCase())
  );
  const ventureKrKeys = new Set(
    ventureKeyResults.map((keyResult) => keyResult.krKey.toLowerCase())
  );
  const ventureKpis = scopedKpis.filter((kpi) => {
    const objective = objectiveByKey.get(kpi.objectiveKey.toLowerCase());
    if (!objective || !objectiveBelongsToVenture(objective, venture)) {
      return false;
    }

    return ventureKrKeys.has(kpi.krKey.toLowerCase());
  });

  return {
    ventureKey: venture.ventureKey,
    ventureName: venture.name,
    objectiveSummary: computeEntitySummary(
      ventureObjectives.filter((objective) => entityMatchesOwner(objective, selectedOwner))
    ),
    krSummary: computeEntitySummary(
      ventureKeyResults.filter((keyResult) => entityMatchesOwner(keyResult, selectedOwner))
    ),
    kpiSummary: computeEntitySummary(
      ventureKpis.filter((kpi) => entityMatchesOwner(kpi, selectedOwner))
    )
  };
}

function getEntitiesForDepartment(
  venture: Venture,
  departmentName: string,
  scopedObjectives: Objective[],
  scopedKeyResults: KeyResult[],
  scopedKpis: Kpi[],
  selectedOwner: string
): DepartmentRow {
  const departmentObjectives = scopedObjectives.filter(
    (objective) =>
      objective.department.toLowerCase() === departmentName.toLowerCase() &&
      objectiveBelongsToVenture(objective, venture)
  );
  const departmentObjectiveKeys = new Set(
    departmentObjectives.map((objective) => objective.objectiveKey.toLowerCase())
  );
  const departmentKeyResults = scopedKeyResults.filter((keyResult) =>
    departmentObjectiveKeys.has(keyResult.objectiveKey.toLowerCase())
  );
  const departmentKrKeys = new Set(
    departmentKeyResults.map((keyResult) => keyResult.krKey.toLowerCase())
  );
  const departmentKpis = scopedKpis.filter(
    (kpi) =>
      departmentObjectiveKeys.has(kpi.objectiveKey.toLowerCase()) &&
      departmentKrKeys.has(kpi.krKey.toLowerCase())
  );

  return {
    ventureName: venture.name,
    departmentName,
    objectiveSummary: computeEntitySummary(
      departmentObjectives.filter((objective) => entityMatchesOwner(objective, selectedOwner))
    ),
    krSummary: computeEntitySummary(
      departmentKeyResults.filter((keyResult) => entityMatchesOwner(keyResult, selectedOwner))
    ),
    kpiSummary: computeEntitySummary(
      departmentKpis.filter((kpi) => entityMatchesOwner(kpi, selectedOwner))
    )
  };
}

function getOwnerEntities<T extends { owner?: string; ownerEmail?: string }>(
  items: T[],
  ownerName: string
): T[] {
  return items.filter((item) => matchesAssignedOwner(item.owner, item.ownerEmail, ownerName));
}

export default async function DashboardAnalyticsPage({
  searchParams
}: DashboardAnalyticsPageProps): Promise<JSX.Element> {
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const requestedVentureKey = getSearchParamValue(resolvedSearchParams?.ventureKey)?.trim();
  const selectedDepartment = getSearchParamValue(resolvedSearchParams?.department)?.trim() ?? "";
  const selectedOwner = getSearchParamValue(resolvedSearchParams?.owner)?.trim() ?? "";

  const config = await getConfig();
  const ventures = config.ventures;
  const selectedVenture = requestedVentureKey
    ? ventures.find((venture) => venture.ventureKey.toLowerCase() === requestedVentureKey.toLowerCase())
    : undefined;

  const allObjectives = await listObjectives();
  const allKeyResults = await listKeyResults();
  const allKpis = await listKpis();

  const scopedObjectives = scopeObjectivesBySelection(
    allObjectives,
    selectedVenture,
    selectedDepartment
  );
  const scopedObjectiveKeys = new Set(
    scopedObjectives.map((objective) => objective.objectiveKey.toLowerCase())
  );
  const scopedKeyResults = allKeyResults.filter((keyResult) =>
    scopedObjectiveKeys.has(keyResult.objectiveKey.toLowerCase())
  );
  const scopedKrKeys = new Set(
    scopedKeyResults.map((keyResult) => keyResult.krKey.toLowerCase())
  );
  const scopedKpis = allKpis.filter(
    (kpi) =>
      scopedObjectiveKeys.has(kpi.objectiveKey.toLowerCase()) &&
      scopedKrKeys.has(kpi.krKey.toLowerCase())
  );

  const filteredObjectives = scopedObjectives.filter((objective) =>
    entityMatchesOwner(objective, selectedOwner)
  );
  const filteredKeyResults = scopedKeyResults.filter((keyResult) =>
    entityMatchesOwner(keyResult, selectedOwner)
  );
  const filteredKpis = scopedKpis.filter((kpi) =>
    entityMatchesOwner(kpi, selectedOwner)
  );

  const objectiveSummary = computeEntitySummary(filteredObjectives);
  const krSummary = computeEntitySummary(filteredKeyResults);
  const kpiSummary = computeEntitySummary(filteredKpis);

  const tableStatusColumns = Array.from(
    new Set([
      ...config.fieldOptions.objectiveStatuses,
      ...config.fieldOptions.keyResultStatuses
    ])
  );

  const objectiveStatusCards = buildStatusCards(
    filteredObjectives,
    config.fieldOptions.objectiveStatuses
  );
  const keyResultStatusCards = buildStatusCards(
    filteredKeyResults,
    config.fieldOptions.keyResultStatuses
  );
  const kpiStatusCards = buildStatusCards(
    filteredKpis,
    config.fieldOptions.keyResultStatuses
  );

  const ownerOptions = collectOwnerOptions(scopedObjectives, scopedKeyResults, scopedKpis);
  const objectiveByKey = new Map(
    scopedObjectives.map((objective) => [objective.objectiveKey.toLowerCase(), objective])
  );

  const ventureRowsAll = ventures.map((venture) =>
    getEntitiesForVenture(
      venture,
      scopedObjectives,
      scopedKeyResults,
      scopedKpis,
      objectiveByKey,
      selectedOwner
    )
  );
  const ventureRows = selectedVenture
    ? ventureRowsAll.filter(
        (row) => row.ventureKey.toLowerCase() === selectedVenture.ventureKey.toLowerCase()
      )
    : ventureRowsAll.filter(
        (row) =>
          row.objectiveSummary.count > 0 ||
          row.krSummary.count > 0 ||
          row.kpiSummary.count > 0
      );

  const departmentRowsAll = ventures.flatMap<DepartmentRow>((venture) =>
    venture.departments.map((department) =>
      getEntitiesForDepartment(
        venture,
        department.name,
        scopedObjectives,
        scopedKeyResults,
        scopedKpis,
        selectedOwner
      )
    )
  );
  const departmentRows = departmentRowsAll.filter((row) => {
    if (selectedVenture && row.ventureName.toLowerCase() !== selectedVenture.name.toLowerCase()) {
      return false;
    }

    if (selectedDepartment) {
      return row.departmentName.toLowerCase() === selectedDepartment.toLowerCase();
    }

    return (
      row.objectiveSummary.count > 0 ||
      row.krSummary.count > 0 ||
      row.kpiSummary.count > 0
    );
  });

  const ownerRowsAll = ownerOptions.map<OwnerRow>((ownerName) => ({
    ownerName,
    objectiveSummary: computeEntitySummary(getOwnerEntities(scopedObjectives, ownerName)),
    krSummary: computeEntitySummary(getOwnerEntities(scopedKeyResults, ownerName)),
    kpiSummary: computeEntitySummary(getOwnerEntities(scopedKpis, ownerName))
  }));
  const ownerRows = selectedOwner
    ? ownerRowsAll.filter((row) => row.ownerName.toLowerCase() === selectedOwner.toLowerCase())
    : ownerRowsAll.filter(
        (row) =>
          row.objectiveSummary.count > 0 ||
          row.krSummary.count > 0 ||
          row.kpiSummary.count > 0
      );

  const scopeLabel = selectedVenture
    ? selectedDepartment
      ? `${selectedVenture.name} / ${selectedDepartment}`
      : selectedVenture.name
    : selectedDepartment
      ? selectedDepartment
      : "All departments and OKRs";
  const scopeLabelWithOwner = selectedOwner ? `${scopeLabel} / ${selectedOwner}` : scopeLabel;

  return (
    <div className="dashboard-page analytics-page">
      <DashboardFilters
        ventures={ventures}
        selectedVentureKey={selectedVenture?.ventureKey}
        selectedDepartment={selectedDepartment}
        ownerOptions={ownerOptions}
        selectedOwner={selectedOwner}
      />

      <section className="section analytics-overview">
        <div className="section-header">
          <h2>OKR Dashboard</h2>
          <span className="meta">Scope: {scopeLabelWithOwner}</span>
        </div>

        <div className="analytics-single-metric">
          <article className="analytics-summary-card analytics-summary-progress analytics-single-metric-card">
            <h3>Avg Progress</h3>
            <div className="analytics-summary-value">
              {formatProgressPercent(objectiveSummary.avgProgress)}
            </div>
          </article>
        </div>

        <div className="section-header">
          <h3>Objective Progress</h3>
        </div>
        <div className="analytics-summary-grid">
          {objectiveStatusCards.map((card) => (
            <article key={card.status} className={`analytics-summary-card ${card.className}`}>
              <h3>{card.label}</h3>
              <div className="analytics-summary-value">{card.count}</div>
            </article>
          ))}
        </div>
        <p className="meta analytics-summary-meta">{objectiveSummary.count} objective(s)</p>

        <div className="section-header analytics-subsection-head">
          <h3>Key Result Progress</h3>
        </div>
        <div className="analytics-summary-grid">
          {keyResultStatusCards.map((card) => (
            <article key={card.status} className={`analytics-summary-card ${card.className}`}>
              <h3>{card.label}</h3>
              <div className="analytics-summary-value">{card.count}</div>
            </article>
          ))}
        </div>
        <p className="meta analytics-summary-meta">{krSummary.count} key result(s)</p>

        <div className="section-header analytics-subsection-head">
          <h3>KPI Progress</h3>
        </div>
        <div className="analytics-summary-grid">
          {kpiStatusCards.map((card) => (
            <article key={card.status} className={`analytics-summary-card ${card.className}`}>
              <h3>{card.label}</h3>
              <div className="analytics-summary-value">{card.count}</div>
            </article>
          ))}
        </div>
        <p className="meta analytics-summary-meta">{kpiSummary.count} KPI(s)</p>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Department Performance</h2>
        </div>
        <div className="table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Metric</th>
                <th>Count</th>
                {tableStatusColumns.map((statusOption) => (
                  <th key={statusOption}>{formatStatus(statusOption)}</th>
                ))}
                <th>Avg Progress</th>
              </tr>
            </thead>
            <tbody>
              {ventureRows.length === 0 ? (
                <tr>
                  <td colSpan={tableStatusColumns.length + 4}>
                    No department data for the current filter.
                  </td>
                </tr>
              ) : (
                ventureRows.map((row) => (
                  <Fragment key={row.ventureKey}>
                    <tr>
                      <td rowSpan={3}>{row.ventureName}</td>
                      <td>Objectives</td>
                      <td>{row.objectiveSummary.count}</td>
                      {tableStatusColumns.map((statusOption) => (
                        <td key={statusOption}>{row.objectiveSummary.statusCounts[statusOption] ?? 0}</td>
                      ))}
                      <td>{formatProgressPercent(row.objectiveSummary.avgProgress)}</td>
                    </tr>
                    <tr>
                      <td>Key Results</td>
                      <td>{row.krSummary.count}</td>
                      {tableStatusColumns.map((statusOption) => (
                        <td key={statusOption}>{row.krSummary.statusCounts[statusOption] ?? 0}</td>
                      ))}
                      <td>{formatProgressPercent(row.krSummary.avgProgress)}</td>
                    </tr>
                    <tr>
                      <td>KPIs</td>
                      <td>{row.kpiSummary.count}</td>
                      {tableStatusColumns.map((statusOption) => (
                        <td key={statusOption}>{row.kpiSummary.statusCounts[statusOption] ?? 0}</td>
                      ))}
                      <td>{formatProgressPercent(row.kpiSummary.avgProgress)}</td>
                    </tr>
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>OKR Performance</h2>
        </div>
        <div className="table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>OKR</th>
                <th>Department</th>
                <th>Metric</th>
                <th>Count</th>
                {tableStatusColumns.map((statusOption) => (
                  <th key={statusOption}>{formatStatus(statusOption)}</th>
                ))}
                <th>Avg Progress</th>
              </tr>
            </thead>
            <tbody>
              {departmentRows.length === 0 ? (
                <tr>
                  <td colSpan={tableStatusColumns.length + 5}>
                    No OKR data for the current filter.
                  </td>
                </tr>
              ) : (
                departmentRows.map((row) => (
                  <Fragment key={`${row.ventureName}::${row.departmentName}`}>
                    <tr>
                      <td rowSpan={3}>{row.departmentName}</td>
                      <td rowSpan={3}>{row.ventureName}</td>
                      <td>Objectives</td>
                      <td>{row.objectiveSummary.count}</td>
                      {tableStatusColumns.map((statusOption) => (
                        <td key={statusOption}>{row.objectiveSummary.statusCounts[statusOption] ?? 0}</td>
                      ))}
                      <td>{formatProgressPercent(row.objectiveSummary.avgProgress)}</td>
                    </tr>
                    <tr>
                      <td>Key Results</td>
                      <td>{row.krSummary.count}</td>
                      {tableStatusColumns.map((statusOption) => (
                        <td key={statusOption}>{row.krSummary.statusCounts[statusOption] ?? 0}</td>
                      ))}
                      <td>{formatProgressPercent(row.krSummary.avgProgress)}</td>
                    </tr>
                    <tr>
                      <td>KPIs</td>
                      <td>{row.kpiSummary.count}</td>
                      {tableStatusColumns.map((statusOption) => (
                        <td key={statusOption}>{row.kpiSummary.statusCounts[statusOption] ?? 0}</td>
                      ))}
                      <td>{formatProgressPercent(row.kpiSummary.avgProgress)}</td>
                    </tr>
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Owner Performance</h2>
        </div>
        <div className="table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Owner</th>
                <th>Metric</th>
                <th>Count</th>
                {tableStatusColumns.map((statusOption) => (
                  <th key={statusOption}>{formatStatus(statusOption)}</th>
                ))}
                <th>Avg Progress</th>
              </tr>
            </thead>
            <tbody>
              {ownerRows.length === 0 ? (
                <tr>
                  <td colSpan={tableStatusColumns.length + 4}>
                    No owner data for the current filter.
                  </td>
                </tr>
              ) : (
                ownerRows.map((row) => (
                  <Fragment key={row.ownerName}>
                    <tr>
                      <td rowSpan={3}>{row.ownerName}</td>
                      <td>Objectives</td>
                      <td>{row.objectiveSummary.count}</td>
                      {tableStatusColumns.map((statusOption) => (
                        <td key={statusOption}>{row.objectiveSummary.statusCounts[statusOption] ?? 0}</td>
                      ))}
                      <td>{formatProgressPercent(row.objectiveSummary.avgProgress)}</td>
                    </tr>
                    <tr>
                      <td>Key Results</td>
                      <td>{row.krSummary.count}</td>
                      {tableStatusColumns.map((statusOption) => (
                        <td key={statusOption}>{row.krSummary.statusCounts[statusOption] ?? 0}</td>
                      ))}
                      <td>{formatProgressPercent(row.krSummary.avgProgress)}</td>
                    </tr>
                    <tr>
                      <td>KPIs</td>
                      <td>{row.kpiSummary.count}</td>
                      {tableStatusColumns.map((statusOption) => (
                        <td key={statusOption}>{row.kpiSummary.statusCounts[statusOption] ?? 0}</td>
                      ))}
                      <td>{formatProgressPercent(row.kpiSummary.avgProgress)}</td>
                    </tr>
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
