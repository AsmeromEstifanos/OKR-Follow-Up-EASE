import type { KeyResult, PeriodStatus } from "@/lib/types";

const MISSING_CHECKIN_DAYS = 7;

export function clampPercent(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return Number(value.toFixed(2));
}

export function computeKrProgress(_baselineValue: number, targetValue: number, currentValue: number): number {
  if (!Number.isFinite(targetValue) || targetValue <= 0) {
    return 0;
  }

  return clampPercent((currentValue / targetValue) * 100);
}

function resolveWeight(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return value;
}

export function computeObjectiveProgress(
  keyResults: Array<Pick<KeyResult, "progressPct" | "baselineValue">>,
): number {
  if (keyResults.length === 0) {
    return 0;
  }

  const totalWeight = keyResults.reduce(
    (sum, kr) => sum + resolveWeight(kr.baselineValue),
    0,
  );
  const total = keyResults.reduce(
    (sum, kr) => sum + clampPercent(kr.progressPct) * resolveWeight(kr.baselineValue),
    0,
  );

  if (totalWeight <= 0) {
    return 0;
  }

  return clampPercent(total / totalWeight);
}

export function isMissingCheckin(
  lastCheckinAt: string | null,
  periodStatus: PeriodStatus,
  now: Date = new Date()
): boolean {
  if (periodStatus !== "Active") {
    return false;
  }

  if (!lastCheckinAt) {
    return true;
  }

  const last = new Date(lastCheckinAt).getTime();
  const elapsedDays = (now.getTime() - last) / (1000 * 60 * 60 * 24);
  return elapsedDays > MISSING_CHECKIN_DAYS;
}
