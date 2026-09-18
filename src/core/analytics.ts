import { completedActiveSeconds, hasRecordedWork, goalsForWeek } from "./training.js";
import { exerciseById, exerciseDirectSecondaryCategories, exerciseEntryLoggingProfile, exerciseLibraryGroup, exerciseLoggingProfile, exerciseMovementPattern, exerciseMuscleWeights, exerciseSafetyFlags } from "./exercises.js";
import type { ExerciseCategory, ExerciseDefinition, GoalConfig, GoalDifficulty, HikeRecord, HydrationDay, WorkoutRecord } from "./types.js";

export interface SeriesPoint { key: string; label: string; count: number; sublabel?: string; }
export interface CategorySlice { category: ExerciseDefinition["category"]; count: number; }
export const ALL_CATEGORIES: ExerciseCategory[] = ["chest","back","shoulders","arms","legs","core","cardio","mobility"];

export function localDateKey(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function workoutDurationMinutes(workout: WorkoutRecord): number {
  if (!workout.completedAt) return 0;
  return Math.max(0, Math.round((new Date(workout.completedAt).getTime() - new Date(workout.startedAt).getTime()) / 60000));
}

export function workoutsInCurrentWeek(workouts: WorkoutRecord[], now = new Date()): number {
  const { start, end } = currentWeekBounds(now);
  return workouts.filter(workout => workout.completedAt && new Date(workout.completedAt) >= start && new Date(workout.completedAt) < end).length;
}

export function currentWeekBounds(now = new Date()): { start: Date; end: Date } {
  const day = now.getDay();
  const daysFromMonday = (day + 6) % 7;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday, 0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}



export function weekKey(now = new Date()): string {
  return localDateKey(currentWeekBounds(now).start);
}

export function goalPreset(mode: GoalDifficulty): Pick<GoalConfig, "weeklyCalories" | "categorySets"> {
  const presets: Record<GoalDifficulty, Pick<GoalConfig, "weeklyCalories" | "categorySets">> = {
    easy: { weeklyCalories: 700, categorySets: { chest:1, back:1, shoulders:1, arms:1, legs:1, core:1, cardio:1, mobility:1 } },
    normal: { weeklyCalories: 1050, categorySets: { chest:2, back:2, shoulders:1, arms:2, legs:2, core:2, cardio:1, mobility:1 } },
    hard: { weeklyCalories: 1400, categorySets: { chest:3, back:3, shoulders:2, arms:3, legs:3, core:3, cardio:2, mobility:2 } },
    extreme: { weeklyCalories: 1750, categorySets: { chest:4, back:4, shoulders:3, arms:4, legs:4, core:4, cardio:3, mobility:3 } }
  };
  return { weeklyCalories: presets[mode].weeklyCalories, categorySets: { ...presets[mode].categorySets } };
}

export function hydrationByDate(current: HydrationDay, history: HydrationDay[] = []): Map<string, HydrationDay> {
  const map = new Map<string, HydrationDay>();
  for (const day of history) map.set(day.date, day);
  map.set(current.date, current);
  return map;
}

export function weeklyHydrationSeries(current: HydrationDay, history: HydrationDay[] = [], now = new Date()): SeriesPoint[] {
  const byDate = hydrationByDate(current, history);
  const { start } = currentWeekBounds(now);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start); day.setDate(start.getDate() + index);
    const key = localDateKey(day);
    const entry = byDate.get(key);
    return { key, label: day.toLocaleDateString(undefined,{weekday:"short"}), sublabel: `${day.getMonth()+1}/${day.getDate()}`, count: entry?.totalMl ?? 0 };
  });
}

export function hydrationGoalDaysThisWeek(current: HydrationDay, history: HydrationDay[] = [], now = new Date()): number {
  const byDate = hydrationByDate(current, history);
  const { start } = currentWeekBounds(now);
  let completed = 0;
  for (let i=0; i<7; i++) {
    const day = new Date(start); day.setDate(start.getDate()+i);
    const entry = byDate.get(localDateKey(day));
    if (entry && entry.totalMl >= entry.targetMl) completed++;
  }
  return completed;
}

