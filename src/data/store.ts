import { useLiveQuery } from 'dexie-react-hooks';
import { decayRd, updateGlicko } from '../core/glicko2';
import type { Puzzle } from '../core/puzzle';
import { gradeFor, reviveCard, scheduleReview } from '../core/srs';
import {
  db,
  type Attempt,
  type DrillResult,
  type GameRecord,
  type Profile,
  type PuzzleMode,
  type ReviewCard,
  type RushRun,
  type Settings,
} from './db';

/** Deviation used for every puzzle when updating the player's rating. */
const PUZZLE_RD = 80;
const DAY = 24 * 3600_000;

export const DEFAULT_SETTINGS: Settings = {
  boardTheme: 'wood',
  pieceStyle: 'han',
  sound: true,
  coordinates: true,
  animation: true,
  difficulty: 0,
  dailyGoal: 20,
};

export function defaultProfile(now = Date.now()): Profile {
  return {
    id: 'me',
    rating: { rating: 1200, rd: 300, vol: 0.06 },
    ratedAt: now,
    createdAt: now,
    onboarded: false,
    settings: DEFAULT_SETTINGS,
  };
}

export async function getProfile(): Promise<Profile> {
  const p = await db.profile.get('me');
  return p ? { ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } } : defaultProfile();
}

export function useProfile(): Profile | undefined {
  return useLiveQuery(getProfile);
}

/** The player's current rating, with deviation grown for the days since the last rated puzzle. */
export function currentRating(profile: Profile, now = Date.now()) {
  return decayRd(profile.rating, Math.floor((now - profile.ratedAt) / DAY));
}

/** Starts the puzzle rating at a self-reported level; the deviation is lower than for an unknown player. */
export async function startWithLevel(rating: number) {
  const p = await getProfile();
  await db.profile.put({ ...p, rating: { rating, rd: 200, vol: 0.06 }, ratedAt: Date.now(), onboarded: true });
}

/** Shows the level picker again; the next pick resets the puzzle rating. */
export async function chooseLevelAgain() {
  const p = await getProfile();
  await db.profile.put({ ...p, onboarded: false });
}

export async function updateSettings(patch: Partial<Settings>) {
  const p = await getProfile();
  await db.profile.put({ ...p, settings: { ...p.settings, ...patch } });
}

export interface AttemptInput {
  puzzle: Puzzle;
  mode: PuzzleMode;
  success: boolean;
  usedHint: boolean;
  timeMs: number;
  /** Whether the result updates the player's puzzle rating. */
  rated: boolean;
}

export interface AttemptResult {
  ratingBefore?: number;
  ratingAfter?: number;
}

/** Stores an attempt, updates the rating when rated, and schedules failed puzzles for review. */
export async function recordAttempt(input: AttemptInput): Promise<AttemptResult> {
  const { puzzle, mode, success, usedHint, timeMs, rated } = input;
  const solved = success && !usedHint;
  return db.transaction('rw', db.profile, db.attempts, db.reviews, async () => {
    const now = Date.now();
    const result: AttemptResult = {};
    if (rated) {
      const profile = await getProfile();
      const before = currentRating(profile, now);
      const after = updateGlicko(before, { rating: puzzle.rating, rd: PUZZLE_RD }, solved ? 1 : 0);
      await db.profile.put({ ...profile, rating: after, ratedAt: now });
      result.ratingBefore = Math.round(before.rating);
      result.ratingAfter = Math.round(after.rating);
    }
    await db.attempts.add({
      puzzleId: puzzle.id,
      ts: now,
      mode,
      success: solved,
      usedHint,
      timeMs,
      puzzleRating: puzzle.rating,
      themes: puzzle.themes,
      ...result,
    });

    const existing = await db.reviews.get(puzzle.id);
    if (!solved || (existing && mode === 'review')) {
      const card = scheduleReview(existing?.card, gradeFor(solved, timeMs), new Date(now));
      await db.reviews.put({
        puzzleId: puzzle.id,
        puzzle,
        card,
        due: card.due.getTime(),
        addedAt: existing?.addedAt ?? now,
      });
    }
    return result;
  });
}

export async function attemptedIds(): Promise<Set<string>> {
  const keys = await db.attempts.orderBy('puzzleId').uniqueKeys();
  return new Set(keys as string[]);
}

export function useAttempts(): Attempt[] | undefined {
  return useLiveQuery(() => db.attempts.orderBy('ts').toArray());
}

