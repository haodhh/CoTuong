// Difficulty estimate for composed problems (cờ thế), used to order them from easy to hard.

import { Position, SQUARES, sideOf, uciToMove, type Side } from './xiangqi';

export interface DifficultyInput {
  fen: string;
  /** Main line in UCCI notation. */
  moves: string[];
  /** Side the player takes. */
  side: Side;
  goal: 'win' | 'draw';
}

export const LEVELS = [
  { level: 1, name: 'Dễ', color: 'bg-emerald-700/50' },
  { level: 2, name: 'Vừa', color: 'bg-sky-700/50' },
  { level: 3, name: 'Khó', color: 'bg-amber-700/50' },
  { level: 4, name: 'Rất khó', color: 'bg-red-800/60' },
];

/**
 * Highest score of each level (the rest are "Rất khó"). Roughly: Dễ is a 1–2 move mate, Vừa a
 * 3–5 move combination, Khó a longer or quieter solution, Rất khó a long study or a hard draw.
 */
export const LEVEL_THRESHOLDS = [8, 16, 35];

/**
 * A score that grows with what makes a problem hard to find: more moves to play, quiet moves
 * (not checks), sacrifices the opponent can take, holding a draw rather than winning, more
 * choice at the first move, and a busier board. Problems without a known line rank as hard.
 */
export function difficultyScore({ fen, moves, side, goal }: DifficultyInput): number {
  const pos = new Position(fen);
  let playerMoves = 0;
  let quiet = 0;
  let sacrifices = 0;
  let options = -1;
  for (const uci of moves) {
    const m = uciToMove(uci);
    if (pos.turn === side) {
      if (options < 0) options = pos.legalMoves().length;
      playerMoves++;
      pos.play(m);
      if (!pos.lastMoveGaveCheck) quiet++;
    } else {
      const captured = pos.board[m >> 8];
      if (captured && sideOf(captured) === side) sacrifices++;
      pos.play(m);
    }
  }
  const start = new Position(fen);
  if (options < 0) options = start.legalMoves().length;
  const pieces = SQUARES.filter((s) => start.board[s]).length;
  const score =
    3 * playerMoves + 2 * quiet + 2 * sacrifices + 0.05 * options + 0.1 * pieces + (goal === 'draw' ? 5 : 0) + (moves.length === 0 ? 20 : 0);
  return Math.round(score * 10) / 10;
}

export function levelOf(score: number): number {
  const i = LEVEL_THRESHOLDS.findIndex((t) => score <= t);
  return i < 0 ? LEVELS.length : i + 1;
}
