// Vietnamese move notation, e.g. "P2-5" (Pháo 2 bình 5), "M8.7" (Mã 8 tấn 7), "X1/2" (Xe 1 thoái 2).
// Files are numbered 1..9 from each player's right. "." is forward, "/" backward, "-" sideways.
// For the straight-moving pieces (Tướng, Xe, Pháo, Tốt) the last number is the distance when moving
// forward or backward; for Sĩ, Tượng and Mã it is always the destination file.

import {
  ADVISOR,
  ELEPHANT,
  HORSE,
  KING,
  PAWN,
  Position,
  RED,
  SQUARES,
  fileOf,
  moveFrom,
  moveTo,
  rankOf,
  sideOf,
  typeOf,
  type Side,
} from './xiangqi';

export const PIECE_LETTER = ['', 'Tg', 'S', 'T', 'M', 'X', 'P', 'B'];
export const PIECE_NAME = ['', 'Tướng', 'Sĩ', 'Tượng', 'Mã', 'Xe', 'Pháo', 'Tốt'];

/** File number 1..9 from the side's own right. */
export const fileNumber = (side: Side, x: number) => (side === RED ? 9 - x : x + 1);

export function moveNotation(pos: Position, m: number): string {
  const from = moveFrom(m);
  const to = moveTo(m);
  const piece = pos.board[from];
  if (!piece) return '?';
  const side = sideOf(piece);
  const type = typeOf(piece);
  const x = fileOf(from);
  const y = rankOf(from);
  const dy = (rankOf(to) - y) * (side === RED ? 1 : -1);

  // Same pieces on the same file need "t" (front), "g" (middle) or "s" (rear) instead of the file.
  const sameFile = SQUARES.filter((s) => pos.board[s] === piece && fileOf(s) === x).sort(
    (a, b) => (rankOf(b) - rankOf(a)) * (side === RED ? 1 : -1),
  );
  let origin = String(fileNumber(side, x));
  if (sameFile.length > 1 && type !== ADVISOR && type !== ELEPHANT && type !== KING) {
    const i = sameFile.indexOf(from);
    if (sameFile.length === 2) origin = i === 0 ? 't' : 's';
    else if (sameFile.length === 3) origin = ['t', 'g', 's'][i];
    else origin = String(i + 1);
    // Pawns on several files with doubles keep the file number too, e.g. "B7t.1".
    if (type === PAWN && hasOtherDoubledPawnFile(pos, piece, x)) origin = fileNumber(side, x) + origin;
  }

  const diagonal = type === ADVISOR || type === ELEPHANT || type === HORSE;
  let dir: string;
  let num: number;
  if (dy === 0) {
    dir = '-';
    num = fileNumber(side, fileOf(to));
  } else {
    dir = dy > 0 ? '.' : '/';
    num = diagonal ? fileNumber(side, fileOf(to)) : Math.abs(dy);
  }
  return `${PIECE_LETTER[type]}${origin}${dir}${num}`;
}

function hasOtherDoubledPawnFile(pos: Position, piece: number, x: number): boolean {
  const counts = new Map<number, number>();
  for (const s of SQUARES) if (pos.board[s] === piece) counts.set(fileOf(s), (counts.get(fileOf(s)) ?? 0) + 1);
  return [...counts].some(([f, c]) => f !== x && c > 1);
}

/** Notation for a list of UCCI-encoded moves played from `fen`. */
export function lineNotation(fen: string, moves: number[]): string[] {
  const pos = new Position(fen);
  return moves.map((m) => {
    const s = moveNotation(pos, m);
    pos.play(m);
    return s;
  });
}
