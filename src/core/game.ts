import { lineNotation } from './notation';
import { BLACK, Position, REP_LOSS, REP_WIN, RED, START_FEN, moveToUci, uciToMove, type Side } from './xiangqi';

export type ResultReason =
  | 'checkmate'
  | 'stalemate'
  | 'perpetual'
  | 'repetition'
  | 'moveLimit'
  | 'material'
  | 'resign'
  | 'agreement'
  | 'limit';

export interface GameResult {
  /** The winning side, or null for a draw. */
  winner: Side | null;
  reason: ResultReason;
}

export const REASON_TEXT: Record<ResultReason, string> = {
  checkmate: 'chiếu hết',
  stalemate: 'hết nước đi',
  perpetual: 'phạm luật chiếu dai',
  repetition: 'lặp lại thế cờ 3 lần',
  moveLimit: '60 nước không ăn quân',
  material: 'không còn quân tấn công',
  resign: 'xin thua',
  agreement: 'thỏa thuận hòa',
  limit: 'hết số nước cho phép',
};

export const sideName = (side: Side) => (side === RED ? 'Đỏ' : 'Đen');

/**
 * Decides whether the game is over after the last move. Simplified Asian rules: perpetual check
 * loses, other threefold repetitions are drawn, and 60 moves without a capture is a draw.
 */
export function gameStatus(pos: Position): GameResult | null {
  const toMove = pos.turn;
  const other = (1 - toMove) as Side;
  if (!pos.hasLegalMove()) return { winner: other, reason: pos.inCheck() ? 'checkmate' : 'stalemate' };
  if (pos.repetitionCount() >= 2) {
    const rep = pos.repetition();
    if (rep === REP_WIN) return { winner: toMove, reason: 'perpetual' };
    if (rep === REP_LOSS) return { winner: other, reason: 'perpetual' };
    return { winner: null, reason: 'repetition' };
  }
  if (pos.halfmove >= 120) return { winner: null, reason: 'moveLimit' };
  if (!pos.hasAttackers(RED) && !pos.hasAttackers(BLACK)) return { winner: null, reason: 'material' };
  return null;
}

/** A game record: a start position and the moves played from it. */
export class Game {
  readonly pos: Position;
  readonly moves: string[] = [];

  constructor(
    readonly startFen = START_FEN,
    moves: string[] = [],
  ) {
    this.pos = new Position(startFen);
    for (const m of moves) this.play(m);
  }

  play(uci: string): boolean {
    const m = uciToMove(uci);
    if (!this.pos.isLegal(m)) return false;
    this.pos.play(m);
    this.moves.push(moveToUci(m));
    return true;
  }

  undo(): boolean {
    if (this.moves.length === 0) return false;
    this.pos.undo();
    this.moves.pop();
    return true;
  }

  status(): GameResult | null {
    return gameStatus(this.pos);
  }

  notation(): string[] {
    return lineNotation(this.startFen, this.moves.map(uciToMove));
  }

  /** FEN after `ply` moves (0 = start position). */
  fenAt(ply: number): string {
    const p = new Position(this.startFen);
    for (let i = 0; i < ply && i < this.moves.length; i++) p.play(uciToMove(this.moves[i]));
    return p.fen();
  }
}

/** Legal destinations of the side to move, keyed by origin square, for the board. */
export function legalDests(pos: Position): Map<number, number[]> {
  const dests = new Map<number, number[]>();
  for (const m of pos.legalMoves()) {
    const from = m & 255;
    const list = dests.get(from);
    if (list) list.push(m >> 8);
    else dests.set(from, [m >> 8]);
  }
  return dests;
}

/** Board highlight for a UCCI move. */
export function moveSquares(uci: string | undefined): [number, number] | undefined {
  if (!uci) return undefined;
  const m = uciToMove(uci);
  return m ? [m & 255, m >> 8] : undefined;
}
