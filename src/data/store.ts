import { useLiveQuery } from 'dexie-react-hooks';
import { Game } from '../core/game';
import { decayRd, updateGlicko } from '../core/glicko2';
import type { Puzzle } from '../core/puzzle';
import { gradeFor, reviveCard, scheduleReview } from '../core/srs';
import {
  db,
  type Attempt,
  type BoardTheme,
  type DrillResult,
  type GameRecord,
  type LessonProgress,
  type PieceStyle,
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

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const BOARD_THEMES: BoardTheme[] = ['wood', 'light', 'green', 'dark'];
const PIECE_STYLES: PieceStyle[] = ['han', 'viet'];
const PUZZLE_MODES: PuzzleMode[] = ['rated', 'theme', 'rush', 'review', 'daily'];

/** Settings with every unknown or malformed value replaced by its default. */
export function normalizeSettings(s: Partial<Settings> | undefined): Settings {
  const d = DEFAULT_SETTINGS;
  const v: Record<string, unknown> = s && typeof s === 'object' ? s : {};
  const bool = (k: 'sound' | 'coordinates' | 'animation') => (typeof v[k] === 'boolean' ? (v[k] as boolean) : d[k]);
  return {
    boardTheme: BOARD_THEMES.includes(v.boardTheme as BoardTheme) ? (v.boardTheme as BoardTheme) : d.boardTheme,
    pieceStyle: PIECE_STYLES.includes(v.pieceStyle as PieceStyle) ? (v.pieceStyle as PieceStyle) : d.pieceStyle,
    sound: bool('sound'),
    coordinates: bool('coordinates'),
    animation: bool('animation'),
    difficulty: isNum(v.difficulty) ? Math.max(-600, Math.min(600, v.difficulty)) : d.difficulty,
    dailyGoal: isNum(v.dailyGoal) && v.dailyGoal >= 1 ? Math.round(v.dailyGoal) : d.dailyGoal,
  };
}

/** Fills in anything missing or malformed (old versions, edited backups) with defaults. */
export function normalizeProfile(p: Partial<Profile> | undefined): Profile {
  const d = defaultProfile();
  if (!p || typeof p !== 'object' || Array.isArray(p)) return d;
  const r = p.rating;
  const rating = r && isNum(r.rating) && isNum(r.rd) && isNum(r.vol) ? r : d.rating;
  return {
    ...d,
    ...p,
    id: 'me',
    rating,
    ratedAt: isNum(p.ratedAt) ? p.ratedAt : d.ratedAt,
    createdAt: isNum(p.createdAt) ? p.createdAt : d.createdAt,
    onboarded: typeof p.onboarded === 'boolean' ? p.onboarded : d.onboarded,
    settings: normalizeSettings(p.settings),
  };
}

export async function getProfile(): Promise<Profile> {
  return normalizeProfile(await db.profile.get('me'));
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
  let data: Backup;
  try {
    data = JSON.parse(json) as Backup;
  } catch {
    throw new Error('File không đọc được (không phải JSON).');
  }
  if (!data || data.app !== 'cotuong-trainer') throw new Error('File không phải bản sao lưu của ứng dụng này.');
  // Check everything before clearing the current data, so a bad file changes nothing. Records
  // that the app could not show are left out (and counted), the others get their defaults.
  let skipped = 0;
  const clean = <T,>(v: unknown, fix: (x: Record<string, unknown>) => T | null): T[] => {
    const out: T[] = [];
    for (const x of Array.isArray(v) ? v : []) {
      const r = x && typeof x === 'object' ? fix(x as Record<string, unknown>) : null;
      if (r) out.push(r);
      else skipped++;
    }
    return out;
  };
  const reviews = clean<ReviewCard>(data.reviews, (r) =>
    isStr(r.puzzleId) && r.puzzle && r.card ? ({ ...r, card: reviveCard(r.card as ReviewCard['card']) } as ReviewCard) : null,
  );
  const attempts = clean<Attempt>(data.attempts, (a) =>
    isStr(a.puzzleId) && isNum(a.ts)
      ? ({
          ...a,
          mode: PUZZLE_MODES.includes(a.mode as PuzzleMode) ? a.mode : 'rated',
          success: a.success === true,
          usedHint: a.usedHint === true,
          timeMs: isNum(a.timeMs) ? a.timeMs : 0,
          puzzleRating: isNum(a.puzzleRating) ? a.puzzleRating : 0,
          themes: Array.isArray(a.themes) ? a.themes.filter(isStr) : [],
        } as Attempt)
      : null,
  );
  const rushRuns = clean<RushRun>(data.rushRuns, (r) =>
    ['3m', '5m', 'survival'].includes(r.mode as string) && isNum(r.score) && isNum(r.ts)
      ? ({ ...r, puzzles: Array.isArray(r.puzzles) ? r.puzzles : [] } as RushRun)
      : null,
  );
  const games = clean<GameRecord>(data.games, (g) => {
    if (!isStr(g.startFen) || !Array.isArray(g.moves) || (g.mode !== 'bot' && g.mode !== 'local') || !isNum(g.ts)) return null;
    try {
      // Only games the board can replay.
      const replay = new Game(g.startFen);
      if (!g.moves.every((m) => isStr(m) && replay.play(m))) return null;
    } catch {
      return null;
    }
    return { ...g, updatedAt: isNum(g.updatedAt) ? g.updatedAt : g.ts } as GameRecord;
  });
  const drills = clean<DrillResult>(data.drills, (d) =>
    isStr(d.drillId) && isNum(d.stars) ? ({ ...d, bestMoves: isNum(d.bestMoves) ? d.bestMoves : 0, ts: isNum(d.ts) ? d.ts : 0 } as DrillResult) : null,
  );
  const lessons = clean<LessonProgress>(data.lessons, (l) =>
    isStr(l.lessonId) ? ({ ...l, completedAt: isNum(l.completedAt) ? l.completedAt : 0 } as LessonProgress) : null,
  );
  await db.transaction('rw', TABLES(), async () => {
    await Promise.all(TABLES().map((t) => t.clear()));
    if (data.profile) await db.profile.put(normalizeProfile(data.profile));
    // put, not add: a record repeated in the file (same id) is kept once instead of failing.
    await db.attempts.bulkPut(attempts);
    await db.reviews.bulkPut(reviews);
    await db.rushRuns.bulkPut(rushRuns);
    await db.games.bulkPut(games);
    await db.drills.bulkPut(drills);
    await db.lessons.bulkPut(lessons);
  });
  return { skipped };
}

export async function resetAll() {
  await Promise.all(TABLES().map((t) => t.clear()));
}
