import BoardPageShell from "@/app/board-page-shell";
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
import type { CheckIn, Kpi, KeyResult, Objective, OkrCycle } from "@/lib/types";

export const dynamic = "force-dynamic";

type OwnerSection = {
  positionName: string;
  positionKey?: string;
  positionOwner?: string;
  positionOwnerEmail?: string;
  objectives: Array<{
    objective: Objective;
    keyResults: Array<{
      keyResult: KeyResult;
      kpis: Array<{
        kpi: Kpi;
        latestUpdateNotes?: string;
        latestUpdatedAt?: string | null;
      }>;
      latestUpdateNotes?: string;
      latestUpdatedAt?: string | null;
    }>;
  }>;
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
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const config = await getConfig();
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
      objectives: (objectivesByPosition.get(positionName.toLowerCase()) ?? []).map(
        (objective) => {
          const keyResults =
            keyResultsByObjective.get(objective.objectiveKey) ?? [];

          return {
            objective,
            keyResults: keyResults.map((kr) => {
              const krScopeKey = getKrScopeKey(kr.objectiveKey, kr.krKey);
              const latest = latestCheckinByEntity.get(krScopeKey);

              return {
                keyResult: kr,
                kpis: (kpisByKr.get(krScopeKey) ?? []).map((kpi) => {
                  const latestKpi = latestCheckinByEntity.get(
                    getKpiScopeKey(
                      kpi.objectiveKey,
                      kpi.krKey,
                      kpi.kpiKey,
                    ),
                  );

                  return {
                    kpi,
                    latestUpdateNotes: latestKpi?.updateNotes,
                    latestUpdatedAt: getMostRecentTimestamp(
                      latestKpi?.checkInAt,
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
            }),
          };
        },
      ),
    };
  });

  return (
    <div className="dashboard-page">
      <BoardPageShell
        showVentureTabs={appProfile.showVentureTabs}
        ventures={ventures}
        selectedVentureKey={selectedVenture?.ventureKey}
        selectedVentureName={selectedVenture?.name}
        selectedVentureOwner={selectedVenture?.owner}
        selectedVentureOwnerEmail={selectedVenture?.ownerEmail}
        ownerSections={ownerSections}
        adminEmails={adminEmails}
        defaultStartDate={defaultPeriod?.startDate}
        defaultEndDate={defaultPeriod?.endDate}
        defaultCycle={defaultCycle}
        fieldOptions={fieldOptions}
        boardCardColors={config.boardCardColors}
      />
    </div>
  );
}