export function estimateWorkoutCalories(workout: WorkoutRecord, weightKg: number): number {
  // Keep positive snapshots for stable history. New estimates blend actual elapsed
  // time with recorded set volume so a short, intense set is not reduced to only
  // a few seconds of wall-clock time.
  if (Number.isFinite(workout.estimatedCalories) && (workout.estimatedCalories ?? 0) > 0) {
    return Math.max(1, Math.round(workout.estimatedCalories ?? 0));
  }
  if (!workout.completedAt || !weightKg) return 0;

  const setStarts = workout.exercises.flatMap(exercise => exercise.sets.map(set => set.startedAt).filter((value): value is string => Boolean(value)));
  const setEnds = workout.exercises.flatMap(exercise => exercise.sets.map(set => set.completedAt).filter((value): value is string => Boolean(value)));
  const effectiveStart = setStarts.length ? setStarts.slice().sort()[0]! : workout.startedAt;
  const effectiveEnd = setEnds.length ? setEnds.slice().sort().at(-1)! : workout.completedAt;
  const elapsedMs = new Date(effectiveEnd).getTime() - new Date(effectiveStart).getTime();
  const elapsedMinutes = Math.max(0, elapsedMs / 60000);
  const metForDifficulty = (difficulty: number) =>
    difficulty <= 1 ? 3.0 : difficulty === 2 ? 4.5 : difficulty === 3 ? 6.0 : difficulty === 4 ? 8.0 : 10.0;
  const caloriesAt = (met: number, minutes: number) => met * 3.5 * weightKg / 200 * Math.max(0, minutes);

  const difficulties = workout.exercises.map(exercise => exercise.difficulty ?? 3);
  const averageDifficulty = difficulties.length
    ? difficulties.reduce((sum, value) => sum + value, 0) / difficulties.length
    : 3;
  const elapsedEstimate = caloriesAt(metForDifficulty(averageDifficulty), elapsedMinutes);

  let setEstimate = 0;
  for (const exercise of workout.exercises) {
    const difficulty = exercise.difficulty ?? 3;
    const definition = exerciseById(exercise.exerciseId);
    const profile = definition ? exerciseEntryLoggingProfile(exercise, definition) : "sets";
    const timedProfile = ["cardio_session","conditioning_intervals","sprint_intervals","swim_session","rounds","skill_drill","water_skill","mobility_session","static_stretch","dynamic_mobility","yoga_flow","balance_hold"].includes(profile);
    const completedSets = exercise.sets.filter(set => set.completed);
    for (const set of completedSets) {
      let activeSeconds = 0;
      if (timedProfile || definition?.type === "duration" || definition?.type === "distance_time") {
        activeSeconds = Math.max(0, set.durationSec ?? 0);
      } else {
        // Resistance/bodyweight reps usually take roughly 2–4 seconds each.
        // Use 3 s/repetition with a small minimum for a recorded completed set.
        activeSeconds = Math.max(15, Math.min(180, Math.max(0, set.reps ?? 0) * 3));
      }
      setEstimate += caloriesAt(metForDifficulty(difficulty), activeSeconds / 60);
    }
    if (completedSets.length > 1 && exercise.restSec > 0) {
      const recordedRestSeconds = completedSets.slice(0, -1).reduce(
        (sum, set) => sum + Math.max(0, set.restAfterSec ?? exercise.restSec),
        0
      );
      setEstimate += caloriesAt(1.8, recordedRestSeconds / 60);
    }
  }

  if (!elapsedMinutes && !setEstimate) return 0;
  return Math.max(1, Math.round(Math.max(elapsedEstimate, setEstimate)));
}

export function estimateHikeCalories(hike: HikeRecord, weightKg: number): number {
  if (!weightKg || !hike.movingMinutes) return 0;
  const mets = [3.8, 4.5, 5.3, 6.0, 7.8];
  const met = mets[Math.max(0, Math.min(4, hike.difficulty - 1))] ?? 5.3;
  return Math.round(met * 3.5 * weightKg / 200 * hike.movingMinutes);
}

export function caloriesOnDate(workouts: WorkoutRecord[], hikes: HikeRecord[], weightKg: number, dateKey: string): number {
  const workoutCalories = workouts.filter(w => w.completedAt && localDateKey(w.completedAt) === dateKey).reduce((sum,w)=>sum+estimateWorkoutCalories(w,weightKg),0);
  const hikeCalories = hikes.filter(h => h.date === dateKey).reduce((sum,h)=>sum+estimateHikeCalories(h,weightKg),0);
  return workoutCalories + hikeCalories;
}

