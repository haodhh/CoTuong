import { BLACK, Position, RED, START_FEN, squareAt, type Side } from './xiangqi';

export interface Handicap {
  id: string;
  name: string;
  /** Squares (from Red's side, x/y) emptied on the giving side; mirrored for Black. */
  remove: [number, number][];
}

export const HANDICAPS: Handicap[] = [
  { id: 'none', name: 'Không chấp', remove: [] },
  { id: 'horse', name: 'Chấp 1 Mã', remove: [[1, 0]] },
  { id: 'cannon', name: 'Chấp 1 Pháo', remove: [[1, 2]] },
  { id: 'rook', name: 'Chấp 1 Xe', remove: [[0, 0]] },
  { id: 'two-horses', name: 'Chấp 2 Mã', remove: [[1, 0], [7, 0]] },
  { id: 'rook-horse', name: 'Chấp Xe Mã', remove: [[0, 0], [1, 0]] },
];

/** Start position with the given handicap pieces removed from `giver`. */
export function handicapFen(id: string, giver: Side): string {
  const h = HANDICAPS.find((x) => x.id === id);
  if (!h || h.remove.length === 0) return START_FEN;
  const pos = new Position(START_FEN);
  for (const [x, y] of h.remove) pos.board[squareAt(giver === RED ? x : 8 - x, giver === BLACK ? 9 - y : y)] = 0;
  return pos.fen();
}
