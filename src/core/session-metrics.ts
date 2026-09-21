import type { ExerciseDefinition, WorkoutPerformanceMetrics } from "./types.js";
import { exerciseLibraryGroup, exerciseMovementPattern, exerciseScienceLoggingProfile, exerciseSessionMetricFlags } from "./exercises.js";

export interface SessionMetricAvailability {
  activeDuration: boolean;
  distance: boolean;
  averagePace: boolean;
  fastestPace: boolean;
  averageSpeed: boolean;
  maximumSpeed: boolean;
  elevation: boolean;
  averageCadence: boolean;
  maximumCadence: boolean;
  poolLength: boolean;
  laps: boolean;
  strokeRate: boolean;
  strokeCount: boolean;
  averagePower: boolean;
  maximumPower: boolean;
  resistance: boolean;
  heartRate: boolean;
}

export function hmsToSeconds(hours: number, minutes: number, seconds: number): number | undefined {
  const values = [hours, minutes, seconds];
  if (!values.every(Number.isFinite) || values.some(value => value < 0)) return undefined;
  const wholeHours = Math.floor(hours);
  const wholeMinutes = Math.floor(minutes);
  const wholeSeconds = Math.floor(seconds);
  if (wholeMinutes > 59 || wholeSeconds > 59) return undefined;
  const total = wholeHours * 3600 + wholeMinutes * 60 + wholeSeconds;
  return total > 0 ? total : undefined;
}

export function secondsToHms(totalSeconds: number | undefined): { hours: number; minutes: number; seconds: number } {
  const total = Math.max(0, Math.round(Number(totalSeconds) || 0));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60
  };
}

export function elapsedSeconds(startedAt: string, completedAt: string): number | undefined {
  const start = Date.parse(startedAt);
  const end = Date.parse(completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return undefined;
  return Math.round((end - start) / 1000);
}

export function sessionMetricAvailability(definition: ExerciseDefinition): SessionMetricAvailability {
  const profile = exerciseScienceLoggingProfile(definition);
  const group = exerciseLibraryGroup(definition);
  const movement = exerciseMovementPattern(definition);
  const flags = exerciseSessionMetricFlags(definition);
  const id = definition.id;
  const swimming = group === "swimming" || profile === "swim_session";
  const rowing = id === "rowing_machine";
  const cycling = ["cycling", "stationary_bike"].includes(id);
  const locomotion = ["walk", "run", "trail_running", "stair_running", "treadmill", "hiking_cardio"].includes(id);
  const cardioMachine = ["treadmill", "stationary_bike", "elliptical", "stair_climber", "rowing_machine"].includes(id);
  const cardio = movement === "cardio" || profile === "cardio_session" || profile === "swim_session";
  const speedUseful = locomotion || cycling || flags.speed;

  return {
    activeDuration: true,
    distance: flags.distance || locomotion || cycling || rowing || swimming,
    averagePace: locomotion || rowing || swimming,
    fastestPace: locomotion,
    averageSpeed: speedUseful,
    maximumSpeed: speedUseful,
    elevation: flags.vertical || locomotion || cycling,
    averageCadence: flags.cadence || locomotion || cycling || cardioMachine,
    maximumCadence: locomotion || cycling,
    poolLength: swimming,
    laps: flags.laps || swimming,
    strokeRate: flags.strokeRate || rowing || swimming,
    strokeCount: swimming,
    averagePower: cycling || rowing,
    maximumPower: cycling || rowing,
    resistance: flags.resistance || cardioMachine,
    heartRate: cardio || ["sets", "skill_sets", "isometric_sets", "loaded_carry"].includes(profile)
  };
}

export function sanitizePerformanceMetrics(value: Partial<WorkoutPerformanceMetrics>): WorkoutPerformanceMetrics | undefined {
  const result: WorkoutPerformanceMetrics = {};
  const positive = (key: keyof WorkoutPerformanceMetrics, maximum = 1_000_000, integer = false) => {
    const raw = Number(value[key]);
    if (!Number.isFinite(raw) || raw <= 0) return;
    (result as Record<string, number>)[key] = integer ? Math.round(Math.min(raw, maximum)) : Math.min(raw, maximum);
  };
  positive("elapsedDurationSec", 7 * 24 * 3600, true);
  positive("activeDurationSec", 7 * 24 * 3600, true);
  positive("distanceKm", 10_000);
  positive("averagePaceSec", 24 * 3600, true);
  positive("fastestPaceSec", 24 * 3600, true);
  positive("paceDistanceM", 1_000, true);
  positive("averageSpeedKph", 500);
  positive("maximumSpeedKph", 500);
  positive("elevationGainM", 100_000);
  positive("averageCadenceRpm", 500, true);
  positive("maximumCadenceRpm", 500, true);
  positive("poolLengthM", 200);
  positive("laps", 100_000, true);
  positive("averageStrokeRateSpm", 500, true);
  positive("strokeCount", 1_000_000, true);
  positive("averagePowerWatts", 10_000, true);
  positive("maximumPowerWatts", 10_000, true);
  positive("resistanceLevel", 10_000);
  return Object.keys(result).length ? result : undefined;
}