export function dailyCalorieSeries(workouts: WorkoutRecord[], hikes: HikeRecord[], weightKg: number, now = new Date()): SeriesPoint[] {
  const { start } = currentWeekBounds(now);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start); day.setDate(start.getDate()+index);
    return { key: localDateKey(day), label: day.toLocaleDateString(undefined,{weekday:"short"}), sublabel: `${day.getMonth()+1}/${day.getDate()}`, count: caloriesOnDate(workouts,hikes,weightKg,localDateKey(day)) };
  });
}

export function monthlyCalorieSeries(workouts: WorkoutRecord[], hikes: HikeRecord[], weightKg: number, startMonth = new Date(new Date().getFullYear(), 0, 1), months = 12): SeriesPoint[] {
  const result: SeriesPoint[] = [];
  for (let offset = 0; offset < months; offset += 1) {
    const start = new Date(startMonth.getFullYear(), startMonth.getMonth() + offset, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    let count = 0;
    for (const workout of workouts) {
      if (!workout.completedAt) continue;
      const when = new Date(workout.completedAt);
      if (when >= start && when < end) count += estimateWorkoutCalories(workout, weightKg);
    }
    for (const hike of hikes) {
      const when = new Date(`${hike.date}T12:00:00`);
      if (when >= start && when < end) count += estimateHikeCalories(hike, weightKg);
    }
    result.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      label: start.toLocaleDateString(undefined, { month: "short" }),
      sublabel: String(start.getFullYear()),
      count
    });
  }
  return result;
}

export function weeklyWorkoutSeries(workouts: WorkoutRecord[], weeks = 8, now = new Date()): SeriesPoint[] {
  const { start: currentStart } = currentWeekBounds(now);
  const points: SeriesPoint[] = [];
  for (let offset = weeks - 1; offset >= 0; offset -= 1) {
    const start = new Date(currentStart); start.setDate(currentStart.getDate() - offset * 7);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    const count = workouts.filter(workout => workout.completedAt && new Date(workout.completedAt) >= start && new Date(workout.completedAt) < end).length;
    points.push({ key: localDateKey(start), label: `${start.getMonth() + 1}/${start.getDate()}`, count });
  }
  return points;
}

