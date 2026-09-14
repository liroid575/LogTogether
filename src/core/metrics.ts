import type { HikeRecord, WorkoutRecord } from "./types.js";

export function completedSetCount(workout: WorkoutRecord): number {
  return workout.exercises.reduce((sum, exercise) => sum + exercise.sets.filter(set => set.completed).length, 0);
}

export function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

export function averagePace(distanceKm: number, movingMinutes: number): string {
  if (distanceKm <= 0 || movingMinutes <= 0) return "—";
  const pace = movingMinutes / distanceKm;
  const mins = Math.floor(pace);
  const secs = Math.round((pace - mins) * 60);
  return `${mins}:${String(secs === 60 ? 0 : secs).padStart(2, "0")}/km`;
}

export function totalHikeKm(hikes: HikeRecord[]): number {
  return Math.round(hikes.reduce((sum, hike) => sum + hike.distanceKm, 0) * 10) / 10;
}