export function useDueCount(now: number): number | undefined {
  return useLiveQuery(() => db.reviews.where('due').belowOrEqual(now).count(), [now]);
}

export function useReviews(): ReviewCard[] | undefined {
  return useLiveQuery(() => db.reviews.orderBy('due').toArray());
}

export async function nextDueReview(now = Date.now()): Promise<ReviewCard | undefined> {
  return db.reviews.where('due').belowOrEqual(now).first();
}

export async function removeReview(puzzleId: string) {
  await db.reviews.delete(puzzleId);
}

export async function saveRushRun(run: Omit<RushRun, 'id'>) {
  await db.rushRuns.add(run);
}

export function useRushBest(): Record<string, number> | undefined {
  return useLiveQuery(async () => {
    const best: Record<string, number> = {};
    await db.rushRuns.each((r) => {
      best[r.mode] = Math.max(best[r.mode] ?? 0, r.score);
    });
    return best;
  });
}

// ---------- Games ----------

export async function saveGame(game: GameRecord): Promise<number> {
  return (await db.games.put({ ...game, updatedAt: Date.now() })) as number;
}

export async function getGame(id: number): Promise<GameRecord | undefined> {
  return db.games.get(id);
}

export async function deleteGame(id: number) {
  await db.games.delete(id);
}

export function useGames(): GameRecord[] | undefined {
  return useLiveQuery(() => db.games.orderBy('updatedAt').reverse().toArray());
}

/** The most recent unfinished game of the given mode, to resume it. */
export async function unfinishedGame(mode: GameRecord['mode']): Promise<GameRecord | undefined> {
  const games = await db.games.orderBy('updatedAt').reverse().filter((g) => g.mode === mode && g.result === undefined).toArray();
  return games[0];
}

// ---------- Endgame drills and lessons ----------

export async function saveDrillResult(drillId: string, stars: number, moves: number) {
  const old = await db.drills.get(drillId);
  await db.drills.put({
    drillId,
    stars: Math.max(stars, old?.stars ?? 0),
    bestMoves: Math.min(moves, old?.bestMoves ?? Infinity),
    ts: Date.now(),
  });
}

export function useDrillResults(): Map<string, DrillResult> | undefined {
  return useLiveQuery(async () => new Map((await db.drills.toArray()).map((d) => [d.drillId, d])));
}

export async function completeLesson(lessonId: string) {
  await db.lessons.put({ lessonId, completedAt: Date.now() });
}

export function useCompletedLessons(): Set<string> | undefined {
  return useLiveQuery(async () => new Set((await db.lessons.toArray()).map((l) => l.lessonId)));
}

// ---------- Backup ----------

interface Backup {
  app: 'cotuong-trainer';
  version: 1;
  exportedAt: string;
  profile?: Profile;
  attempts: Attempt[];
  reviews: ReviewCard[];
  rushRuns: RushRun[];
  games?: GameRecord[];
  drills?: DrillResult[];
  lessons?: { lessonId: string; completedAt: number }[];
}

const TABLES = () => [db.profile, db.attempts, db.reviews, db.rushRuns, db.games, db.drills, db.lessons];

export async function exportBackup(): Promise<string> {
  const backup: Backup = {
    app: 'cotuong-trainer',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: await db.profile.get('me'),
    attempts: await db.attempts.toArray(),
    reviews: await db.reviews.toArray(),
    rushRuns: await db.rushRuns.toArray(),
    games: await db.games.toArray(),
    drills: await db.drills.toArray(),
    lessons: await db.lessons.toArray(),
  };
  return JSON.stringify(backup);
}

export async function importBackup(json: string) {
  const data = JSON.parse(json) as Backup;
  if (data.app !== 'cotuong-trainer') throw new Error('File không phải bản sao lưu của ứng dụng này.');
  await db.transaction('rw', TABLES(), async () => {
    await Promise.all(TABLES().map((t) => t.clear()));
    if (data.profile) await db.profile.put(data.profile);
    await db.attempts.bulkAdd(data.attempts);
    await db.reviews.bulkAdd(data.reviews.map((r) => ({ ...r, card: reviveCard(r.card) })));
    await db.rushRuns.bulkAdd(data.rushRuns);
    await db.games.bulkAdd(data.games ?? []);
    await db.drills.bulkAdd(data.drills ?? []);
    await db.lessons.bulkAdd(data.lessons ?? []);
  });
}

export async function resetAll() {
  await Promise.all(TABLES().map((t) => t.clear()));
}
