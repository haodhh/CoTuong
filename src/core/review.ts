// Game review: converts engine scores to winning chances and classifies each move by how much
// of its side's winning chance it gave away.

export type MoveClass = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

/** Engine evaluation of a position, from Red's point of view. */
export interface PositionEval {
  /** Centipawns for Red (positive is good for Red). */
  cp: number;
  /** Moves to mate: positive if Red mates, negative if Black mates. */
  mate?: number;
  /** Best move in UCCI notation. */
  best?: string;
}

/** Red's winning chance (0..100) for an evaluation. */
export function winChance(e: PositionEval): number {
  if (e.mate !== undefined) return e.mate > 0 ? 100 : 0;
  return 50 + 50 * (2 / (1 + Math.exp(-0.0035 * e.cp)) - 1);
}

export const CLASS_INFO: Record<MoveClass, { symbol: string; label: string; color: string }> = {
  best: { symbol: '★', label: 'Nước tốt nhất', color: 'text-sky-300' },
  good: { symbol: '', label: 'Tốt', color: 'text-stone-300' },
  inaccuracy: { symbol: '?!', label: 'Thiếu chính xác', color: 'text-yellow-300' },
  mistake: { symbol: '?', label: 'Sai lầm', color: 'text-orange-400' },
  blunder: { symbol: '??', label: 'Sai nghiêm trọng', color: 'text-red-400' },
};

export function classify(loss: number, isBest: boolean): MoveClass {
  if (isBest) return 'best';
  if (loss <= 5) return 'good';
  if (loss <= 10) return 'inaccuracy';
  if (loss <= 20) return 'mistake';
  return 'blunder';
}

export interface MoveReview {
  ply: number;
  /** Winning chance given away by the mover (0..100). */
  loss: number;
  cls: MoveClass;
  accuracy: number;
}

/**
 * Reviews `moves` given evaluations of every position (evals[i] is before moves[i], so there is
 * one more evaluation than moves). Red moves on even plies when `redFirst`.
 */
export function reviewGame(moves: string[], evals: PositionEval[], redFirst = true): MoveReview[] {
  return moves.map((move, i) => {
    const red = (i % 2 === 0) === redFirst;
    const before = winChance(evals[i]);
    const after = winChance(evals[i + 1]);
    const loss = Math.max(0, red ? before - after : after - before);
    const accuracy = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));
    return { ply: i, loss, cls: classify(loss, evals[i].best === move), accuracy };
  });
}

/** Average accuracy of one side's moves. */
export function sideAccuracy(reviews: MoveReview[], red: boolean, redFirst = true): number | null {
  const own = reviews.filter((r) => (r.ply % 2 === 0) === redFirst === red);
  if (own.length === 0) return null;
  return own.reduce((s, r) => s + r.accuracy, 0) / own.length;
}
