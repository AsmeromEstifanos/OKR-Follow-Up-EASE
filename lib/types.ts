export type PeriodStatus = "Planned" | "Active" | "Closed";
export type ObjectiveStatus = string;
export type ObjectiveType = string;
export type OkrCycle = string;
export type KrStatus = string;
export type CheckInFrequency = string;
export type Confidence = "High" | "Medium" | "Low";
export type Rag = "Green" | "Amber" | "Red";
export type MetricType = string;

export interface RagThresholds {
  greenMin: number;
  amberMin: number;
}

export interface Department {
  departmentKey: string;
  name: string;
  owner?: string;
  ownerEmail?: string;
}

export interface Venture {
  ventureKey: string;
  name: string;
  departments: Department[];
}

export interface BoardCardColors {
  department: string;
  objective: string;
  keyResult: string;
  kpi: string;
}

export interface AppConfig {
  ragThresholds: RagThresholds;
  fieldOptions: FieldOptions;
  boardCardColors: BoardCardColors;
  ventures: Venture[];
}

export interface FieldOptions {
  objectiveTypes: string[];
  objectiveStatuses: string[];
  objectiveCycles: string[];
  keyResultMetricTypes: string[];
  keyResultStatuses: string[];
  checkInFrequencies: string[];
}

export interface Period {
  periodKey: string;
  name: string;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
}

export interface Objective {
  objectiveKey: string;
  objectiveCode?: string;
  periodKey: string;
  title: string;
  description: string;
  owner?: string;
  ownerEmail?: string;
  department: string;
  ventureName?: string;
  strategicTheme: string;
  objectiveType: ObjectiveType;
  okrCycle: OkrCycle;
  metricType: MetricType;
  baselineValue: number;
  targetValue: number;
  currentValue: number;
  blockers?: string;
  keyRisksDependency: string;
  notes: string;
  status: ObjectiveStatus;
  progressPct: number;
  confidence: Confidence;
  rag: Rag;
  startDate: string;
  endDate: string;
  dueDate: string;
  checkInFrequency: CheckInFrequency;
  lastCheckinAt: string | null;
}

export interface KeyResult {
  krKey: string;
  krCode?: string;
  objectiveKey: string;
  periodKey: string;
  title: string;
  owner?: string;
  ownerEmail?: string;
  metricType: MetricType;
  baselineValue: number;
  targetValue: number;
  currentValue: number;
  progressPct: number;
  status: KrStatus;
  dueDate: string;
  checkInFrequency: CheckInFrequency;
  blockers?: string;
  notes: string;
  lastCheckinAt: string | null;
}

export interface Kpi {
  kpiKey: string;
  kpiCode?: string;
  objectiveKey: string;
  krKey: string;
  periodKey: string;
  title: string;
  owner?: string;
  ownerEmail?: string;
  metricType: MetricType;
  baselineValue: number;
  targetValue: number;
  currentValue: number;
  progressPct: number;
  status: KrStatus;
  dueDate: string;
  checkInFrequency: CheckInFrequency;
  blockers?: string;
  notes: string;
  lastCheckinAt: string | null;
}

export interface CheckIn {
  checkInAt: string;
  periodKey: string;
  objectiveKey: string;
  krKey: string;
  kpiKey?: string;
  owner: string;
  status: KrStatus;
  confidence: Confidence;
  updateNotes: string;
  blockers: string;
  supportNeeded: string;
  currentValueSnapshot: number;
  progressPctSnapshot: number;
  attachments: string[];
}

export interface DashboardMe {
  owner: string;
  myObjectives: Objective[];
  myKeyResults: KeyResult[];
  myKpis: Kpi[];
  missingCheckIns: KeyResult[];
  missingKpis: Kpi[];
  atRiskObjectives: Objective[];
}

export interface AuthLogEntry {
  authLogKey: string;
  userEmail: string;
  displayName?: string;
  signedInAt: string;
}

