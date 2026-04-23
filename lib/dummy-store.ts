import { getAppProfile } from "@/lib/app-profile";
import { objectiveBelongsToVenture } from "@/lib/objective-scope";
import { matchesAssignedOwner, resolveOwnerEmail, resolveOwnerName } from "@/lib/owner";
import { clampPercent, computeKrProgress, computeObjectiveProgress, isMissingCheckin } from "@/lib/okr-rules";
import type {
  AppConfig,
  CheckInFrequency,
  CheckIn,
  CreateCheckInInput,
  CreateDepartmentInput,
  CreateKeyResultInput,
  CreateKpiInput,
  CreateObjectiveInput,
  CreatePeriodInput,
  CreateVentureInput,
  DashboardMe,
  Department,
  FieldOptions,
  KeyResult,
  Kpi,
  KrStatus,
  MetricType,
  Objective,
  OkrCycle,
  ObjectiveType,
  UpdateObjectiveInput,
  UpdateKeyResultInput,
  UpdateKpiInput,
  ObjectiveWithContext,
  Period,
  Rag,
  RagThresholds,
  UpdateDepartmentInput,
  UpdateVentureInput,
  Venture
} from "@/lib/types";

type StoreState = {
  config: AppConfig;
  periods: Period[];
  objectives: Objective[];
  keyResults: KeyResult[];
  kpis: Kpi[];
  checkIns: CheckIn[];
};

type PersistedContent = {
  ragThresholds?: RagThresholds;
  fieldOptions?: FieldOptions;
  periods: Period[];
  objectives: Objective[];
  keyResults: KeyResult[];
  kpis: Kpi[];
  checkIns: CheckIn[];
};

export type StoreSnapshot = {
  ventures: Venture[];
  content: PersistedContent;
};

export const DEMO_OWNER = "Alex Johnson";

const DEFAULT_FIELD_OPTIONS: FieldOptions = {
  objectiveTypes: ["Aspirational", "Committed", "Learning"],
  objectiveStatuses: ["NotStarted", "OnTrack", "AtRisk", "OffTrack", "Done"],
  objectiveCycles: ["Q1", "Q2", "Q3", "Q4"],
  keyResultMetricTypes: ["Delivery", "Financial", "Operational", "People", "Quality"],
  keyResultStatuses: ["NotStarted", "OnTrack", "AtRisk", "OffTrack", "Done"],
  checkInFrequencies: ["Weekly", "BiWeekly", "Monthly", "AdHoc"]
};

const EASE_FALLBACK_PERIOD_KEY = "EASE-DEFAULT";
const WEIGHT_TOLERANCE = 0.0001;

const storeContainer = globalThis as {
  __okrDummyStore?: StoreState;
};

function readPersistedVentures(): Venture[] | null {
  // Local file persistence is intentionally disabled in SharePoint-only mode.
  return null;
}

function persistVentures(_store: StoreState): void {
  // Local file persistence is intentionally disabled in SharePoint-only mode.
}

function readPersistedContent(): PersistedContent | null {
  // Local file persistence is intentionally disabled in SharePoint-only mode.
  return null;
}

function persistContent(_store: StoreState): void {
  // Local file persistence is intentionally disabled in SharePoint-only mode.
}

