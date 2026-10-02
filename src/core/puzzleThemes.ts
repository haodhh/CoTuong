// Tags generated puzzles with themes and estimates their difficulty. Used by the puzzle generator.

import { MateSolver } from './mate';
import { mateLength, type Puzzle } from './puzzle';
import { hashString } from './select';
import {
  CANNON,
  FORWARD,
  HORSE,
  IN_BOARD,
  KING,
  PAWN,
  Position,
  ROOK,
  SQUARES,
  fileOf,
  rankOf,
  sideOf,
  typeOf,
  uciToMove,
  type Side,
} from './xiangqi';

const ORTHO = [16, -16, 1, -1];
const HORSE_STEPS: [number, number][] = [
  [16, 33],
  [16, 31],
  [-16, -31],
  [-16, -33],
  [1, 18],
  [1, -14],
  [-1, 14],
  [-1, -18],
];

export interface Checker {
  sq: number;
  type: number;
  /** For a cannon: the screen square it jumps over. */
  screen?: number;
}

/** Pieces of the side not to move that give check to the side to move. */
export function checkers(pos: Position): Checker[] {
  const side = pos.turn;
  const k = pos.kings[side];
  const out: Checker[] = [];
  if (!k) return out;
  const b = pos.board;
  const enemy = (1 - side) * 8;
  for (const d of ORTHO) {
    let s = k + d;
    while (IN_BOARD[s] && !b[s]) s += d;
    if (!IN_BOARD[s]) continue;
    const p = b[s];
    if (p === enemy + ROOK) out.push({ sq: s, type: ROOK });
    if (p === enemy + KING) out.push({ sq: s, type: KING });
    if (p === enemy + PAWN && s === k + d && d !== -FORWARD[side]) out.push({ sq: s, type: PAWN });
    const screen = s;
    s += d;
    while (IN_BOARD[s] && !b[s]) s += d;
    if (IN_BOARD[s] && b[s] === enemy + CANNON) out.push({ sq: s, type: CANNON, screen });
  }
  for (const [leg, t] of HORSE_STEPS) {
    if (b[k - t] === enemy + HORSE && !b[k - t + leg]) out.push({ sq: k - t, type: HORSE });
  }
  return out;
}

/** Attacker pieces without which the final position would no longer be mate. */
function essentialPieces(final: Position, attacker: Side): number[] {
  const types: number[] = [];
  for (const s of SQUARES) {
    const p = final.board[s];
    if (!p || sideOf(p) !== attacker) continue;
    const t = typeOf(p);
    if (t !== ROOK && t !== HORSE && t !== CANNON && t !== KING) continue;
    const copy = new Position(final.fen());
    copy.board[s] = 0;
    if (t === KING) copy.kings[attacker] = 0;
    if (copy.hasLegalMove()) types.push(t);
  }
  return types;
}

export interface PuzzleAnalysis {
  themes: string[];
  rating: number;
}

export function analyzePuzzle(puzzle: Omit<Puzzle, 'rating' | 'themes'>): PuzzleAnalysis {
  const pos = new Position(puzzle.fen);
  pos.play(uciToMove(puzzle.moves[0]));
  const attacker = pos.turn;
  const start = new Position(pos.fen());
  const n = mateLength({ ...puzzle, rating: 0, themes: [] });
  const themes = new Set<string>([`mateIn${n}`]);

  let majors = 0;
  for (const s of SQUARES) {
    const t = typeOf(start.board[s]);
    if (t === ROOK || t === HORSE || t === CANNON) majors++;
  }
  themes.add(majors <= 4 ? 'endgame' : 'middlegame');

  const firstChecks = new MateSolver(start).checks().length;
  const firstCapture = start.board[uciToMove(puzzle.moves[1]) >> 8];

  let sacrifices = 0;
  let replies = 0;
  let defenderNodes = 0;
  for (let i = 1; i < puzzle.moves.length; i++) {
    const m = uciToMove(puzzle.moves[i]);
    if (i % 2 === 0) {
      replies += pos.legalMoves().length;
      defenderNodes++;
      const cap = pos.board[m >> 8];
      if (cap && sideOf(cap) === attacker) sacrifices++;
    }
    pos.play(m);
  }
  if (sacrifices > 0) themes.add('sacrifice');

  const checks = checkers(pos);
  if (checks.length >= 2) themes.add('doubleCheck');
  for (const c of checks) {
    if (c.type === ROOK) themes.add('mateRook');
    if (c.type === HORSE) themes.add('mateHorse');
    if (c.type === CANNON) themes.add('mateCannon');
    if (c.type === PAWN) themes.add('matePawn');
    if (c.type === CANNON && c.screen !== undefined) {
      const screen = pos.board[c.screen];
      if (screen && sideOf(screen) === attacker && typeOf(screen) === HORSE) themes.add('maHauPhao');
      if (screen && sideOf(screen) === attacker && typeOf(screen) === CANNON) themes.add('trungPhao');
    }
    if (c.type === HORSE) {
      const x = fileOf(c.sq);
      const y = rankOf(c.sq);
      if ((x === 2 || x === 6) && y === (attacker === 0 ? 8 : 1)) themes.add('maNgoaTao');
    }
  }
  const essential = essentialPieces(pos, attacker);
  const count = (t: number) => essential.filter((e) => e === t).length;
  if (count(KING) > 0 || checks.some((c) => c.type === KING)) themes.add('bachDienTuong');
  if (count(ROOK) >= 2) themes.add('songXe');
  if (count(ROOK) && count(HORSE)) themes.add('xeMa');
  if (count(ROOK) && count(CANNON)) themes.add('xePhao');
  if (count(HORSE) && count(CANNON)) themes.add('maPhao');

  const BASE = [0, 650, 1000, 1350, 1650, 1900];
  let rating = BASE[Math.min(n, 5)];
  rating += 130 * sacrifices;
  rating += Math.min(200, 25 * Math.max(0, firstChecks - 1));
  if (!firstCapture) rating += 50;
  else if (typeOf(firstCapture) === ROOK) rating -= 50;
  if (defenderNodes > 0) rating += Math.min(120, 20 * (replies / defenderNodes - 1));
  if (themes.has('endgame')) rating -= 30;
  const h = hashString(puzzle.fen + puzzle.moves.join(''));
  rating += (h % 121) - 60;
  rating = Math.round(Math.max(400, Math.min(2600, rating)));

  return { themes: [...themes], rating };
}