export interface ActivityLogEntry {
  activityLogKey: string;
  userEmail: string;
  activityName: string;
  httpMethod: string;
  routePath: string;
  occurredAt: string;
  entityType?: string;
  entityKey?: string;
  entityLabel?: string;
  detailsJson?: string;
}

export interface ObjectiveWithContext {
  objective: Objective;
  keyResults: KeyResult[];
  kpis: Kpi[];
  latestCheckIns: Record<string, CheckIn | null>;
}

export type CreatePeriodInput = Omit<Period, "status"> & { status?: PeriodStatus };
export type CreateObjectiveInput = Omit<Objective, "objectiveKey" | "progressPct" | "lastCheckinAt"> & {
  objectiveKey?: string;
  objectiveCode?: string;
  progressPct?: number;
  lastCheckinAt?: string | null;
  ventureName?: string;
};
export type UpdateObjectiveInput = Partial<
  Pick<
    Objective,
    | "periodKey"
    | "objectiveCode"
    | "title"
    | "description"
    | "owner"
    | "ownerEmail"
    | "department"
    | "ventureName"
    | "strategicTheme"
    | "objectiveType"
    | "okrCycle"
    | "metricType"
    | "baselineValue"
    | "targetValue"
    | "currentValue"
    | "blockers"
    | "keyRisksDependency"
    | "notes"
    | "status"
    | "confidence"
    | "progressPct"
    | "startDate"
    | "endDate"
    | "dueDate"
    | "checkInFrequency"
  >
>;
export type CreateKeyResultInput = Omit<
  KeyResult,
  "krKey" | "progressPct" | "lastCheckinAt" | "checkInFrequency" | "blockers" | "notes"
> & {
  krKey?: string;
  krCode?: string;
  progressPct?: number;
  checkInFrequency?: CheckInFrequency;
  blockers?: string;
  notes?: string;
  lastCheckinAt?: string | null;
};

export type CreateKpiInput = Omit<
  Kpi,
  "kpiKey" | "progressPct" | "lastCheckinAt" | "checkInFrequency" | "blockers" | "notes"
> & {
  kpiKey?: string;
  kpiCode?: string;
  progressPct?: number;
  checkInFrequency?: CheckInFrequency;
  blockers?: string;
  notes?: string;
  lastCheckinAt?: string | null;
};
export type UpdateKeyResultInput = Partial<
  Pick<
    KeyResult,
    | "objectiveKey"
    | "krCode"
    | "periodKey"
    | "title"
    | "owner"
    | "ownerEmail"
    | "metricType"
    | "baselineValue"
    | "targetValue"
    | "currentValue"
    | "status"
    | "dueDate"
    | "checkInFrequency"
    | "blockers"
    | "notes"
  >
>;
export type UpdateKpiInput = Partial<
  Pick<
    Kpi,
    | "objectiveKey"
    | "krKey"
    | "kpiCode"
    | "periodKey"
    | "title"
    | "owner"
    | "ownerEmail"
    | "metricType"
    | "baselineValue"
    | "targetValue"
    | "currentValue"
    | "status"
    | "dueDate"
    | "checkInFrequency"
    | "blockers"
    | "notes"
  >
>;
export type CreateCheckInInput = Omit<CheckIn, "checkInAt" | "progressPctSnapshot"> & {
  checkInAt?: string;
  progressPctSnapshot?: number;
};

export type CreateVentureInput = {
  ventureKey?: string;
  name: string;
  departments?: Array<{
    departmentKey?: string;
    name: string;
    owner?: string;
    ownerEmail?: string;
  }>;
};

export type UpdateVentureInput = Partial<Pick<Venture, "name">>;

export type CreateDepartmentInput = {
  departmentKey?: string;
  name: string;
  owner?: string;
  ownerEmail?: string;
};

export type UpdateDepartmentInput = Partial<Pick<Department, "name" | "owner" | "ownerEmail">>;