function persistStore(store: StoreState): void {
  persistVentures(store);
  persistContent(store);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

function shouldUseImplicitPeriod(): boolean {
  return getAppProfile().key === "ease-okr";
}

function isImplicitPeriodKey(periodKey: string): boolean {
  return periodKey.trim().toUpperCase() === EASE_FALLBACK_PERIOD_KEY;
}

function buildImplicitPeriod(): Period {
  const now = new Date();
  const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
  const startDate = new Date(now.getFullYear(), quarterStartMonth, 1);
  const endDate = new Date(now.getFullYear(), quarterStartMonth + 3, 0);

  return {
    periodKey: EASE_FALLBACK_PERIOD_KEY,
    name: "Default",
    startDate: toDateOnly(startDate),
    endDate: toDateOnly(endDate),
    status: "Active"
  };
}

function ensureImplicitPeriod(store: StoreState): void {
  if (!shouldUseImplicitPeriod() || store.periods.length > 0) {
    return;
  }

  store.periods.push(buildImplicitPeriod());
}

function getPreferredPeriod(store: StoreState): Period | undefined {
  const explicitPeriods = store.periods.filter((period) => !isImplicitPeriodKey(period.periodKey));
  return (
    explicitPeriods.find((period) => period.status === "Active") ??
    explicitPeriods[0] ??
    store.periods.find((period) => period.status === "Active") ??
    store.periods[0]
  );
}

function resolvePeriodKey(store: StoreState, requestedPeriodKey?: string, fallbackPeriodKey?: string): string {
  const requested = normalizeKey(requestedPeriodKey ?? "");
  if (requested) {
    ensurePeriodExists(store, requested);
    return requested;
  }

  const fallback = normalizeKey(fallbackPeriodKey ?? "");
  if (fallback) {
    ensurePeriodExists(store, fallback);
    return fallback;
  }

  ensureImplicitPeriod(store);
  const resolved = getPreferredPeriod(store);
  if (!resolved) {
    throw new Error("No period is configured.");
  }

  return resolved.periodKey;
}

function normalizeKey(value: string): string {
  return value.trim();
}

function normalizeName(value: string): string {
  return value.trim();
}

function normalizeEmail(value: string): string {
  return value.trim();
}

function roundWeight(value: number): number {
  return Number(value.toFixed(6));
}

function normalizeWeightInput(value: number, entityLabel: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${entityLabel} weight must be a valid number.`);
  }

  const normalized = roundWeight(value);
  if (normalized < -WEIGHT_TOLERANCE || normalized > 1 + WEIGHT_TOLERANCE) {
    throw new Error(`${entityLabel} weight must be between 0 and 1.`);
  }

  if (Math.abs(normalized) <= WEIGHT_TOLERANCE) {
    return 0;
  }

  if (Math.abs(normalized - 1) <= WEIGHT_TOLERANCE) {
    return 1;
  }

  return normalized;
}

function assertWeightTotal(entityLabel: string, weights: number[]): void {
  if (weights.length === 0) {
    return;
  }

  const total = roundWeight(weights.reduce((sum, weight) => sum + weight, 0));
  if (Math.abs(total - 1) > WEIGHT_TOLERANCE) {
    throw new Error(`${entityLabel} weights must add up to 1. Current total is ${total}.`);
  }
}

function normalizeGroupWeights<T>(
  items: T[],
  readWeight: (item: T) => number,
  writeWeight: (item: T, weight: number) => void
): void {
  if (items.length === 0) {
    return;
  }

  if (items.length === 1) {
    writeWeight(items[0], 1);
    return;
  }

  const rawWeights = items.map((item) => {
    const value = readWeight(item);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  });
  const total = rawWeights.reduce((sum, weight) => sum + weight, 0);
  const normalizedWeights =
    total > WEIGHT_TOLERANCE ? rawWeights.map((weight) => weight / total) : items.map(() => 1 / items.length);

  let assignedTotal = 0;
  normalizedWeights.forEach((weight, index) => {
    const resolvedWeight =
      index === normalizedWeights.length - 1 ? roundWeight(1 - assignedTotal) : roundWeight(Math.max(0, weight));
    writeWeight(items[index], resolvedWeight);
    assignedTotal = roundWeight(assignedTotal + resolvedWeight);
  });
}

function toSlug(value: string): string {
  const slug = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "ITEM";
}

function buildUniqueKey(existingKeys: Set<string>, prefix: string, name: string): string {
  const base = `${prefix}-${toSlug(name)}`;

  if (!existingKeys.has(base.toLowerCase())) {
    return base;
  }

  let suffix = 2;
  while (existingKeys.has(`${base}-${suffix}`.toLowerCase())) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}

function buildDepartmentKey(existingKeys: Set<string>, ventureKey: string, departmentName: string): string {
  return buildUniqueKey(existingKeys, "DEP", `${ventureKey}-${departmentName}`);
}

function getNextNumericKey(existingKeys: string[]): string {
  let maxValue = 0;

  existingKeys.forEach((key) => {
    const parsed = Number(key.trim());
    if (!Number.isInteger(parsed) || parsed < 1) {
      return;
    }

    if (parsed > maxValue) {
      maxValue = parsed;
    }
  });

  return String(maxValue + 1);
}

function parseNumberedCode(value: string, prefix: string): number | null {
  const match = new RegExp(`^${prefix}-(\\d+)$`, "i").exec(value.trim());
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function formatNumberedCode(prefix: string, sequence: number): string {
  const normalized = Math.max(1, Math.floor(sequence));
  return `${prefix}-${String(normalized).padStart(3, "0")}`;
}

function getMidLevelCodePrefix(): string {
  return getAppProfile().codePrefixes.midLevel;
}

function getLeafLevelCodePrefix(): string {
  return getAppProfile().codePrefixes.leafLevel;
}

function findVentureForObjectiveScope(
  store: StoreState,
  departmentName: string,
  ventureName: string,
  strategicTheme: string
): Venture | undefined {
  const normalizedDepartment = normalizeName(departmentName).toLowerCase();
  const normalizedVentureName = normalizeName(ventureName).toLowerCase();
  const normalizedTheme = normalizeName(strategicTheme).toLowerCase();

  if (normalizedVentureName) {
    const byVentureName = store.config.ventures.find((venture) => venture.name.toLowerCase() === normalizedVentureName);
    if (byVentureName) {
      return byVentureName;
    }
  }

  const venturesWithDepartment = store.config.ventures.filter((venture) => {
    return venture.departments.some((department) => department.name.toLowerCase() === normalizedDepartment);
  });

  if (normalizedTheme) {
    const exact = venturesWithDepartment.find((venture) => venture.name.toLowerCase() === normalizedTheme);
    if (exact) {
      return exact;
    }

    const byThemeOnly = store.config.ventures.find((venture) => venture.name.toLowerCase() === normalizedTheme);
    if (byThemeOnly) {
      return byThemeOnly;
    }
  }

  return venturesWithDepartment[0];
}

function buildObjectiveScopeKey(
  store: StoreState,
  departmentName: string,
  ventureName: string,
  strategicTheme: string
): string {
  const venture = findVentureForObjectiveScope(store, departmentName, ventureName, strategicTheme);
  const ventureScope = venture?.ventureKey.toLowerCase() || normalizeName(strategicTheme).toLowerCase() || "global";
  const departmentScope = normalizeName(departmentName).toLowerCase() || "general";
  return `${ventureScope}::${departmentScope}`;
}

function normalizeAllWeightGroups(store: StoreState): void {
  const objectiveGroups = new Map<string, Objective[]>();
  store.objectives.forEach((objective) => {
    const groupKey = `${objective.periodKey.toLowerCase()}::${buildObjectiveScopeKey(
      store,
      objective.department,
      objective.ventureName ?? "",
      objective.strategicTheme
    )}`;
    const current = objectiveGroups.get(groupKey) ?? [];
    current.push(objective);
    objectiveGroups.set(groupKey, current);
  });
  objectiveGroups.forEach((group) => normalizeGroupWeights(group, (item) => item.baselineValue, (item, weight) => { item.baselineValue = weight; }));

  const krGroups = new Map<string, KeyResult[]>();
  store.keyResults.forEach((keyResult) => {
    const groupKey = keyResult.objectiveKey.toLowerCase();
    const current = krGroups.get(groupKey) ?? [];
    current.push(keyResult);
    krGroups.set(groupKey, current);
  });
  krGroups.forEach((group) => normalizeGroupWeights(group, (item) => item.baselineValue, (item, weight) => { item.baselineValue = weight; }));

  const kpiGroups = new Map<string, Kpi[]>();
  store.kpis.forEach((kpi) => {
    const groupKey = kpi.krKey.toLowerCase();
    const current = kpiGroups.get(groupKey) ?? [];
    current.push(kpi);
    kpiGroups.set(groupKey, current);
  });
  kpiGroups.forEach((group) => normalizeGroupWeights(group, (item) => item.baselineValue, (item, weight) => { item.baselineValue = weight; }));
}

function assertObjectiveWeightGroup(
  store: StoreState,
  candidate: {
    objectiveKey?: string;
    periodKey: string;
    department: string;
    ventureName?: string;
    strategicTheme: string;
    baselineValue: number;
  }
): void {
  const scopeKey = buildObjectiveScopeKey(
    store,
    candidate.department,
    candidate.ventureName ?? "",
    candidate.strategicTheme
  );
  const weights = store.objectives
    .filter((objective) => {
      if (candidate.objectiveKey && objective.objectiveKey.toLowerCase() === candidate.objectiveKey.toLowerCase()) {
        return false;
      }

      return (
        objective.periodKey.toLowerCase() === candidate.periodKey.toLowerCase() &&
        buildObjectiveScopeKey(store, objective.department, objective.ventureName ?? "", objective.strategicTheme) === scopeKey
      );
    })
    .map((objective) => objective.baselineValue);

  weights.push(candidate.baselineValue);
  assertWeightTotal("Objective", weights);
}

function assertRemainingObjectiveWeights(
  store: StoreState,
  scope: {
    objectiveKey: string;
    periodKey: string;
    department: string;
    ventureName?: string;
    strategicTheme: string;
  }
): void {
  const scopeKey = buildObjectiveScopeKey(store, scope.department, scope.ventureName ?? "", scope.strategicTheme);
  const weights = store.objectives
    .filter((objective) => {
      if (objective.objectiveKey.toLowerCase() === scope.objectiveKey.toLowerCase()) {
        return false;
      }

      return (
        objective.periodKey.toLowerCase() === scope.periodKey.toLowerCase() &&
        buildObjectiveScopeKey(store, objective.department, objective.ventureName ?? "", objective.strategicTheme) === scopeKey
      );
    })
    .map((objective) => objective.baselineValue);

  if (weights.length > 0) {
    assertWeightTotal("Objective", weights);
  }
}

function assertKrWeightGroup(
  store: StoreState,
  candidate: {
    krKey?: string;
    objectiveKey: string;
    baselineValue: number;
  }
): void {
  const weights = store.keyResults
    .filter((keyResult) => {
      if (candidate.krKey && keyResult.krKey.toLowerCase() === candidate.krKey.toLowerCase()) {
        return false;
      }

      return keyResult.objectiveKey.toLowerCase() === candidate.objectiveKey.toLowerCase();
    })
    .map((keyResult) => keyResult.baselineValue);

  weights.push(candidate.baselineValue);
  assertWeightTotal("Key result", weights);
}

function assertRemainingKrWeights(store: StoreState, krKey: string, objectiveKey: string): void {
  const weights = store.keyResults
    .filter((keyResult) => {
      return (
        keyResult.krKey.toLowerCase() !== krKey.toLowerCase() &&
        keyResult.objectiveKey.toLowerCase() === objectiveKey.toLowerCase()
      );
    })
    .map((keyResult) => keyResult.baselineValue);

  if (weights.length > 0) {
    assertWeightTotal("Key result", weights);
  }
}

function assertKpiWeightGroup(
  store: StoreState,
  candidate: {
    kpiKey?: string;
    krKey: string;
    baselineValue: number;
  }
): void {
  const weights = store.kpis
    .filter((kpi) => {
      if (candidate.kpiKey && kpi.kpiKey.toLowerCase() === candidate.kpiKey.toLowerCase()) {
        return false;
      }

      return kpi.krKey.toLowerCase() === candidate.krKey.toLowerCase();
    })
    .map((kpi) => kpi.baselineValue);

  weights.push(candidate.baselineValue);
  assertWeightTotal("KPI", weights);
}

function assertRemainingKpiWeights(store: StoreState, kpiKey: string, krKey: string): void {
  const weights = store.kpis
    .filter((kpi) => kpi.kpiKey.toLowerCase() !== kpiKey.toLowerCase() && kpi.krKey.toLowerCase() === krKey.toLowerCase())
    .map((kpi) => kpi.baselineValue);

  if (weights.length > 0) {
    assertWeightTotal("KPI", weights);
  }
}

function getNextObjectiveCode(store: StoreState, departmentName: string, ventureName: string, strategicTheme: string): string {
  const scopeKey = buildObjectiveScopeKey(store, departmentName, ventureName, strategicTheme);
  const codePrefix = getMidLevelCodePrefix();
  let maxSequence = 0;

  store.objectives.forEach((objective) => {
    if (
      buildObjectiveScopeKey(store, objective.department, objective.ventureName ?? "", objective.strategicTheme) !== scopeKey
    ) {
      return;
    }

    const candidate = normalizeKey(objective.objectiveCode ?? objective.objectiveKey);
    const parsed = parseNumberedCode(candidate, codePrefix);
    if (parsed && parsed > maxSequence) {
      maxSequence = parsed;
    }
  });

  return formatNumberedCode(codePrefix, maxSequence + 1);
}

function getNextKrCode(store: StoreState, objectiveKey: string): string {
  const normalizedObjectiveKey = objectiveKey.toLowerCase();
  const codePrefix = getAppProfile().key === "ease-okr" ? "KR" : getLeafLevelCodePrefix();
  let maxSequence = 0;

  store.keyResults.forEach((kr) => {
    if (kr.objectiveKey.toLowerCase() !== normalizedObjectiveKey) {
      return;
    }

    const candidate = normalizeKey(kr.krCode ?? kr.krKey);
    const parsed = parseNumberedCode(candidate, codePrefix);
    if (parsed && parsed > maxSequence) {
      maxSequence = parsed;
    }
  });

  return formatNumberedCode(codePrefix, maxSequence + 1);
}

function getNextKpiCode(store: StoreState, krKey: string): string {
  const normalizedKrKey = krKey.toLowerCase();
  const codePrefix = getLeafLevelCodePrefix();
  let maxSequence = 0;

  store.kpis.forEach((kpi) => {
    if (kpi.krKey.toLowerCase() !== normalizedKrKey) {
      return;
    }

    const candidate = normalizeKey(kpi.kpiCode ?? kpi.kpiKey);
    const parsed = parseNumberedCode(candidate, codePrefix);
    if (parsed && parsed > maxSequence) {
      maxSequence = parsed;
    }
  });

  return formatNumberedCode(codePrefix, maxSequence + 1);
}

function getOkrCycleFromDate(value: string): OkrCycle {
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

function normalizeOkrCycle(value?: string): OkrCycle {
  const normalized = (value ?? "").toUpperCase();
  if (normalized === "Q1" || normalized === "Q2" || normalized === "Q3" || normalized === "Q4") {
    return normalized;
  }

  return "Q1";
}

function normalizeCheckInFrequency(value?: string): CheckInFrequency {
  if (value === "Weekly" || value === "BiWeekly" || value === "Monthly" || value === "AdHoc") {
    return value;
  }

  return "Weekly";
}

function normalizeMetricType(value?: string): MetricType {
  if (
    value === "Delivery" ||
    value === "Financial" ||
    value === "Operational" ||
    value === "People" ||
    value === "Quality"
  ) {
    return value;
  }

  if (value === "Currency") {
    return "Financial";
  }

  if (value === "Percent") {
    return "Delivery";
  }

  if (value === "Milestone") {
    return "Quality";
  }

  return "Operational";
}

function normalizeUniqueOptionList(input: string[] | undefined, fallback: readonly string[]): string[] {
  if (!Array.isArray(input)) {
    return [...fallback];
  }

  const next: string[] = [];
  input.forEach((value) => {
    if (typeof value !== "string") {
      return;
    }

    const trimmed = value.trim();
    if (!trimmed || next.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }

    next.push(trimmed);
  });

  return next.length > 0 ? next : [...fallback];
}

function normalizeFieldOptions(input?: Partial<FieldOptions>): FieldOptions {
  return {
    objectiveTypes: normalizeUniqueOptionList(
      input?.objectiveTypes as string[] | undefined,
      DEFAULT_FIELD_OPTIONS.objectiveTypes
    ),
    objectiveStatuses: normalizeUniqueOptionList(
      input?.objectiveStatuses as string[] | undefined,
      DEFAULT_FIELD_OPTIONS.objectiveStatuses
    ),
    objectiveCycles: normalizeUniqueOptionList(
      input?.objectiveCycles as string[] | undefined,
      DEFAULT_FIELD_OPTIONS.objectiveCycles
    ),
    keyResultMetricTypes: normalizeUniqueOptionList(
      input?.keyResultMetricTypes as string[] | undefined,
      DEFAULT_FIELD_OPTIONS.keyResultMetricTypes
    ),
    keyResultStatuses: normalizeUniqueOptionList(
      input?.keyResultStatuses as string[] | undefined,
      DEFAULT_FIELD_OPTIONS.keyResultStatuses
    ),
    checkInFrequencies: normalizeUniqueOptionList(
      input?.checkInFrequencies as string[] | undefined,
      DEFAULT_FIELD_OPTIONS.checkInFrequencies
    )
  };
}

function validateRagThresholds(input: RagThresholds): void {
  const greenMin = Number(input.greenMin);
  const amberMin = Number(input.amberMin);

  if (!Number.isFinite(greenMin) || !Number.isFinite(amberMin)) {
    throw new Error("RAG thresholds must be numeric.");
  }

  if (amberMin < 0 || amberMin > 99) {
    throw new Error("Amber minimum must be between 0 and 99.");
  }

  if (greenMin < 1 || greenMin > 100) {
    throw new Error("Green minimum must be between 1 and 100.");
  }

  if (amberMin >= greenMin) {
    throw new Error("Amber minimum must be lower than green minimum.");
  }
}

function getRagFromProgress(progressPct: number, thresholds: RagThresholds): Rag {
  if (progressPct >= thresholds.greenMin) {
    return "Green";
  }

  if (progressPct >= thresholds.amberMin) {
    return "Amber";
  }

  return "Red";
}

function getStatusFromProgress(progressPct: number): KrStatus {
  if (progressPct <= 0) {
    return "NotStarted";
  }

  if (progressPct >= 100) {
    return "Done";
  }

  if (progressPct >= 70) {
    return "OnTrack";
  }

  if (progressPct >= 40) {
    return "AtRisk";
  }

  return "OffTrack";
}

function recalcKeyResultInStore(store: StoreState, krKey: string): void {
  const keyResult = store.keyResults.find((item) => item.krKey === krKey);
  if (!keyResult) {
    return;
  }

  const childKpis = store.kpis.filter((kpi) => kpi.krKey === krKey);
  if (childKpis.length === 0) {
    keyResult.progressPct = 0;
    keyResult.currentValue = 0;
    keyResult.targetValue = 100;
    keyResult.status = getStatusFromProgress(keyResult.progressPct);
    return;
  }

  const progressPct = computeObjectiveProgress(childKpis);
  keyResult.progressPct = progressPct;
  keyResult.currentValue = progressPct;
  keyResult.targetValue = 100;
  keyResult.status = getStatusFromProgress(progressPct);
  keyResult.lastCheckinAt =
    sortByDateDescending(childKpis, (item) => item.lastCheckinAt ?? "")[0]?.lastCheckinAt ?? keyResult.lastCheckinAt;
}

function findVentureByKey(store: StoreState, ventureKey: string): Venture | undefined {
  return store.config.ventures.find((venture) => venture.ventureKey.toLowerCase() === ventureKey.toLowerCase());
}

function findDepartmentByKey(venture: Venture, departmentKey: string): Department | undefined {
  return venture.departments.find((department) => department.departmentKey.toLowerCase() === departmentKey.toLowerCase());
}

function doesDepartmentExist(store: StoreState, departmentName: string): boolean {
  const expected = departmentName.toLowerCase();
  return store.config.ventures.some((venture) => {
    return venture.departments.some((department) => department.name.toLowerCase() === expected);
  });
}

function assertDepartmentExists(store: StoreState, departmentName: string): void {
  if (!doesDepartmentExist(store, departmentName)) {
    throw new Error(`Department '${departmentName}' is not configured in ventures.`);
  }
}

function ensureNoObjectiveUsesDepartment(store: StoreState, departmentName: string): void {
  const expected = departmentName.toLowerCase();
  const inUse = store.objectives.some((objective) => objective.department.toLowerCase() === expected);

  if (inUse) {
    throw new Error(`Department '${departmentName}' is used by existing objectives.`);
  }
}

function ensureNoObjectiveUsesAnyDepartment(store: StoreState, departmentNames: string[]): void {
  const expected = new Set(departmentNames.map((name) => name.toLowerCase()));
  const inUse = store.objectives.some((objective) => expected.has(objective.department.toLowerCase()));

  if (inUse) {
    throw new Error("One or more departments under this venture are used by existing objectives.");
  }
}

function recalcObjectiveInStore(store: StoreState, objectiveKey: string): void {
  const objective = store.objectives.find((item) => item.objectiveKey === objectiveKey);

  if (!objective) {
    return;
  }

  const objectiveKrs = store.keyResults.filter((kr) => kr.objectiveKey === objectiveKey);
  objectiveKrs.forEach((kr) => recalcKeyResultInStore(store, kr.krKey));

  if (objectiveKrs.length === 0) {
    objective.progressPct = 0;
    objective.currentValue = 0;
    objective.targetValue = 100;
    objective.rag = getRagFromProgress(objective.progressPct, store.config.ragThresholds);
    return;
  }

  const progressPct = computeObjectiveProgress(objectiveKrs);
  objective.progressPct = progressPct;
  objective.currentValue = progressPct;
  objective.targetValue = 100;
  objective.rag = getRagFromProgress(progressPct, store.config.ragThresholds);
}

function recalcAllObjectivesInStore(store: StoreState): void {
  store.objectives.forEach((objective) => recalcObjectiveInStore(store, objective.objectiveKey));
}

function ensureUniqueDepartmentKeys(store: StoreState): void {
  const seen = new Set<string>();

  store.config.ventures.forEach((venture) => {
    venture.departments.forEach((department) => {
      const currentKey = normalizeKey(department.departmentKey ?? "");
      const normalizedKey = currentKey.toLowerCase();

      if (!currentKey || seen.has(normalizedKey)) {
        department.departmentKey = buildDepartmentKey(seen, venture.ventureKey, department.name);
      }

      seen.add(department.departmentKey.toLowerCase());
    });
  });
}

function migrateObjectiveDefaults(store: StoreState): void {
  store.objectives.forEach((objective) => {
    if (!objective.objectiveCode) {
      objective.objectiveCode = objective.objectiveKey;
    }

    if (!objective.ventureName) {
      const venture = findVentureForObjectiveScope(store, objective.department, "", objective.strategicTheme);
      objective.ventureName = venture?.name ?? "";
    }

    if (!objective.objectiveType) {
      objective.objectiveType = "Committed";
    }

    if (!objective.strategicTheme) {
      const venture = store.config.ventures.find((item) => {
        return item.departments.some((department) => department.name.toLowerCase() === objective.department.toLowerCase());
      });

      objective.strategicTheme = venture?.name ?? "General";
    }

    if (!objective.okrCycle) {
      objective.okrCycle = getOkrCycleFromDate(objective.startDate);
    }

    objective.metricType = normalizeMetricType(objective.metricType);

    if (!Number.isFinite(objective.baselineValue)) {
      objective.baselineValue = 0;
    }

    if (!Number.isFinite(objective.targetValue)) {
      objective.targetValue = 100;
    }

    if (!Number.isFinite(objective.currentValue)) {
      objective.currentValue = Number.isFinite(objective.progressPct) ? objective.progressPct : 0;
    }

    if (objective.blockers === undefined || objective.blockers === null) {
      objective.blockers = "";
    }

    if (!objective.keyRisksDependency) {
      objective.keyRisksDependency = "";
    }

    if (!objective.notes) {
      objective.notes = objective.description ?? "";
    }

    if (!objective.dueDate) {
      objective.dueDate = objective.endDate || objective.startDate;
    }

    if (!objective.endDate) {
      objective.endDate = objective.dueDate || objective.startDate;
    }

    if (!objective.checkInFrequency) {
      objective.checkInFrequency = "Weekly";
    }

    if (typeof objective.lastCheckinAt !== "string" && objective.lastCheckinAt !== null) {
      objective.lastCheckinAt = null;
    }
  });
}

function migrateKrDefaults(store: StoreState): void {
  store.keyResults.forEach((kr) => {
    if (!kr.krCode) {
      kr.krCode = kr.krKey;
    }

    if (!kr.checkInFrequency) {
      kr.checkInFrequency = "Weekly";
    }

    kr.metricType = normalizeMetricType(kr.metricType);

    if (!Number.isFinite(kr.baselineValue)) {
      kr.baselineValue = 0;
    }

    if (kr.blockers === undefined || kr.blockers === null) {
      kr.blockers = "";
    }

    if (kr.notes === undefined || kr.notes === null) {
      kr.notes = "";
    }

    if (typeof kr.lastCheckinAt !== "string" && kr.lastCheckinAt !== null) {
      kr.lastCheckinAt = null;
    }
  });
}

function migrateKpiDefaults(store: StoreState): void {
  store.kpis.forEach((kpi) => {
    if (!kpi.kpiCode) {
      kpi.kpiCode = kpi.kpiKey;
    }

    if (!kpi.checkInFrequency) {
      kpi.checkInFrequency = "Weekly";
    }

    kpi.metricType = normalizeMetricType(kpi.metricType);

    if (!Number.isFinite(kpi.baselineValue)) {
      kpi.baselineValue = 0;
    }

    if (kpi.blockers === undefined || kpi.blockers === null) {
      kpi.blockers = "";
    }

    if (kpi.notes === undefined || kpi.notes === null) {
      kpi.notes = "";
    }

    if (typeof kpi.lastCheckinAt !== "string" && kpi.lastCheckinAt !== null) {
      kpi.lastCheckinAt = null;
    }
  });
}

function buildSeedStore(): StoreState {
  const store: StoreState = {
    config: {
      ragThresholds: {
        greenMin: 70,
        amberMin: 40
      },
      fieldOptions: clone(DEFAULT_FIELD_OPTIONS),
      ventures: []
    },
    periods: [],
    objectives: [],
    keyResults: [],
    kpis: [],
    checkIns: []
  };

  recalcAllObjectivesInStore(store);
  return store;
}

function applyStoreMigrations(store: StoreState): void {
  store.config.fieldOptions = normalizeFieldOptions(store.config.fieldOptions);
  ensureImplicitPeriod(store);
  ensureUniqueDepartmentKeys(store);
  migrateObjectiveDefaults(store);
  migrateKrDefaults(store);
  migrateKpiDefaults(store);
  normalizeAllWeightGroups(store);
  recalcAllObjectivesInStore(store);
  persistStore(store);
}

function toStoreSnapshot(store: StoreState): StoreSnapshot {
  return {
    ventures: clone(store.config.ventures),
    content: {
      ragThresholds: clone(store.config.ragThresholds),
      fieldOptions: clone(store.config.fieldOptions),
      periods: clone(store.periods),
      objectives: clone(store.objectives),
      keyResults: clone(store.keyResults),
      kpis: clone(store.kpis),
      checkIns: clone(store.checkIns)
    }
  };
}

function fromStoreSnapshot(snapshot: StoreSnapshot): StoreState {
  const store = buildSeedStore();
  store.config.ventures = clone(snapshot.ventures);
  if (snapshot.content.ragThresholds) {
    store.config.ragThresholds = {
      greenMin: Number(snapshot.content.ragThresholds.greenMin),
      amberMin: Number(snapshot.content.ragThresholds.amberMin)
    };
  }
  if (snapshot.content.fieldOptions) {
    store.config.fieldOptions = normalizeFieldOptions(snapshot.content.fieldOptions);
  }

  store.periods = clone(snapshot.content.periods);
  store.objectives = clone(snapshot.content.objectives);
  store.keyResults = clone(snapshot.content.keyResults);
  store.kpis = clone(snapshot.content.kpis ?? []);
  store.checkIns = clone(snapshot.content.checkIns);
  return store;
}

export function getSeedSnapshot(): StoreSnapshot {
  const seed = buildSeedStore();
  applyStoreMigrations(seed);
  return toStoreSnapshot(seed);
}

export function hydrateStoreFromSnapshot(snapshot: StoreSnapshot): void {
  const hydrated = fromStoreSnapshot(snapshot);
  applyStoreMigrations(hydrated);
  storeContainer.__okrDummyStore = hydrated;
}

export function exportStoreSnapshot(): StoreSnapshot {
  return toStoreSnapshot(getStore());
}

export function resetStoreState(): void {
  storeContainer.__okrDummyStore = undefined;
}

function getStore(): StoreState {
  if (!storeContainer.__okrDummyStore) {
    storeContainer.__okrDummyStore = buildSeedStore();
  }

  const persistedVentures = readPersistedVentures();
  if (persistedVentures && persistedVentures.length > 0) {
    storeContainer.__okrDummyStore.config.ventures = persistedVentures;
  }

  const persistedContent = readPersistedContent();
  if (persistedContent) {
    if (persistedContent.ragThresholds) {
      storeContainer.__okrDummyStore.config.ragThresholds = {
        greenMin: Number(persistedContent.ragThresholds.greenMin),
        amberMin: Number(persistedContent.ragThresholds.amberMin)
      };
    }

    if (persistedContent.fieldOptions) {
      storeContainer.__okrDummyStore.config.fieldOptions = normalizeFieldOptions(persistedContent.fieldOptions);
    }

    if (persistedContent.periods.length > 0) {
      storeContainer.__okrDummyStore.periods = persistedContent.periods;
    }

    storeContainer.__okrDummyStore.objectives = persistedContent.objectives;
    storeContainer.__okrDummyStore.keyResults = persistedContent.keyResults;
    storeContainer.__okrDummyStore.kpis = persistedContent.kpis ?? [];
    storeContainer.__okrDummyStore.checkIns = persistedContent.checkIns;
  }

  applyStoreMigrations(storeContainer.__okrDummyStore);
  return storeContainer.__okrDummyStore;
}

function ensurePeriodExists(store: StoreState, periodKey: string): void {
  const exists = store.periods.some((period) => period.periodKey === periodKey);
  if (!exists) {
    throw new Error(`Period '${periodKey}' does not exist.`);
  }
}

function ensureObjectiveExists(store: StoreState, objectiveKey: string): Objective {
  const objective = store.objectives.find((item) => item.objectiveKey === objectiveKey);
  if (!objective) {
    throw new Error(`Objective '${objectiveKey}' does not exist.`);
  }

  return objective;
}

function ensureKrExists(store: StoreState, krKey: string): KeyResult {
  const kr = store.keyResults.find((item) => item.krKey === krKey);
  if (!kr) {
    throw new Error(`Key Result '${krKey}' does not exist.`);
  }

  return kr;
}

function ensureKpiExists(store: StoreState, kpiKey: string): Kpi {
  const kpi = store.kpis.find((item) => item.kpiKey === kpiKey);
  if (!kpi) {
    throw new Error(`KPI '${kpiKey}' does not exist.`);
  }

  return kpi;
}

function isMatch(value: string | undefined, expected?: string): boolean {
  if (!expected) {
    return true;
  }

  return (value ?? "").toLowerCase() === expected.toLowerCase();
}

function sortByDateDescending<T>(items: T[], selector: (item: T) => string): T[] {
  return [...items].sort((left, right) => selector(right).localeCompare(selector(left)));
}

export function getConfig(): AppConfig {
  return clone(getStore().config);
}

export function updateRagThresholds(input: RagThresholds): AppConfig {
  validateRagThresholds(input);
  const store = getStore();

  store.config.ragThresholds = {
    greenMin: Number(input.greenMin),
    amberMin: Number(input.amberMin)
  };

  recalcAllObjectivesInStore(store);
  persistStore(store);
  return clone(store.config);
}

export function updateFieldOptions(input: Partial<FieldOptions>): AppConfig {
  const store = getStore();
  store.config.fieldOptions = normalizeFieldOptions({
    ...store.config.fieldOptions,
    ...input
  });

  persistStore(store);
  return clone(store.config);
}

export function addVenture(input: CreateVentureInput): Venture {
  const store = getStore();
  const name = normalizeName(input.name);

  if (!name) {
    throw new Error("Venture name is required.");
  }

  const duplicateName = store.config.ventures.some((venture) => venture.name.toLowerCase() === name.toLowerCase());
  if (duplicateName) {
    throw new Error(`Venture '${name}' already exists.`);
  }

  const existingVentureKeys = new Set(store.config.ventures.map((venture) => venture.ventureKey.toLowerCase()));
  const requestedVentureKey = normalizeKey(input.ventureKey ?? "");
  let ventureKey = requestedVentureKey;

  if (requestedVentureKey) {
    const duplicate = findVentureByKey(store, requestedVentureKey);
    if (duplicate) {
      throw new Error(`Venture '${requestedVentureKey}' already exists.`);
    }
  } else {
    ventureKey = buildUniqueKey(existingVentureKeys, "VENT", name);
  }

  const departments: Department[] = [];
  const rawDepartments = input.departments ?? [];
  const departmentKeys = new Set<string>(store.config.ventures.flatMap((venture) => venture.departments.map((department) => department.departmentKey.toLowerCase())));
  const departmentNames = new Set<string>();

  rawDepartments.forEach((department) => {
    const departmentName = normalizeName(department.name);
    const departmentOwner = normalizeName(department.owner ?? "");
    const departmentOwnerEmail = normalizeEmail(department.ownerEmail ?? "") || undefined;
    const requestedDepartmentKey = normalizeKey(department.departmentKey ?? "");
    let departmentKey = requestedDepartmentKey;

    if (!departmentName) {
      throw new Error("Department name is required.");
    }

    if (departmentNames.has(departmentName.toLowerCase())) {
      throw new Error(`Duplicate department name '${departmentName}' in venture payload.`);
    }

    if (requestedDepartmentKey) {
      if (departmentKeys.has(requestedDepartmentKey.toLowerCase())) {
        throw new Error(`Duplicate department key '${requestedDepartmentKey}' in venture payload.`);
      }
    } else {
      departmentKey = buildDepartmentKey(departmentKeys, ventureKey, departmentName);
    }

    departmentKeys.add(departmentKey.toLowerCase());
    departmentNames.add(departmentName.toLowerCase());
    departments.push({
      departmentKey,
      name: departmentName,
      owner: departmentOwner || undefined,
      ownerEmail: departmentOwnerEmail
    });
  });

  const venture: Venture = {
    ventureKey,
    name,
    departments
  };

  store.config.ventures.push(venture);
  persistStore(store);
  return clone(venture);
}

export function updateVenture(ventureKey: string, patch: UpdateVentureInput): Venture | null {
  const store = getStore();
  const venture = findVentureByKey(store, ventureKey);

  if (!venture) {
    return null;
  }

  if (patch.name !== undefined) {
    const name = normalizeName(patch.name);
    if (!name) {
      throw new Error("Venture name cannot be empty.");
    }

    const duplicateName = store.config.ventures.some(
      (item) => item.ventureKey.toLowerCase() !== venture.ventureKey.toLowerCase() && item.name.toLowerCase() === name.toLowerCase()
    );

    if (duplicateName) {
      throw new Error(`Venture '${name}' already exists.`);
    }

    const oldName = venture.name;
    venture.name = name;
    store.objectives.forEach((objective) => {
      const normalizedObjectiveVentureName = normalizeName(objective.ventureName ?? "").toLowerCase();
      const normalizedTheme = normalizeName(objective.strategicTheme).toLowerCase();
      if (normalizedObjectiveVentureName === oldName.toLowerCase()) {
        objective.ventureName = name;
        return;
      }

      if (!normalizedObjectiveVentureName && normalizedTheme === oldName.toLowerCase()) {
        objective.ventureName = name;
      }
    });
  }

  persistStore(store);
  return clone(venture);
}

export function deleteVenture(ventureKey: string): boolean {
  const store = getStore();
  const index = store.config.ventures.findIndex(
    (venture) => venture.ventureKey.toLowerCase() === ventureKey.toLowerCase()
  );

  if (index < 0) {
    return false;
  }

  const venture = store.config.ventures[index];
  const removedObjectiveKeys = new Set(
    store.objectives
      .filter((objective) => objectiveBelongsToVenture(objective, venture))
      .map((objective) => objective.objectiveKey.toLowerCase())
  );
  const removedKrKeys = new Set(
    store.keyResults
      .filter((keyResult) => removedObjectiveKeys.has(keyResult.objectiveKey.toLowerCase()))
      .map((keyResult) => keyResult.krKey.toLowerCase())
  );

  store.config.ventures.splice(index, 1);
  store.objectives = store.objectives.filter((objective) => !removedObjectiveKeys.has(objective.objectiveKey.toLowerCase()));
  store.keyResults = store.keyResults.filter((keyResult) => !removedKrKeys.has(keyResult.krKey.toLowerCase()));
  store.checkIns = store.checkIns.filter((checkIn) => {
    return !removedObjectiveKeys.has(checkIn.objectiveKey.toLowerCase()) && !removedKrKeys.has(checkIn.krKey.toLowerCase());
  });

  persistStore(store);
  return true;
}

export function addDepartmentToVenture(ventureKey: string, input: CreateDepartmentInput): Venture | null {
  const store = getStore();
  const venture = findVentureByKey(store, ventureKey);

  if (!venture) {
    return null;
  }

  const name = normalizeName(input.name);
  const owner = normalizeName(resolveOwnerName(input.owner, input.ownerEmail));
  const ownerEmail = normalizeEmail(resolveOwnerEmail(input.owner, input.ownerEmail)) || undefined;
  const requestedDepartmentKey = normalizeKey(input.departmentKey ?? "");
  let departmentKey = requestedDepartmentKey;

  if (!name) {
    throw new Error("Department name is required.");
  }

  const duplicateName = venture.departments.some((department) => department.name.toLowerCase() === name.toLowerCase());
  if (duplicateName) {
    throw new Error(`Department '${name}' already exists in venture '${venture.name}'.`);
  }

  const existingDepartmentKeys = new Set(
    store.config.ventures.flatMap((item) => item.departments.map((department) => department.departmentKey.toLowerCase()))
  );
  if (requestedDepartmentKey) {
    if (existingDepartmentKeys.has(requestedDepartmentKey.toLowerCase())) {
      throw new Error(`Department key '${requestedDepartmentKey}' already exists.`);
    }
  } else {
    departmentKey = buildDepartmentKey(existingDepartmentKeys, venture.ventureKey, name);
  }

  venture.departments.push({
    departmentKey,
    name,
    owner: owner || undefined,
    ownerEmail
  });
  persistStore(store);
  return clone(venture);
}

export function updateDepartmentInVenture(
  ventureKey: string,
  departmentKey: string,
  patch: UpdateDepartmentInput
): Venture | null {
  const store = getStore();
  const venture = findVentureByKey(store, ventureKey);

  if (!venture) {
    return null;
  }

  const department = findDepartmentByKey(venture, departmentKey);
  if (!department) {
    return null;
  }

  if (patch.name !== undefined) {
    const name = normalizeName(patch.name);
    if (!name) {
      throw new Error("Department name cannot be empty.");
    }

    const duplicateName = venture.departments.some(
      (item) =>
        item.departmentKey.toLowerCase() !== department.departmentKey.toLowerCase() &&
        item.name.toLowerCase() === name.toLowerCase()
    );

    if (duplicateName) {
      throw new Error(`Department '${name}' already exists in venture '${venture.name}'.`);
    }

    const oldName = department.name;
    department.name = name;

    store.objectives.forEach((objective) => {
      if (
        objective.department.toLowerCase() === oldName.toLowerCase() &&
        objectiveBelongsToVenture(objective, venture)
      ) {
        objective.department = name;
      }
    });
  }

  if (patch.owner !== undefined) {
    department.owner = normalizeName(resolveOwnerName(patch.owner, patch.ownerEmail ?? department.ownerEmail)) || undefined;
  }

  if (patch.ownerEmail !== undefined) {
    department.ownerEmail = normalizeEmail(resolveOwnerEmail(patch.owner ?? department.owner, patch.ownerEmail)) || undefined;
  }

  persistStore(store);
  return clone(venture);
}

export function deleteDepartmentFromVenture(ventureKey: string, departmentKey: string): Venture | null {
  const store = getStore();
  const venture = findVentureByKey(store, ventureKey);

  if (!venture) {
    return null;
  }

  const index = venture.departments.findIndex(
    (department) => department.departmentKey.toLowerCase() === departmentKey.toLowerCase()
  );

  if (index < 0) {
    return null;
  }

  const department = venture.departments[index];
  const removedObjectiveKeys = new Set(
    store.objectives
      .filter((objective) => {
        return (
          objective.department.toLowerCase() === department.name.toLowerCase() &&
          objectiveBelongsToVenture(objective, venture)
        );
      })
      .map((objective) => objective.objectiveKey.toLowerCase())
  );
  const removedKrKeys = new Set(
    store.keyResults
      .filter((keyResult) => removedObjectiveKeys.has(keyResult.objectiveKey.toLowerCase()))
      .map((keyResult) => keyResult.krKey.toLowerCase())
  );

  venture.departments.splice(index, 1);
  store.objectives = store.objectives.filter((objective) => !removedObjectiveKeys.has(objective.objectiveKey.toLowerCase()));
  store.keyResults = store.keyResults.filter((keyResult) => !removedKrKeys.has(keyResult.krKey.toLowerCase()));
  store.checkIns = store.checkIns.filter((checkIn) => {
    return !removedObjectiveKeys.has(checkIn.objectiveKey.toLowerCase()) && !removedKrKeys.has(checkIn.krKey.toLowerCase());
  });

  persistStore(store);
  return clone(venture);
}

export function listPeriods(): Period[] {
  return clone(getStore().periods);
}

export function createPeriod(input: CreatePeriodInput): Period {
  const store = getStore();
  const alreadyExists = store.periods.some((period) => period.periodKey === input.periodKey);

  if (alreadyExists) {
    throw new Error(`Period '${input.periodKey}' already exists.`);
  }

  const period: Period = {
    periodKey: input.periodKey,
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
    status: input.status ?? "Planned"
  };

  store.periods.push(period);
  persistStore(store);
  return clone(period);
}

export function updatePeriod(periodKey: string, patch: Partial<Period>): Period | null {
  const store = getStore();
  const period = store.periods.find((item) => item.periodKey === periodKey);

  if (!period) {
    return null;
  }

  Object.assign(period, patch);
  persistStore(store);
  return clone(period);
}

type ObjectiveFilters = {
  periodKey?: string;
  department?: string;
  owner?: string;
  status?: string;
};

export function listObjectives(filters: ObjectiveFilters = {}): Objective[] {
  const { periodKey, department, owner, status } = filters;
  const objectives = getStore().objectives.filter((objective) => {
    return (
      isMatch(objective.periodKey, periodKey) &&
      isMatch(objective.department, department) &&
      matchesAssignedOwner(objective.owner, objective.ownerEmail, owner) &&
      isMatch(objective.status, status)
    );
  });

  return clone(objectives);
}

export function getObjective(objectiveKey: string): Objective | null {
  const objective = getStore().objectives.find((item) => item.objectiveKey === objectiveKey);
  return objective ? clone(objective) : null;
}

export function getObjectiveWithContext(objectiveKey: string): ObjectiveWithContext | null {
  const store = getStore();
  const objective = store.objectives.find((item) => item.objectiveKey === objectiveKey);

  if (!objective) {
    return null;
  }

  const objectiveKrs = store.keyResults.filter((kr) => kr.objectiveKey === objectiveKey);
  const objectiveKpis = store.kpis.filter((kpi) => kpi.objectiveKey === objectiveKey);
  const latestCheckIns: Record<string, CheckIn | null> = {};

  [...objectiveKrs.map((kr) => kr.krKey), ...objectiveKpis.map((kpi) => kpi.kpiKey)].forEach((entityKey) => {
    const latest = sortByDateDescending(
      store.checkIns.filter((checkIn) => checkIn.krKey === entityKey || checkIn.kpiKey === entityKey),
      (checkIn) => checkIn.checkInAt
    )[0];

    latestCheckIns[entityKey] = latest ?? null;
  });

  return clone({
    objective,
    keyResults: objectiveKrs,
    kpis: objectiveKpis,
    latestCheckIns
  });
}

export function createObjective(input: CreateObjectiveInput): Objective {
  const store = getStore();
  const requestedObjectiveCode = normalizeKey(input.objectiveCode ?? input.objectiveKey ?? "");
  const objectiveKey = getNextNumericKey(store.objectives.map((objective) => objective.objectiveKey));
  const periodKey = resolvePeriodKey(store, input.periodKey);
  assertDepartmentExists(store, input.department);
  const strategicTheme = normalizeName(input.strategicTheme || "");
  const blockers = normalizeName(input.blockers || "");
  const notes = normalizeName(input.notes || input.description || "");
  const cycle = normalizeOkrCycle(input.okrCycle);
  const metricType = normalizeMetricType(input.metricType);
  const baselineValue = normalizeWeightInput(input.baselineValue, "Objective");
  const targetValue = 100;
  const currentValue = 0;
  const dueDate = normalizeName(input.dueDate || input.endDate || "");
  const checkInFrequency = normalizeCheckInFrequency(input.checkInFrequency);
  const progressPct = 0;

  const objective: Objective = {
    objectiveKey,
    objectiveCode:
      requestedObjectiveCode || getNextObjectiveCode(store, input.department, input.ventureName ?? "", input.strategicTheme),
    periodKey,
    title: input.title,
    description: input.description || notes,
    owner: normalizeName(resolveOwnerName(input.owner, input.ownerEmail)) || undefined,
    ownerEmail: normalizeEmail(resolveOwnerEmail(input.owner, input.ownerEmail)) || undefined,
    department: input.department,
    ventureName: input.ventureName ?? findVentureForObjectiveScope(store, input.department, "", input.strategicTheme)?.name ?? "",
    strategicTheme: strategicTheme || "General",
    objectiveType: (input.objectiveType ?? "Committed") as ObjectiveType,
    okrCycle: cycle,
    metricType,
    baselineValue,
    targetValue,
    currentValue,
    blockers,
    keyRisksDependency: input.keyRisksDependency || "",
    notes,
    status: input.status,
    progressPct,
    confidence: input.confidence,
    rag: input.rag,
    startDate: input.startDate,
    endDate: input.endDate || dueDate,
    dueDate,
    checkInFrequency,
    lastCheckinAt: nowIso()
  };

  assertObjectiveWeightGroup(store, objective);
  store.objectives.push(objective);
  recalcObjectiveInStore(store, objective.objectiveKey);
  persistStore(store);
  return clone(objective);
}

export function updateObjective(objectiveKey: string, patch: UpdateObjectiveInput): Objective | null {
  const store = getStore();
  const objective = store.objectives.find((item) => item.objectiveKey === objectiveKey);

  if (!objective) {
    return null;
  }
  const originalObjective = clone(objective);
  const previousScope = {
    objectiveKey: originalObjective.objectiveKey,
    periodKey: originalObjective.periodKey,
    department: originalObjective.department,
    ventureName: originalObjective.ventureName,
    strategicTheme: originalObjective.strategicTheme
  };

  try {
    if (patch.periodKey !== undefined) {
      ensurePeriodExists(store, patch.periodKey);
      objective.periodKey = patch.periodKey;
    }

    if (patch.objectiveCode !== undefined) {
      objective.objectiveCode = normalizeKey(patch.objectiveCode) || objective.objectiveKey;
    }

    if (patch.title !== undefined) {
      objective.title = normalizeName(patch.title);
    }

    if (patch.description !== undefined) {
      objective.description = normalizeName(patch.description);
    }

    if (patch.owner !== undefined) {
      objective.owner = normalizeName(resolveOwnerName(patch.owner, patch.ownerEmail ?? objective.ownerEmail)) || undefined;
    }

    if (patch.ownerEmail !== undefined) {
      objective.ownerEmail = normalizeEmail(resolveOwnerEmail(patch.owner ?? objective.owner, patch.ownerEmail)) || undefined;
    }

    if (patch.department !== undefined) {
      objective.department = normalizeName(patch.department);
    }

    if (patch.ventureName !== undefined) {
      objective.ventureName = normalizeName(patch.ventureName);
    }

    if (patch.strategicTheme !== undefined) {
      objective.strategicTheme = normalizeName(patch.strategicTheme);
    }

    if (patch.objectiveType !== undefined) {
      objective.objectiveType = patch.objectiveType;
    }

    if (patch.okrCycle !== undefined) {
      objective.okrCycle = normalizeOkrCycle(patch.okrCycle);
    }

    if (patch.metricType !== undefined) {
      objective.metricType = normalizeMetricType(patch.metricType);
    }

    if (patch.baselineValue !== undefined) {
      objective.baselineValue = normalizeWeightInput(patch.baselineValue, "Objective");
    }

    if (patch.blockers !== undefined) {
      objective.blockers = normalizeName(patch.blockers);
    }

    if (patch.keyRisksDependency !== undefined) {
      objective.keyRisksDependency = normalizeName(patch.keyRisksDependency);
    }

    if (patch.notes !== undefined) {
      objective.notes = normalizeName(patch.notes);
    }

    if (patch.status !== undefined) {
      objective.status = patch.status;
    }

    if (patch.confidence !== undefined) {
      objective.confidence = patch.confidence;
    }

    if (patch.startDate !== undefined) {
      objective.startDate = normalizeName(patch.startDate);
    }

    if (patch.endDate !== undefined) {
      objective.endDate = normalizeName(patch.endDate);
      if (patch.dueDate === undefined) {
        objective.dueDate = objective.endDate;
      }
    }

    if (patch.dueDate !== undefined) {
      objective.dueDate = normalizeName(patch.dueDate);
      objective.endDate = objective.dueDate;
    }

    if (patch.checkInFrequency !== undefined) {
      objective.checkInFrequency = normalizeCheckInFrequency(patch.checkInFrequency);
    }

    assertObjectiveWeightGroup(store, objective);
    const movedScope =
      previousScope.periodKey.toLowerCase() !== objective.periodKey.toLowerCase() ||
      previousScope.department.toLowerCase() !== objective.department.toLowerCase() ||
      normalizeName(previousScope.ventureName ?? "").toLowerCase() !== normalizeName(objective.ventureName ?? "").toLowerCase() ||
      previousScope.strategicTheme.toLowerCase() !== objective.strategicTheme.toLowerCase();

    if (movedScope) {
      assertRemainingObjectiveWeights(store, previousScope);
    }

    recalcObjectiveInStore(store, objective.objectiveKey);
    objective.lastCheckinAt = nowIso();
    persistStore(store);
    return clone(objective);
  } catch (error) {
    Object.assign(objective, originalObjective);
    throw error;
  }
}

export function deleteObjective(
  objectiveKey: string
): { objectiveKey: string; deletedKrCount: number; deletedCheckInCount: number } | null {
  const store = getStore();
  const objectiveIndex = store.objectives.findIndex(
    (objective) => objective.objectiveKey.toLowerCase() === objectiveKey.toLowerCase()
  );

  if (objectiveIndex < 0) {
    return null;
  }

  const objective = store.objectives[objectiveIndex];
  const relatedKrs = store.keyResults.filter(
    (keyResult) => keyResult.objectiveKey.toLowerCase() === objective.objectiveKey.toLowerCase()
  );
  const relatedKrKeys = new Set(relatedKrs.map((keyResult) => keyResult.krKey.toLowerCase()));
  const relatedKpis = store.kpis.filter((kpi) => kpi.objectiveKey.toLowerCase() === objective.objectiveKey.toLowerCase());
  const relatedKpiKeys = new Set(relatedKpis.map((kpi) => kpi.kpiKey.toLowerCase()));

  const deletedKrCount = relatedKrs.length;
  const deletedCheckInCount = store.checkIns.filter((checkIn) => {
    return (
      checkIn.objectiveKey.toLowerCase() === objective.objectiveKey.toLowerCase() ||
      relatedKrKeys.has(checkIn.krKey.toLowerCase()) ||
      relatedKpiKeys.has((checkIn.kpiKey ?? "").toLowerCase())
    );
  }).length;

  store.objectives.splice(objectiveIndex, 1);
  store.keyResults = store.keyResults.filter(
    (keyResult) => keyResult.objectiveKey.toLowerCase() !== objective.objectiveKey.toLowerCase()
  );
  store.kpis = store.kpis.filter((kpi) => kpi.objectiveKey.toLowerCase() !== objective.objectiveKey.toLowerCase());
  store.checkIns = store.checkIns.filter((checkIn) => {
    return (
      checkIn.objectiveKey.toLowerCase() !== objective.objectiveKey.toLowerCase() &&
      !relatedKrKeys.has(checkIn.krKey.toLowerCase()) &&
      !relatedKpiKeys.has((checkIn.kpiKey ?? "").toLowerCase())
    );
  });

  persistStore(store);
  return {
    objectiveKey: objective.objectiveKey,
    deletedKrCount,
    deletedCheckInCount
  };
}

type KrFilters = {
  periodKey?: string;
  objectiveKey?: string;
  owner?: string;
  status?: string;
};

export function listKeyResults(filters: KrFilters = {}): KeyResult[] {
  const { periodKey, objectiveKey, owner, status } = filters;

  const keyResults = getStore().keyResults.filter((kr) => {
    return (
      isMatch(kr.periodKey, periodKey) &&
      isMatch(kr.objectiveKey, objectiveKey) &&
      matchesAssignedOwner(kr.owner, kr.ownerEmail, owner) &&
      isMatch(kr.status, status)
    );
  });

  return clone(keyResults);
}

export function getKeyResult(krKey: string): KeyResult | null {
  const kr = getStore().keyResults.find((item) => item.krKey === krKey);
  return kr ? clone(kr) : null;
}

export function createKeyResult(input: CreateKeyResultInput): KeyResult {
  const store = getStore();
  const requestedKrCode = normalizeKey(input.krCode ?? input.krKey ?? "");
  const krKey = getNextNumericKey(store.keyResults.map((kr) => kr.krKey));

  const objective = ensureObjectiveExists(store, input.objectiveKey);
  const periodKey = resolvePeriodKey(store, input.periodKey, objective.periodKey);

  const weightValue = normalizeWeightInput(input.baselineValue, "Key result");
  const checkInFrequency = normalizeCheckInFrequency(input.checkInFrequency);
  const blockers = normalizeName(input.blockers ?? "");
  const notes = normalizeName(input.notes ?? "");

  const keyResult: KeyResult = {
    krKey,
    krCode: requestedKrCode || getNextKrCode(store, input.objectiveKey),
    objectiveKey: input.objectiveKey,
    periodKey,
    title: input.title,
    owner: normalizeName(resolveOwnerName(input.owner, input.ownerEmail)) || undefined,
    ownerEmail: normalizeEmail(resolveOwnerEmail(input.owner, input.ownerEmail)) || undefined,
    metricType: normalizeMetricType(input.metricType),
    baselineValue: weightValue,
    targetValue: 100,
    currentValue: 0,
    progressPct: 0,
    status: input.status,
    dueDate: input.dueDate,
    checkInFrequency,
    blockers,
    notes,
    lastCheckinAt: nowIso()
  };

  assertKrWeightGroup(store, keyResult);
  store.keyResults.push(keyResult);
  recalcObjectiveInStore(store, objective.objectiveKey);
  persistStore(store);
  return clone(keyResult);
}

export function previewNextObjectiveCode(departmentName: string, ventureName: string, strategicTheme: string): string {
  const store = getStore();
  return getNextObjectiveCode(store, departmentName, ventureName, strategicTheme);
}

export function previewNextKrCode(objectiveKey: string): string {
  const store = getStore();
  return getNextKrCode(store, objectiveKey);
}

type KpiFilters = {
  periodKey?: string;
  objectiveKey?: string;
  krKey?: string;
  owner?: string;
  status?: string;
};

export function listKpis(filters: KpiFilters = {}): Kpi[] {
  const { periodKey, objectiveKey, krKey, owner, status } = filters;

  const kpis = getStore().kpis.filter((kpi) => {
    return (
      isMatch(kpi.periodKey, periodKey) &&
      isMatch(kpi.objectiveKey, objectiveKey) &&
      isMatch(kpi.krKey, krKey) &&
      matchesAssignedOwner(kpi.owner, kpi.ownerEmail, owner) &&
      isMatch(kpi.status, status)
    );
  });

  return clone(kpis);
}

export function getKpi(kpiKey: string): Kpi | null {
  const kpi = getStore().kpis.find((item) => item.kpiKey === kpiKey);
  return kpi ? clone(kpi) : null;
}

export function createKpi(input: CreateKpiInput): Kpi {
  const store = getStore();
  const requestedKpiCode = normalizeKey(input.kpiCode ?? input.kpiKey ?? "");
  const kpiKey = getNextNumericKey(store.kpis.map((item) => item.kpiKey));
  const objective = ensureObjectiveExists(store, input.objectiveKey);
  const keyResult = ensureKrExists(store, input.krKey);

  if (keyResult.objectiveKey !== objective.objectiveKey) {
    throw new Error("Key Result does not belong to the provided objective.");
  }

  const periodKey = resolvePeriodKey(store, input.periodKey, keyResult.periodKey || objective.periodKey);
  const baselineValue = normalizeWeightInput(input.baselineValue, "KPI");
  const targetValue = Number.isFinite(input.targetValue) ? input.targetValue : 100;
  const currentValue = Number.isFinite(input.currentValue) ? input.currentValue : 0;
  const progressPct = computeKrProgress(baselineValue, targetValue, currentValue);
  const checkInFrequency = normalizeCheckInFrequency(input.checkInFrequency);
  const blockers = normalizeName(input.blockers ?? "");
  const notes = normalizeName(input.notes ?? "");

  const kpi: Kpi = {
    kpiKey,
    kpiCode: requestedKpiCode || getNextKpiCode(store, input.krKey),
    objectiveKey: objective.objectiveKey,
    krKey: keyResult.krKey,
    periodKey,
    title: input.title,
    owner: normalizeName(resolveOwnerName(input.owner, input.ownerEmail)) || undefined,
    ownerEmail: normalizeEmail(resolveOwnerEmail(input.owner, input.ownerEmail)) || undefined,
    metricType: normalizeMetricType(input.metricType),
    baselineValue,
    targetValue,
    currentValue,
    progressPct,
    status: input.status,
    dueDate: input.dueDate,
    checkInFrequency,
    blockers,
    notes,
    lastCheckinAt: nowIso()
  };

  assertKpiWeightGroup(store, kpi);
  store.kpis.push(kpi);
  recalcKeyResultInStore(store, keyResult.krKey);
  recalcObjectiveInStore(store, objective.objectiveKey);
  persistStore(store);
  return clone(kpi);
}

export function previewNextKpiCode(krKey: string): string {
  const store = getStore();
  return getNextKpiCode(store, krKey);
}

export function updateKeyResult(krKey: string, patch: UpdateKeyResultInput): KeyResult | null {
  const store = getStore();
  const keyResult = store.keyResults.find((item) => item.krKey === krKey);

  if (!keyResult) {
    return null;
  }

  const originalKeyResult = clone(keyResult);
  const previousObjectiveKey = keyResult.objectiveKey;

  try {
    if (patch.periodKey !== undefined) {
      ensurePeriodExists(store, patch.periodKey);
      keyResult.periodKey = patch.periodKey;
    }

    if (patch.objectiveKey !== undefined) {
      const targetObjective = ensureObjectiveExists(store, patch.objectiveKey);
      keyResult.objectiveKey = patch.objectiveKey;
      if (patch.periodKey === undefined) {
        keyResult.periodKey = targetObjective.periodKey;
      }
    }

    if (patch.krCode !== undefined) {
      keyResult.krCode = normalizeKey(patch.krCode) || keyResult.krKey;
    }

    if (patch.title !== undefined) {
      keyResult.title = normalizeName(patch.title);
    }

    if (patch.owner !== undefined) {
      keyResult.owner = normalizeName(resolveOwnerName(patch.owner, patch.ownerEmail ?? keyResult.ownerEmail)) || undefined;
    }

    if (patch.ownerEmail !== undefined) {
      keyResult.ownerEmail = normalizeEmail(resolveOwnerEmail(patch.owner ?? keyResult.owner, patch.ownerEmail)) || undefined;
    }

    if (patch.metricType !== undefined) {
      keyResult.metricType = normalizeMetricType(patch.metricType);
    }

    if (patch.baselineValue !== undefined) {
      keyResult.baselineValue = normalizeWeightInput(patch.baselineValue, "Key result");
    }

    if (patch.status !== undefined) {
      keyResult.status = patch.status;
    }

    if (patch.dueDate !== undefined) {
      keyResult.dueDate = normalizeName(patch.dueDate);
    }

    if (patch.checkInFrequency !== undefined) {
      keyResult.checkInFrequency = normalizeCheckInFrequency(patch.checkInFrequency);
    }

    if (patch.blockers !== undefined) {
      keyResult.blockers = normalizeName(patch.blockers);
    }

    if (patch.notes !== undefined) {
      keyResult.notes = normalizeName(patch.notes);
    }

    assertKrWeightGroup(store, keyResult);
    if (previousObjectiveKey.toLowerCase() !== keyResult.objectiveKey.toLowerCase()) {
      assertRemainingKrWeights(store, keyResult.krKey, previousObjectiveKey);
    }

    keyResult.lastCheckinAt = nowIso();

    if (previousObjectiveKey.toLowerCase() !== keyResult.objectiveKey.toLowerCase()) {
      store.checkIns.forEach((checkIn) => {
        if (checkIn.krKey.toLowerCase() === keyResult.krKey.toLowerCase()) {
          checkIn.objectiveKey = keyResult.objectiveKey;
        }
      });

      recalcObjectiveInStore(store, previousObjectiveKey);
    }

    recalcKeyResultInStore(store, keyResult.krKey);
    recalcObjectiveInStore(store, keyResult.objectiveKey);
    persistStore(store);
    return clone(keyResult);
  } catch (error) {
    Object.assign(keyResult, originalKeyResult);
    throw error;
  }
}

export function updateKpi(kpiKey: string, patch: UpdateKpiInput): Kpi | null {
  const store = getStore();
  const kpi = store.kpis.find((item) => item.kpiKey === kpiKey);
  if (!kpi) {
    return null;
  }

  const originalKpi = clone(kpi);
  const previousObjectiveKey = kpi.objectiveKey;
  const previousKrKey = kpi.krKey;

  try {
    if (patch.objectiveKey !== undefined) {
      const objective = ensureObjectiveExists(store, patch.objectiveKey);
      kpi.objectiveKey = objective.objectiveKey;
      if (patch.periodKey === undefined) {
        kpi.periodKey = objective.periodKey;
      }
    }

    if (patch.krKey !== undefined) {
      const keyResult = ensureKrExists(store, patch.krKey);
      if (patch.objectiveKey === undefined) {
        kpi.objectiveKey = keyResult.objectiveKey;
      }
      kpi.krKey = keyResult.krKey;
      if (patch.periodKey === undefined) {
        kpi.periodKey = keyResult.periodKey;
      }
    }

    if (patch.periodKey !== undefined) {
      ensurePeriodExists(store, patch.periodKey);
      kpi.periodKey = patch.periodKey;
    }

    if (patch.kpiCode !== undefined) {
      kpi.kpiCode = normalizeKey(patch.kpiCode) || kpi.kpiKey;
    }

    if (patch.title !== undefined) {
      kpi.title = normalizeName(patch.title);
    }

    if (patch.owner !== undefined) {
      kpi.owner = normalizeName(resolveOwnerName(patch.owner, patch.ownerEmail ?? kpi.ownerEmail)) || undefined;
    }

    if (patch.ownerEmail !== undefined) {
      kpi.ownerEmail = normalizeEmail(resolveOwnerEmail(patch.owner ?? kpi.owner, patch.ownerEmail)) || undefined;
    }

    if (patch.metricType !== undefined) {
      kpi.metricType = normalizeMetricType(patch.metricType);
    }

    if (patch.baselineValue !== undefined) {
      kpi.baselineValue = normalizeWeightInput(patch.baselineValue, "KPI");
    }

    if (patch.targetValue !== undefined) {
      kpi.targetValue = patch.targetValue;
    }

    if (patch.currentValue !== undefined) {
      kpi.currentValue = patch.currentValue;
    }

    if (patch.status !== undefined) {
      kpi.status = patch.status;
    }

    if (patch.dueDate !== undefined) {
      kpi.dueDate = normalizeName(patch.dueDate);
    }

    if (patch.checkInFrequency !== undefined) {
      kpi.checkInFrequency = normalizeCheckInFrequency(patch.checkInFrequency);
    }

    if (patch.blockers !== undefined) {
      kpi.blockers = normalizeName(patch.blockers);
    }

    if (patch.notes !== undefined) {
      kpi.notes = normalizeName(patch.notes);
    }

    assertKpiWeightGroup(store, kpi);
    if (previousKrKey.toLowerCase() !== kpi.krKey.toLowerCase()) {
      assertRemainingKpiWeights(store, kpi.kpiKey, previousKrKey);
    }

    kpi.progressPct = computeKrProgress(kpi.baselineValue, kpi.targetValue, kpi.currentValue);
    if (patch.status === undefined) {
      kpi.status = getStatusFromProgress(kpi.progressPct);
    }
    kpi.lastCheckinAt = nowIso();

    if (previousKrKey.toLowerCase() !== kpi.krKey.toLowerCase() || previousObjectiveKey.toLowerCase() !== kpi.objectiveKey.toLowerCase()) {
      store.checkIns.forEach((checkIn) => {
        if ((checkIn.kpiKey ?? "").toLowerCase() === kpi.kpiKey.toLowerCase()) {
          checkIn.objectiveKey = kpi.objectiveKey;
          checkIn.krKey = kpi.krKey;
        }
      });
    }

    recalcKeyResultInStore(store, previousKrKey);
    recalcKeyResultInStore(store, kpi.krKey);
    recalcObjectiveInStore(store, previousObjectiveKey);
    recalcObjectiveInStore(store, kpi.objectiveKey);
    persistStore(store);
    return clone(kpi);
  } catch (error) {
    Object.assign(kpi, originalKpi);
    throw error;
  }
}

export function deleteKeyResult(krKey: string): { krKey: string; deletedCheckInCount: number } | null {
  const store = getStore();
  const krIndex = store.keyResults.findIndex((keyResult) => keyResult.krKey.toLowerCase() === krKey.toLowerCase());

  if (krIndex < 0) {
    return null;
  }

  const keyResult = store.keyResults[krIndex];
  const relatedKpis = store.kpis.filter((kpi) => kpi.krKey.toLowerCase() === keyResult.krKey.toLowerCase());
  const relatedKpiKeys = new Set(relatedKpis.map((kpi) => kpi.kpiKey.toLowerCase()));
  const deletedCheckInCount = store.checkIns.filter((checkIn) => {
    return (
      checkIn.krKey.toLowerCase() === keyResult.krKey.toLowerCase() ||
      relatedKpiKeys.has((checkIn.kpiKey ?? "").toLowerCase())
    );
  }).length;

  store.keyResults.splice(krIndex, 1);
  store.kpis = store.kpis.filter((kpi) => kpi.krKey.toLowerCase() !== keyResult.krKey.toLowerCase());
  store.checkIns = store.checkIns.filter((checkIn) => {
    return (
      checkIn.krKey.toLowerCase() !== keyResult.krKey.toLowerCase() &&
      !relatedKpiKeys.has((checkIn.kpiKey ?? "").toLowerCase())
    );
  });
  recalcObjectiveInStore(store, keyResult.objectiveKey);

  persistStore(store);
  return {
    krKey: keyResult.krKey,
    deletedCheckInCount
  };
}

export function deleteKpi(kpiKey: string): { kpiKey: string; deletedCheckInCount: number } | null {
  const store = getStore();
  const kpiIndex = store.kpis.findIndex((item) => item.kpiKey.toLowerCase() === kpiKey.toLowerCase());
  if (kpiIndex < 0) {
    return null;
  }

  const kpi = store.kpis[kpiIndex];
  const deletedCheckInCount = store.checkIns.filter(
    (checkIn) => (checkIn.kpiKey ?? "").toLowerCase() === kpi.kpiKey.toLowerCase()
  ).length;

  store.kpis.splice(kpiIndex, 1);
  store.checkIns = store.checkIns.filter((checkIn) => (checkIn.kpiKey ?? "").toLowerCase() !== kpi.kpiKey.toLowerCase());
  recalcKeyResultInStore(store, kpi.krKey);
  recalcObjectiveInStore(store, kpi.objectiveKey);
  persistStore(store);
  return {
    kpiKey: kpi.kpiKey,
    deletedCheckInCount
  };
}

type CheckInFilters = {
  periodKey?: string;
  objectiveKey?: string;
  krKey?: string;
  kpiKey?: string;
  owner?: string;
};

type DashboardFilters = {
  ventureKey?: string;
  department?: string;
};

export function listCheckIns(filters: CheckInFilters = {}): CheckIn[] {
  const { periodKey, objectiveKey, krKey, kpiKey, owner } = filters;

  const checkIns = getStore().checkIns.filter((checkIn) => {
    return (
      isMatch(checkIn.periodKey, periodKey) &&
      isMatch(checkIn.objectiveKey, objectiveKey) &&
      isMatch(checkIn.krKey, krKey) &&
      isMatch(checkIn.kpiKey, kpiKey) &&
      isMatch(checkIn.owner, owner)
    );
  });

  return clone(sortByDateDescending(checkIns, (checkIn) => checkIn.checkInAt));
}

export function createCheckIn(input: CreateCheckInInput): CheckIn {
  const store = getStore();
  ensurePeriodExists(store, input.periodKey);
  const objective = ensureObjectiveExists(store, input.objectiveKey);
  const keyResult = ensureKrExists(store, input.krKey);
  const kpi = input.kpiKey ? ensureKpiExists(store, input.kpiKey) : null;

  if (keyResult.objectiveKey !== objective.objectiveKey) {
    throw new Error("KR does not belong to the provided objective.");
  }

  if (keyResult.periodKey !== input.periodKey) {
    throw new Error("KR period does not match the provided period.");
  }

  if (kpi) {
    if (kpi.krKey !== keyResult.krKey) {
      throw new Error("KPI does not belong to the provided key result.");
    }

    if (kpi.objectiveKey !== objective.objectiveKey) {
      throw new Error("KPI does not belong to the provided objective.");
    }

    if (kpi.periodKey !== input.periodKey) {
      throw new Error("KPI period does not match the provided period.");
    }
  }

  const checkInAt = input.checkInAt ?? nowIso();
  const currentValueSnapshot = input.currentValueSnapshot;
  const progressPctSnapshot =
    input.progressPctSnapshot ??
    (kpi
      ? computeKrProgress(kpi.baselineValue, kpi.targetValue, currentValueSnapshot)
      : keyResult.progressPct);

  const status = input.status;
  const checkIn: CheckIn = {
    checkInAt,
    periodKey: input.periodKey,
    objectiveKey: input.objectiveKey,
    krKey: input.krKey,
    kpiKey: input.kpiKey,
    owner: input.owner,
    status,
    confidence: input.confidence,
    updateNotes: input.updateNotes,
    blockers: input.blockers,
    supportNeeded: input.supportNeeded,
    currentValueSnapshot,
    progressPctSnapshot,
    attachments: input.attachments
  };

  store.checkIns.push(checkIn);

  if (kpi) {
    kpi.currentValue = currentValueSnapshot;
    kpi.progressPct = progressPctSnapshot;
    kpi.status = status;
    kpi.blockers = normalizeName(input.blockers);
    kpi.notes = normalizeName(input.updateNotes);
    kpi.lastCheckinAt = checkInAt;
    recalcKeyResultInStore(store, keyResult.krKey);
  } else {
    keyResult.status = status;
    keyResult.blockers = normalizeName(input.blockers);
    keyResult.notes = normalizeName(input.updateNotes);
    keyResult.lastCheckinAt = checkInAt;
    recalcKeyResultInStore(store, keyResult.krKey);
  }

  recalcObjectiveInStore(store, keyResult.objectiveKey);
  persistStore(store);
  return clone(checkIn);
}

export function getDashboardForOwner(owner: string = DEMO_OWNER, filters: DashboardFilters = {}): DashboardMe {
  const store = getStore();
  const normalizedOwner = owner.toLowerCase();
  const { ventureKey, department } = filters;
  const selectedVenture = ventureKey ? findVentureByKey(store, ventureKey) : undefined;
  const isInvalidVentureFilter = Boolean(ventureKey && !selectedVenture);

  const matchesVentureDepartmentFilter = (objective: Objective): boolean => {
    if (isInvalidVentureFilter) {
      return false;
    }

    if (department && objective.department.toLowerCase() !== department.toLowerCase()) {
      return false;
    }

    if (selectedVenture && !objectiveBelongsToVenture(objective, selectedVenture)) {
      return false;
    }

    return true;
  };

  const myObjectives = store.objectives.filter((objective) => {
    if (!matchesAssignedOwner(objective.owner, objective.ownerEmail, normalizedOwner)) {
      return false;
    }

    return matchesVentureDepartmentFilter(objective);
  });

  const objectiveByKey = new Map(
    store.objectives.map((objective) => [objective.objectiveKey.toLowerCase(), objective] as const)
  );

  const myKeyResults = store.keyResults.filter((kr) => {
    if (!matchesAssignedOwner(kr.owner, kr.ownerEmail, normalizedOwner)) {
      return false;
    }

    const objective = objectiveByKey.get(kr.objectiveKey.toLowerCase());
    if (!objective) {
      return false;
    }

    return matchesVentureDepartmentFilter(objective);
  });
  const myKpis = store.kpis.filter((kpi) => {
    if (!matchesAssignedOwner(kpi.owner, kpi.ownerEmail, normalizedOwner)) {
      return false;
    }

    const objective = objectiveByKey.get(kpi.objectiveKey.toLowerCase());
    if (!objective) {
      return false;
    }

    return matchesVentureDepartmentFilter(objective);
  });
  const periodMap = new Map(store.periods.map((period) => [period.periodKey, period]));

  const missingCheckIns = myKeyResults.filter((kr) => {
    const period = periodMap.get(kr.periodKey);
    if (!period) {
      return false;
    }

    return isMissingCheckin(kr.lastCheckinAt, period.status);
  });
  const missingKpis = myKpis.filter((kpi) => {
    const period = periodMap.get(kpi.periodKey);
    if (!period) {
      return false;
    }

    return isMissingCheckin(kpi.lastCheckinAt, period.status);
  });

  const atRiskObjectives = myObjectives.filter((objective) => {
    return objective.rag !== "Green" || objective.status === "AtRisk" || objective.status === "OffTrack";
  });

  return clone({
      owner,
      myObjectives,
      myKeyResults,
      myKpis,
      missingCheckIns,
      missingKpis,
      atRiskObjectives
    });
}

