import Dexie, { type EntityTable } from 'dexie';
import type { Card } from 'ts-fsrs';
import type { ResultReason } from '../core/game';
import type { Glicko } from '../core/glicko2';
import type { Puzzle } from '../core/puzzle';

export type PuzzleMode = 'rated' | 'theme' | 'rush' | 'review' | 'daily';
export type RushMode = '3m' | '5m' | 'survival';
export type BoardTheme = 'wood' | 'light' | 'green' | 'dark';
export type PieceStyle = 'han' | 'viet';

export interface Settings {
  boardTheme: BoardTheme;
  pieceStyle: PieceStyle;
  sound: boolean;
  coordinates: boolean;
  animation: boolean;
  /** Offset added to the player's rating when picking rated puzzles. */
  difficulty: number;
  dailyGoal: number;
}

export interface Profile {
  id: 'me';
  rating: Glicko;
  /** Timestamp of the last rated attempt, for deviation decay. */
  ratedAt: number;
  createdAt: number;
  onboarded: boolean;
  settings: Settings;
}

export interface Attempt {
  id?: number;
  puzzleId: string;
  ts: number;
  mode: PuzzleMode;
  success: boolean;
  usedHint: boolean;
  timeMs: number;
  puzzleRating: number;
  themes: string[];
  ratingBefore?: number;
  ratingAfter?: number;
}

export interface ReviewCard {
  puzzleId: string;
  puzzle: Puzzle;
  card: Card;
  /** Copy of card.due as a timestamp, for indexing. */
  due: number;
  addedAt: number;
}

export interface RushRun {
  id?: number;
  mode: RushMode;
  score: number;
  ts: number;
  puzzles: { id: string; rating: number; success: boolean }[];
}

export type GameMode = 'bot' | 'local';

export interface GameRecord {
  id?: number;
  ts: number;
  updatedAt: number;
  mode: GameMode;
  /** Bot level, for games against the computer. */
  level?: number;
  /** Side the player had against the bot (0 = Red, 1 = Black). */
  playerSide?: 0 | 1;
  startFen: string;
  moves: string[];
  /** Winner side, 'draw', or undefined while the game is in progress. */
  result?: 0 | 1 | 'draw';
  reason?: ResultReason;
  /** Name of the starting setup (handicap or endgame), if not the normal start. */
  title?: string;
  takebacks?: number;
  hints?: number;
}

export interface DrillResult {
  drillId: string;
  stars: number;
  /** Fewest moves used to win. */
  bestMoves: number;
  ts: number;
}

export interface LessonProgress {
  lessonId: string;
  completedAt: number;
}

export const db = new Dexie('cotuong-trainer') as Dexie & {
  profile: EntityTable<Profile, 'id'>;
  attempts: EntityTable<Attempt, 'id'>;
  reviews: EntityTable<ReviewCard, 'puzzleId'>;
  rushRuns: EntityTable<RushRun, 'id'>;
  games: EntityTable<GameRecord, 'id'>;
  drills: EntityTable<DrillResult, 'drillId'>;
  lessons: EntityTable<LessonProgress, 'lessonId'>;
};

db.version(1).stores({
  profile: 'id',
  attempts: '++id, puzzleId, ts, mode',
  reviews: 'puzzleId, due',
  rushRuns: '++id, mode, ts, score',
  games: '++id, ts, updatedAt, mode',
  drills: 'drillId',
  lessons: 'lessonId',
});
