import type { SetEntry, ExerciseLoggingProfile, GoalConfig } from "./types.js";

const timedProfiles = new Set<ExerciseLoggingProfile>(["isometric_sets", "balance_hold", "static_stretch", "loaded_carry", "conditioning_intervals", "sprint_intervals", "rounds", "skill_drill", "water_skill", "cardio_session", "swim_session", "mobility_session", "yoga_flow"]);
export function workTargetSeconds(set: SetEntry | undefined, profile: ExerciseLoggingProfile): number {
  if (!set) return 0;
  const value = set.timerTargetSec ?? set.targetWorkSec ?? (timedProfiles.has(profile) ? set.durationSec : 0) ?? 0;
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}
export function completedActiveSeconds(set: SetEntry): number {
  if (Number.isFinite(set.actualDurationSec)) return Math.max(0, set.actualDurationSec!);
  if (set.startedAt && set.completedAt) {
    const elapsed = (Date.parse(set.completedAt) - Date.parse(set.startedAt)) / 1000;
    if (Number.isFinite(elapsed) && elapsed > 0) return elapsed;
  }
  if (Number.isFinite(set.durationSec) && set.durationSec! > 0) return set.durationSec!;
  return (set.reps ?? 0) > 0 ? Math.min(180, Math.max(15, set.reps! * 3)) : 0;
}
export function hasRecordedWork(set: SetEntry): boolean {
  return set.completed && !set.skipped && set.setType !== "warmup" &&
    ((set.reps ?? 0) > 0 || (set.distanceKm ?? 0) > 0 || completedActiveSeconds(set) > 0);
}
export function goalsForWeek(goals: GoalConfig, key: string): GoalConfig {
  const plan = goals.weeklyPlans?.[key] ?? goals.legacyPlan;
  if (!plan) return goals;
  const selected = plan.personalActivityIds?.length ? plan.personalActivityIds : [plan.personalActivityId];
  return {...goals, ...plan, personalActivityIds: selected};
}
export function rememberWeekPlan(goals: GoalConfig, key: string): void {
  const selected = (goals.personalActivityIds?.length ? goals.personalActivityIds : [goals.personalActivityId ?? "none"]).filter((id, index, all) => id !== "none" && all.indexOf(id) === index).slice(0,2);
  goals.personalActivityIds = selected;
  goals.personalActivityId = selected[0] ?? "none";
  goals.legacyPlan ??= {difficulty: goals.difficulty ?? "normal", personalActivityId: goals.personalActivityId, personalActivityIds: [...selected]};
  goals.weeklyPlans ??= {};
  goals.weeklyPlans[key] = {difficulty: goals.difficulty ?? "normal", personalActivityId: goals.personalActivityId, personalActivityIds: [...selected]};
}