export function monthlyWorkoutSeries(workouts: WorkoutRecord[], months = 6, now = new Date()): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const count = workouts.filter(workout => workout.completedAt && new Date(workout.completedAt) >= start && new Date(workout.completedAt) < end).length;
    points.push({ key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`, label: start.toLocaleDateString(undefined, { month: "short" }), count });
  }
  return points;
}

export function categoryDistributionForDate(workouts: WorkoutRecord[], hikes: HikeRecord[], dateKey: string): CategorySlice[] {
  const counts = new Map<ExerciseCategory, number>(ALL_CATEGORIES.map(category => [category, 0]));
  for (const workout of workouts) {
    if (!workout.completedAt || localDateKey(workout.completedAt) !== dateKey) continue;
    for (const exercise of workout.exercises) {
      const credits = exerciseTrainingCredits(exercise);
      for (const category of ALL_CATEGORIES) {
        counts.set(category, (counts.get(category) ?? 0) + (credits[category] ?? 0));
      }
    }
  }
  const hikeCount = hikes.filter(hike => hike.date === dateKey).length;
  if (hikeCount) counts.set("cardio", (counts.get("cardio") ?? 0) + hikeCount);
  return ALL_CATEGORIES.map(category => ({ category, count: counts.get(category) ?? 0 }));
}

function completedDurationSeconds(set: WorkoutRecord["exercises"][number]["sets"][number]): number {
  return completedActiveSeconds(set);
}

function workingSets(exercise: WorkoutRecord["exercises"][number]) {
  return exercise.sets.filter(hasRecordedWork);
}

function scienceProfile(exercise: WorkoutRecord["exercises"][number]) {
  const def = exerciseById(exercise.exerciseId);
  return def ? exerciseEntryLoggingProfile(exercise, def) : "sets";
}

function resistanceLike(profile: ReturnType<typeof scienceProfile>): boolean {
  return ["sets","skill_sets","isometric_sets","loaded_carry"].includes(profile);
}

function cardioLike(profile: ReturnType<typeof scienceProfile>): boolean {
  return ["cardio_session","conditioning_intervals","sprint_intervals","swim_session","rounds","skill_drill","water_skill"].includes(profile);
}

function mobilityLike(profile: ReturnType<typeof scienceProfile>): boolean {
  return ["mobility_session","static_stretch","dynamic_mobility","yoga_flow"].includes(profile);
}

function balanceLike(profile: ReturnType<typeof scienceProfile>): boolean {
  return profile === "balance_hold";
}

function exerciseTrainingCredits(exercise: WorkoutRecord["exercises"][number]): Partial<Record<ExerciseCategory, number>> {
  const def = exerciseById(exercise.exerciseId);
  if (!def) return {};
  const completed = workingSets(exercise);
  if (!completed.length) return {};
  const profile = exerciseEntryLoggingProfile(exercise, def);

  if (cardioLike(profile)) {
    if (exerciseSafetyFlags(def).includes("no_pr")) return {};
    const minutes = completed.reduce((sum, set) => sum + completedDurationSeconds(set), 0) / 60;
    return { cardio: Math.min(2, Math.max(0, minutes / 20)) };
  }
  if (mobilityLike(profile)) {
    const minutes = completed.reduce((sum, set) => sum + completedDurationSeconds(set), 0) / 60;
    return { mobility: Math.min(1.5, Math.max(0, minutes / 10)) };
  }
  if (balanceLike(profile)) return {};

  const { primary, secondary } = exerciseDirectSecondaryCategories(def);
  const result: Partial<Record<ExerciseCategory, number>> = { [primary]: completed.length };
  for (const category of secondary) result[category] = (result[category] ?? 0) + completed.length * 0.5;
  return result;
}

export function weeklyCategorySets(workouts: WorkoutRecord[], now = new Date()): Record<ExerciseCategory, number> {
  const totals = Object.fromEntries(ALL_CATEGORIES.map(category => [category, 0])) as Record<ExerciseCategory, number>;
  const {start,end}=currentWeekBounds(now);
  for (const workout of workouts) {
    if (!workout.completedAt) continue;
    const done=new Date(workout.completedAt); if (done<start || done>=end) continue;
    for (const exercise of workout.exercises) {
      const credits = exerciseTrainingCredits(exercise);
      for (const category of ALL_CATEGORIES) totals[category] += credits[category] ?? 0;
    }
  }
  return totals;
}

export interface ScienceMissionTargets {
  push: number; pull: number; lower: number; core: number;
  strengthDays: number; cardioMinutes: number; mobilityMinutes: number;
  goldDays: number; personalSessions: number; hydrationDays: number;
}

export function scienceMissionTargets(mode: GoalDifficulty = "normal"): ScienceMissionTargets {
  const targets: Record<GoalDifficulty, ScienceMissionTargets> = {
    easy:    { push:2, pull:2, lower:2, core:2, strengthDays:1, cardioMinutes:40,  mobilityMinutes:10, goldDays:3, personalSessions:1, hydrationDays:4 },
    normal:  { push:4, pull:4, lower:4, core:3, strengthDays:2, cardioMinutes:75,  mobilityMinutes:20, goldDays:4, personalSessions:1, hydrationDays:5 },
    hard:    { push:6, pull:6, lower:6, core:4, strengthDays:3, cardioMinutes:120, mobilityMinutes:30, goldDays:5, personalSessions:2, hydrationDays:6 },
    extreme: { push:8, pull:8, lower:8, core:5, strengthDays:3, cardioMinutes:150, mobilityMinutes:40, goldDays:6, personalSessions:2, hydrationDays:6 }
  };
  return { ...targets[mode] };
}

export interface ScienceWeekMetrics {
  movement: { push: number; pull: number; lower: number; core: number };
  strengthDays: number;
  cardioMinutes: number;
  mobilityMinutes: number;
  balanceMinutes: number;
  goldDays: number;
  personalSessions: number;
  hydrationDays: number;
  weeklyCalories: number;
}

function exerciseActiveMinutes(exercise: WorkoutRecord["exercises"][number]): number {
  return workingSets(exercise).reduce((sum,set)=>sum+completedDurationSeconds(set),0)/60;
}

function workoutWorkingSetCount(workout: WorkoutRecord): number {
  let total=0;
  for (const exercise of workout.exercises) {
    const def=exerciseById(exercise.exerciseId); if(!def) continue;
    if (resistanceLike(exerciseEntryLoggingProfile(exercise,def))) total += workingSets(exercise).length;
  }
  return total;
}

function workoutCardioMinutes(workout: WorkoutRecord): number {
  let total=0;
  for (const exercise of workout.exercises) {
    const def=exerciseById(exercise.exerciseId); if(!def) continue;
    const profile=exerciseEntryLoggingProfile(exercise,def);
    if (!cardioLike(profile) || exerciseSafetyFlags(def).includes("no_pr")) continue;
    total += exerciseActiveMinutes(exercise);
  }
  return total;
}

function workoutMobilityMinutes(workout: WorkoutRecord): number {
  let total=0;
  for (const exercise of workout.exercises) {
    const def=exerciseById(exercise.exerciseId); if(!def) continue;
    if (mobilityLike(exerciseEntryLoggingProfile(exercise,def))) total += exerciseActiveMinutes(exercise);
  }
  return total;
}

function matchesPersonalActivity(workout: WorkoutRecord, selection: GoalConfig["personalActivityId"]): boolean {
  for (const exercise of workout.exercises) {
    const def=exerciseById(exercise.exerciseId); if(!def || !workingSets(exercise).length) continue;
    // Safety-critical underwater drills remain recordable but intentionally do
    // not complete a gamified Personal Activity mission.
    if (exerciseSafetyFlags(def).includes("no_pr")) continue;
    const group=exerciseLibraryGroup(def);
    const id=def.id;
    if (selection === "swimming" && group === "swimming") return true;
    if (selection === "kickboxing" && group === "kickboxing") return true;
    if (selection === "jump_rope" && id.startsWith("jump_rope_")) return true;
    if (selection === "running" && ["run","trail_running","sprinting","treadmill","stair_running"].includes(id)) return true;
    if (selection === "cycling" && ["cycling","stationary_bike"].includes(id)) return true;
    if (!selection || selection === "any") return true;
  }
  return false;
}

export function meaningfulActivityScoreOnDate(workouts: WorkoutRecord[], hikes: HikeRecord[], dateKey: string): number {
  let strengthSets=0, cardioMinutes=0, mobilityMinutes=0, balanceMinutes=0;
  for (const workout of workouts) {
    if (!workout.completedAt || localDateKey(workout.completedAt)!==dateKey) continue;
    strengthSets += workoutWorkingSetCount(workout);
    cardioMinutes += workoutCardioMinutes(workout);
    mobilityMinutes += workoutMobilityMinutes(workout);
    for (const exercise of workout.exercises) {
      const def=exerciseById(exercise.exerciseId); if(!def) continue;
      if(balanceLike(exerciseEntryLoggingProfile(exercise,def))) balanceMinutes += exerciseActiveMinutes(exercise);
    }
  }
  cardioMinutes += hikes.filter(hike=>hike.date===dateKey).reduce((sum,hike)=>sum+Math.max(0,hike.movingMinutes),0);
  return Math.min(1, strengthSets/4 + cardioMinutes/20 + mobilityMinutes/10 + balanceMinutes/10);
}

export function scienceWeekMetrics(workouts: WorkoutRecord[], hikes: HikeRecord[], goals: GoalConfig, hydration?: HydrationDay, hydrationHistory: HydrationDay[] = [], now = new Date()): ScienceWeekMetrics {
  const {start,end}=currentWeekBounds(now);
  const movement={push:0,pull:0,lower:0,core:0};
  const strengthDates=new Map<string,number>();
  let cardioMinutes=0, mobilityMinutes=0, balanceMinutes=0;
  const personalDates = new Set<string>();
  goals = goalsForWeek(goals, weekKey(now));
  const selection=goals.personalActivityId ?? "any";

  for (const workout of workouts) {
    if(!workout.completedAt) continue;
    const done=new Date(workout.completedAt); if(done<start||done>=end) continue;
    const date=localDateKey(workout.completedAt);
    let workoutStrength=0;
    for(const exercise of workout.exercises){
      const def=exerciseById(exercise.exerciseId); if(!def) continue;
      const profile=exerciseEntryLoggingProfile(exercise,def);
      const completed=workingSets(exercise);
      if(resistanceLike(profile)){
        const count=completed.length;
        workoutStrength += count;
        const pattern=exerciseMovementPattern(def);
        if(pattern==="push"||pattern==="pull"||pattern==="lower"||pattern==="core") movement[pattern]+=count;
      } else if(cardioLike(profile) && !exerciseSafetyFlags(def).includes("no_pr")) cardioMinutes += exerciseActiveMinutes(exercise);
      else if(mobilityLike(profile)) mobilityMinutes += exerciseActiveMinutes(exercise);
      else if(balanceLike(profile)) balanceMinutes += exerciseActiveMinutes(exercise);
    }
    if(workoutStrength) strengthDates.set(date,(strengthDates.get(date)??0)+workoutStrength);
    if(matchesPersonalActivity(workout,selection)) personalDates.add(date);
  }

  const hikeDays=hikes.filter(hike=>{const d=new Date(`${hike.date}T12:00:00`); return d>=start&&d<end;});
  cardioMinutes += hikeDays.reduce((sum,hike)=>sum+Math.max(0,hike.movingMinutes),0);
  if(selection==="hiking"||selection==="any") hikeDays.filter(hike=>hike.movingMinutes>0).forEach(hike=>personalDates.add(hike.date));

  const goldDates=new Set<string>();
  for(let i=0;i<7;i++){const d=new Date(start); d.setDate(start.getDate()+i); const key=localDateKey(d); if(meaningfulActivityScoreOnDate(workouts,hikes,key)>=1) goldDates.add(key);}
  const waterDays=hydration ? hydrationGoalDaysThisWeek(hydration,hydrationHistory,now):0;
  return {
    movement,
    strengthDays:[...strengthDates.values()].filter(count=>count>=4).length,
    cardioMinutes,
    mobilityMinutes,
    balanceMinutes,
    goldDays:goldDates.size,
    personalSessions: personalDates.size,
    hydrationDays:waterDays,
    weeklyCalories:0
  };
}

export interface WeeklyMissionResult {
  score: number;
  targets: ScienceMissionTargets;
  metrics: ScienceWeekMetrics;
  missions: {
    push:boolean; pull:boolean; lower:boolean; core:boolean; strengthDays:boolean;
    cardio:boolean; mobility:boolean; goldDays:boolean; personal:boolean; hydration:boolean;
  };
  // Compatibility fields used by the existing bounded family aggregate schema.
  calorieDays:number; calorieTargetDays:number; calorieMissionDone:boolean;
  categories:number; waterDays:number; waterMissionDone:boolean; weeklyCalories:number;
}

export function weeklyGoalScore(workouts: WorkoutRecord[], hikes: HikeRecord[], weightKg: number, goals: GoalConfig, hydration?: HydrationDay, hydrationHistory: HydrationDay[] = [], now = new Date()): WeeklyMissionResult {
  goals = goalsForWeek(goals, weekKey(now));
  const targets=scienceMissionTargets(goals.difficulty??"normal");
  const metrics=scienceWeekMetrics(workouts,hikes,goals,hydration,hydrationHistory,now);
  metrics.weeklyCalories=dailyCalorieSeries(workouts,hikes,weightKg,now).reduce((sum,p)=>sum+p.count,0);
  const missions={
    push:metrics.movement.push>=targets.push,
    pull:metrics.movement.pull>=targets.pull,
    lower:metrics.movement.lower>=targets.lower,
    core:metrics.movement.core>=targets.core,
    strengthDays:metrics.strengthDays>=targets.strengthDays,
    cardio:metrics.cardioMinutes>=targets.cardioMinutes,
    mobility:metrics.mobilityMinutes>=targets.mobilityMinutes,
    goldDays:metrics.goldDays>=targets.goldDays,
    personal:metrics.personalSessions>=targets.personalSessions,
    hydration:metrics.hydrationDays>=targets.hydrationDays
  };
  const score=Object.values(missions).filter(Boolean).length;
  return {
    score,targets,metrics,missions,
    calorieDays:metrics.goldDays,
    calorieTargetDays:targets.goldDays,
    calorieMissionDone:missions.goldDays,
    categories:[missions.push,missions.pull,missions.lower,missions.core].filter(Boolean).length,
    waterDays:metrics.hydrationDays,
    waterMissionDone:missions.hydration,
    weeklyCalories:metrics.weeklyCalories
  };
}

export interface MonthlyMissionProgress { completed:number; available:number; required:number; earned:boolean; }

export function monthlyGoalProgress(workouts: WorkoutRecord[], hikes: HikeRecord[], weightKg: number, goals: GoalConfig, hydration?: HydrationDay, hydrationHistory: HydrationDay[] = [], now = new Date(), effectiveFrom?: string): MonthlyMissionProgress {
  const year=now.getFullYear(), month=now.getMonth();
  const firstMonday=new Date(year,month,1,12,0,0);
  while(firstMonday.getDay()!==1) firstMonday.setDate(firstMonday.getDate()+1);
  const effective=effectiveFrom ? new Date(`${effectiveFrom}T00:00:00`) : null;
  let completed=0, eligibleWeeks=0;

  // The badge denominator is based on every science-scoring week that belongs
  // to this month, including future weeks. Otherwise an 80% badge could be
  // earned after only the first week (8/10) and would no longer represent a
  // monthly achievement. The numerator only includes weeks reached so far.
  for(let weekStart=new Date(firstMonday); weekStart.getMonth()===month; weekStart.setDate(weekStart.getDate()+7)){
    const weekEndExclusive=new Date(weekStart); weekEndExclusive.setDate(weekEndExclusive.getDate()+7);
    if(effective && weekEndExclusive<=effective) continue;
    eligibleWeeks += 1;
    if(weekStart>now) continue;
    const weekEnd=new Date(weekStart); weekEnd.setDate(weekEnd.getDate()+6); weekEnd.setHours(23,59,59,999);
    const effectiveNow=weekEnd>now?now:weekEnd;
    completed += weeklyGoalScore(workouts,hikes,weightKg,goals,hydration,hydrationHistory,effectiveNow).score;
  }
  const available=eligibleWeeks*10;
  const required=available ? Math.ceil(available*0.8) : 0;
  return {completed,available,required,earned:available>0&&completed>=required};
}

export function monthlyGoalScore(workouts: WorkoutRecord[], hikes: HikeRecord[], weightKg: number, goals: GoalConfig, hydration?: HydrationDay, hydrationHistory: HydrationDay[] = [], now = new Date(), effectiveFrom?: string): number {
  return monthlyGoalProgress(workouts,hikes,weightKg,goals,hydration,hydrationHistory,now,effectiveFrom).completed;
}

export function weeklyHealthGuidelineProgress(workouts: WorkoutRecord[], hikes: HikeRecord[], now = new Date()): { aerobicEquivalentMinutes:number; strengthDays:number } {
  const {start,end}=currentWeekBounds(now);
  let aerobicEquivalentMinutes=0;
  const strengthDates=new Map<string,number>();
  for(const workout of workouts){
    if(!workout.completedAt) continue; const done=new Date(workout.completedAt); if(done<start||done>=end) continue;
    const date=localDateKey(workout.completedAt); let sets=0;
    for(const exercise of workout.exercises){
      const def=exerciseById(exercise.exerciseId); if(!def) continue;
      const profile=exerciseEntryLoggingProfile(exercise,def);
      if(resistanceLike(profile)) sets += workingSets(exercise).length;
      else if(cardioLike(profile)&&!exerciseSafetyFlags(def).includes("no_pr")){
        const minutes=exerciseActiveMinutes(exercise);
        aerobicEquivalentMinutes += minutes * (exercise.difficulty === undefined ? 0 : exercise.difficulty>=4 ? 2 : exercise.difficulty===3 ? 1 : 0);
      }
    }
    if(sets) strengthDates.set(date,(strengthDates.get(date)??0)+sets);
  }
  for(const hike of hikes){const d=new Date(`${hike.date}T12:00:00`); if(d>=start&&d<end) aerobicEquivalentMinutes += Math.max(0,hike.movingMinutes)*(hike.difficulty>=4?2:hike.difficulty===3?1:0);}
  return {aerobicEquivalentMinutes, strengthDays:[...strengthDates.values()].filter(value=>value>=4).length};
}

function legacyEffortMultiplier(value: number | undefined): number {
  return value === 1 ? 0.85 : value === 2 ? 0.95 : value === 4 ? 1.05 : value === 5 ? 1.1 : 1;
}

function legacyExerciseTrainingCredits(exercise: WorkoutRecord["exercises"][number]): Partial<Record<ExerciseCategory, number>> {
  const def=exerciseById(exercise.exerciseId);
  if(!def) return {};
  const completed=exercise.sets.filter(set=>set.completed);
  if(!completed.length) return {};
  const profile=exerciseLoggingProfile(def);
  const effort=legacyEffortMultiplier(exercise.difficulty);
  if(profile==="cardio_session"){
    const minutes=completed.reduce((sum,set)=>sum+completedDurationSeconds(set),0)/60;
    return {cardio:Math.min(2,Math.max(0.25,minutes/20))*effort};
  }
  if(profile==="mobility_session"){
    const minutes=completed.reduce((sum,set)=>sum+completedDurationSeconds(set),0)/60;
    return {mobility:Math.min(1.5,Math.max(0.25,minutes/10))*effort};
  }
  if(profile==="rounds"){
    const minutes=completed.reduce((sum,set)=>sum+completedDurationSeconds(set),0)/60;
    return {cardio:Math.min(2,Math.max(0.25,minutes>0?minutes/10:completed.length*0.35))*effort};
  }
  const weights=exerciseMuscleWeights(def);
  const setCredit=completed.length*effort;
  const result:Partial<Record<ExerciseCategory,number>>={};
  for(const category of ALL_CATEGORIES){const weight=weights[category]??0;if(weight>0) result[category]=setCredit*weight;}
  return result;
}

function legacyWeeklyCategorySets(workouts: WorkoutRecord[], now=new Date()): Record<ExerciseCategory,number> {
  const totals=Object.fromEntries(ALL_CATEGORIES.map(category=>[category,0])) as Record<ExerciseCategory,number>;
  const {start,end}=currentWeekBounds(now);
  for(const workout of workouts){
    if(!workout.completedAt) continue;
    const done=new Date(workout.completedAt); if(done<start||done>=end) continue;
    for(const exercise of workout.exercises){
      const credits=legacyExerciseTrainingCredits(exercise);
      for(const category of ALL_CATEGORIES) totals[category]+=credits[category]??0;
    }
  }
  return totals;
}

// Retained only for migration/snapshotting of badges earned under v0.9.
export function calorieMissionTargetDays(mode: GoalDifficulty = "normal"): number {
  return mode === "easy" ? 3 : mode === "normal" ? 5 : mode === "hard" ? 6 : 7;
}

export function legacyMonthlyGoalScore(workouts: WorkoutRecord[], hikes: HikeRecord[], weightKg: number, goals: GoalConfig, hydration?: HydrationDay, hydrationHistory: HydrationDay[] = [], now = new Date()): number {
  const year=now.getFullYear(), month=now.getMonth();
  const firstMonday=new Date(year,month,1,12,0,0); while(firstMonday.getDay()!==1) firstMonday.setDate(firstMonday.getDate()+1);
  let score=0;
  for(let weekStart=new Date(firstMonday);weekStart.getMonth()===month&&weekStart<=now;weekStart.setDate(weekStart.getDate()+7)){
    const weekEnd=new Date(weekStart);weekEnd.setDate(weekEnd.getDate()+6);weekEnd.setHours(23,59,59,999);const effectiveNow=weekEnd>now?now:weekEnd;
    const series=dailyCalorieSeries(workouts,hikes,weightKg,effectiveNow); const dailyTarget=Math.max(1,goals.weeklyCalories/7);
    const calorieDays=series.filter(day=>day.count>=dailyTarget).length; const calorieDone=calorieDays>=calorieMissionTargetDays(goals.difficulty??"normal");
    const sets=legacyWeeklyCategorySets(workouts,effectiveNow); const categories=ALL_CATEGORIES.filter(category=>(sets[category]??0)>=Math.max(1,goals.categorySets[category]??1)).length;
    const waterDays=hydration?hydrationGoalDaysThisWeek(hydration,hydrationHistory,effectiveNow):0;
    score += categories+(calorieDone?1:0)+(waterDays>=7?1:0);
  }
  return score;
}
