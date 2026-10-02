// Xiangqi (Cờ Tướng) rules: board, FEN, move generation, checks and repetition.
//
// The board is a 16x16 mailbox. Square (x, y) is (y + 3) * 16 + x + 3, where x is the file 0..8
// (a..i, from Red's left) and y the rank 0..9 (0 is Red's back rank). Moves are encoded as
// from | (to << 8) and written in UCCI notation, e.g. "h2e2".

import { PST } from './eval';

export type Side = 0 | 1;
export const RED: Side = 0;
export const BLACK: Side = 1;

export const KING = 1;
export const ADVISOR = 2;
export const ELEPHANT = 3;
export const HORSE = 4;
export const ROOK = 5;
export const CANNON = 6;
export const PAWN = 7;

/** A piece is side * 8 + type: Red pieces are 1..7, Black pieces 9..15. */
export const pieceOf = (side: Side, type: number) => side * 8 + type;
export const sideOf = (piece: number) => (piece >> 3) as Side;
export const typeOf = (piece: number) => piece & 7;

export const START_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

export const squareAt = (x: number, y: number) => ((y + 3) << 4) + x + 3;
export const fileOf = (sq: number) => (sq & 15) - 3;
export const rankOf = (sq: number) => (sq >> 4) - 3;

export const IN_BOARD = new Uint8Array(256);
export const IN_PALACE = new Uint8Array(256);
/** HOME[side][sq] is 1 on that side's half of the board (before the river). */
export const HOME = [new Uint8Array(256), new Uint8Array(256)];
/** The 90 playable squares, from a0 to i9. */
export const SQUARES: number[] = [];

for (let y = 0; y < 10; y++) {
  for (let x = 0; x < 9; x++) {
    const s = squareAt(x, y);
    SQUARES.push(s);
    IN_BOARD[s] = 1;
    if (x >= 3 && x <= 5 && (y <= 2 || y >= 7)) IN_PALACE[s] = 1;
    HOME[y <= 4 ? RED : BLACK][s] = 1;
  }
}

export const FORWARD = [16, -16];
const ORTHO = [16, -16, 1, -1];
const DIAG = [17, 15, -15, -17];
/** Horse moves as [leg, target] offsets: the leg square must be empty. */
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

export const squareName = (sq: number) => String.fromCharCode(97 + fileOf(sq)) + rankOf(sq);

export function parseSquare(name: string): number {
  const x = name.charCodeAt(0) - 97;
  const y = Number(name.slice(1));
  if (x < 0 || x > 8 || !(y >= 0 && y <= 9) || name.length !== 2) return 0;
  return squareAt(x, y);
}

export const moveFrom = (m: number) => m & 255;
export const moveTo = (m: number) => m >> 8;
export const makeMove = (from: number, to: number) => from | (to << 8);
export const moveToUci = (m: number) => squareName(moveFrom(m)) + squareName(moveTo(m));

export function uciToMove(uci: string): number {
  const from = parseSquare(uci.slice(0, 2));
  const to = parseSquare(uci.slice(2, 4));
  return from && to ? makeMove(from, to) : 0;
}

// ---------- Zobrist keys (deterministic, so hashes are stable across runs) ----------

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) | 0;
  };
}
const rand = mulberry32(0x5eed);
const ZOB_LO = new Int32Array(16 * 256).map(() => rand());
const ZOB_HI = new Int32Array(16 * 256).map(() => rand());
const SIDE_LO = rand();
const SIDE_HI = rand();

const FEN_PIECES: Record<string, number> = { k: KING, a: ADVISOR, b: ELEPHANT, e: ELEPHANT, n: HORSE, h: HORSE, r: ROOK, c: CANNON, p: PAWN };
const PIECE_LETTERS = ' kabnrcp';

/** Repetition outcome from the point of view of the side to move. */
export const REP_NONE = 0;
export const REP_DRAW = 1;
/** The opponent kept checking through the whole cycle (perpetual check): the side to move wins. */
export const REP_WIN = 2;
/** The side to move kept checking through the whole cycle: it loses. */
export const REP_LOSS = 3;

const MAX_STACK = 2048;

export class Position {
  board = new Int8Array(256);
  turn: Side = RED;
  /** King square of each side, or 0 if missing (only in composed test positions). */
  kings = [0, 0];
  keyLo = 0;
  keyHi = 0;
  /** Material plus piece-square value of each side, kept up to date incrementally. */
  vals = [0, 0];
  /** Plies since the last capture. */
  halfmove = 0;
  fullmove = 1;

  // Undo stacks, one entry per move played (null moves have move 0).
  private moves = new Int32Array(MAX_STACK);
  private captured = new Int8Array(MAX_STACK);
  private keysLo = new Int32Array(MAX_STACK);
  private keysHi = new Int32Array(MAX_STACK);
  private checks = new Uint8Array(MAX_STACK);
  private clocks = new Int32Array(MAX_STACK);
  ply = 0;

  constructor(fen = START_FEN) {
    this.setFen(fen);
  }

  clone(): Position {
    const p = new Position(this.fen());
    return p;
  }

  setFen(fen: string) {
    this.board.fill(0);
    this.kings = [0, 0];
    this.keyLo = 0;
    this.keyHi = 0;
    this.vals = [0, 0];
    this.ply = 0;
    const [placement, side = 'w', , , half = '0', full = '1'] = fen.trim().split(/\s+/);
    const rows = placement.split('/');
    if (rows.length !== 10) throw new Error(`FEN không hợp lệ: ${fen}`);
    rows.forEach((row, i) => {
      const y = 9 - i;
      let x = 0;
      for (const ch of row) {
        if (ch >= '1' && ch <= '9') {
          x += Number(ch);
          continue;
        }
        const type = FEN_PIECES[ch.toLowerCase()];
        if (!type || x > 8) throw new Error(`FEN không hợp lệ: ${fen}`);
        this.addPiece(squareAt(x, y), pieceOf(ch === ch.toUpperCase() ? RED : BLACK, type));
        x++;
      }
      if (x !== 9) throw new Error(`FEN không hợp lệ: ${fen}`);
    });
    this.turn = side === 'b' ? BLACK : RED;
    if (this.turn === BLACK) {
      this.keyLo ^= SIDE_LO;
      this.keyHi ^= SIDE_HI;
    }
    this.halfmove = Number(half) || 0;
    this.fullmove = Number(full) || 1;
    this.checks[0] = 0;
  }

  fen(): string {
    const rows: string[] = [];
    for (let y = 9; y >= 0; y--) {
      let row = '';
      let empty = 0;
      for (let x = 0; x < 9; x++) {
        const p = this.board[squareAt(x, y)];
        if (!p) {
          empty++;
          continue;
        }
        if (empty) row += empty;
        empty = 0;
        const letter = PIECE_LETTERS[typeOf(p)];
        row += sideOf(p) === RED ? letter.toUpperCase() : letter;
      }
      if (empty) row += empty;
      rows.push(row);
    }
    return `${rows.join('/')} ${this.turn === RED ? 'w' : 'b'} - - ${this.halfmove} ${this.fullmove}`;
  }

  private addPiece(sq: number, piece: number) {
    this.board[sq] = piece;
    const side = sideOf(piece);
    if (typeOf(piece) === KING) this.kings[side] = sq;
    this.vals[side] += PST[piece][sq];
    this.keyLo ^= ZOB_LO[(piece << 8) + sq];
    this.keyHi ^= ZOB_HI[(piece << 8) + sq];
  }

  private removePiece(sq: number) {
    const piece = this.board[sq];
    this.board[sq] = 0;
    const side = sideOf(piece);
    if (typeOf(piece) === KING && this.kings[side] === sq) this.kings[side] = 0;
    this.vals[side] -= PST[piece][sq];
    this.keyLo ^= ZOB_LO[(piece << 8) + sq];
    this.keyHi ^= ZOB_HI[(piece << 8) + sq];
  }

  /** Whether `side`'s king is attacked (including by the facing enemy king). */
  isInCheck(side: Side): boolean {
    const k = this.kings[side];
    if (!k) return false;
    const b = this.board;
    const enemy = (1 - side) * 8;
    // Rooks, cannons, the facing king, and pawns next to the king.
    for (const d of ORTHO) {
      let s = k + d;
      while (IN_BOARD[s] && !b[s]) s += d;
      if (!IN_BOARD[s]) continue;
      const p = b[s];
      if (p === enemy + ROOK || p === enemy + KING) return true;
      if (p === enemy + PAWN && s === k + d && d !== -FORWARD[side]) return true;
      s += d;
      while (IN_BOARD[s] && !b[s]) s += d;
      if (IN_BOARD[s] && b[s] === enemy + CANNON) return true;
    }
    // Horses: the leg of a horse attacking the king is the king's diagonal neighbour towards it.
    for (const [leg, t] of HORSE_STEPS) {
      if (b[k - t] === enemy + HORSE && !b[k - t + leg]) return true;
    }
    return false;
  }

  /** Whether the side to move is in check. */
  inCheck(): boolean {
    return this.ply > 0 ? this.checks[this.ply] === 1 : this.isInCheck(this.turn);
  }

  /** Whether the last move played gave check. */
  get lastMoveGaveCheck(): boolean {
    return this.ply > 0 && this.checks[this.ply] === 1;
  }

  get lastMove(): number {
    return this.ply > 0 ? this.moves[this.ply - 1] : 0;
  }

  get lastCaptured(): number {
    return this.ply > 0 ? this.captured[this.ply - 1] : 0;
  }

  /** Pseudo-legal moves (they may leave the own king in check). Appends to `out`. */
  generate(out: number[], capturesOnly = false): number[] {
    const b = this.board;
    const side = this.turn;
    const own = side * 8;
    const enemy = (1 - side) * 8;
    const isEnemy = (p: number) => p !== 0 && (p & 8) === enemy;
    const canLand = (p: number) => (capturesOnly ? isEnemy(p) : p === 0 || isEnemy(p));
    for (const from of SQUARES) {
      const piece = b[from];
      if (!piece || (piece & 8) !== own) continue;
      switch (piece & 7) {
        case KING:
          for (const d of ORTHO) {
            const to = from + d;
            if (IN_PALACE[to] && canLand(b[to])) out.push(from | (to << 8));
          }
          break;
        case ADVISOR:
          for (const d of DIAG) {
            const to = from + d;
            if (IN_PALACE[to] && canLand(b[to])) out.push(from | (to << 8));
          }
          break;
        case ELEPHANT:
          for (const d of DIAG) {
            const to = from + 2 * d;
            if (IN_BOARD[to] && HOME[side][to] && !b[from + d] && canLand(b[to])) out.push(from | (to << 8));
          }
          break;
        case HORSE:
          for (const [leg, t] of HORSE_STEPS) {
            const to = from + t;
            if (IN_BOARD[to] && !b[from + leg] && canLand(b[to])) out.push(from | (to << 8));
          }
          break;
        case ROOK:
          for (const d of ORTHO) {
            let to = from + d;
            while (IN_BOARD[to]) {
              const p = b[to];
              if (p) {
                if (isEnemy(p)) out.push(from | (to << 8));
                break;
              }
              if (!capturesOnly) out.push(from | (to << 8));
              to += d;
            }
          }
          break;
        case CANNON:
          for (const d of ORTHO) {
            let to = from + d;
            while (IN_BOARD[to] && !b[to]) {
              if (!capturesOnly) out.push(from | (to << 8));
              to += d;
            }
            to += d;
            while (IN_BOARD[to] && !b[to]) to += d;
            if (IN_BOARD[to] && isEnemy(b[to])) out.push(from | (to << 8));
          }
          break;
        case PAWN: {
          const to = from + FORWARD[side];
          if (IN_BOARD[to] && canLand(b[to])) out.push(from | (to << 8));
          if (!HOME[side][from]) {
            for (const d of [1, -1]) {
              const s = from + d;
              if (IN_BOARD[s] && canLand(b[s])) out.push(from | (s << 8));
            }
          }
          break;
        }
      }
    }
    return out;
  }

  /**
   * Plays a pseudo-legal move. Returns false (and leaves the position unchanged) if the move
   * would leave the mover's king in check.
   */
  play(m: number): boolean {
    const from = m & 255;
    const to = m >> 8;
    const piece = this.board[from];
    const cap = this.board[to];
    const side = this.turn;
    const n = this.ply;
    this.keysLo[n] = this.keyLo;
    this.keysHi[n] = this.keyHi;
    this.clocks[n] = this.halfmove;
    this.moves[n] = m;
    this.captured[n] = cap;
    if (cap) this.removePiece(to);
    this.removePiece(from);
    this.addPiece(to, piece);
    this.turn = (1 - side) as Side;
    this.keyLo ^= SIDE_LO;
    this.keyHi ^= SIDE_HI;
    this.ply = n + 1;
    this.halfmove = cap ? 0 : this.halfmove + 1;
    if (side === BLACK) this.fullmove++;
    if (this.isInCheck(side)) {
      this.undo();
      return false;
    }
    this.checks[n + 1] = this.isInCheck(this.turn) ? 1 : 0;
    return true;
  }

  undo() {
    const n = --this.ply;
    const m = this.moves[n];
    if (this.turn === RED) this.fullmove--;
    this.turn = (1 - this.turn) as Side;
    if (m) {
      const from = m & 255;
      const to = m >> 8;
      const piece = this.board[to];
      this.removePiece(to);
      this.addPiece(from, piece);
      if (this.captured[n]) this.addPiece(to, this.captured[n]);
    }
    this.keyLo = this.keysLo[n];
    this.keyHi = this.keysHi[n];
    this.halfmove = this.clocks[n];
  }

  /** Passes the turn (for null-move pruning). Must not be used while in check. */
  playNull() {
    const n = this.ply;
    this.keysLo[n] = this.keyLo;
    this.keysHi[n] = this.keyHi;
    this.clocks[n] = this.halfmove;
    this.moves[n] = 0;
    this.captured[n] = 0;
    this.turn = (1 - this.turn) as Side;
    if (this.turn === RED) this.fullmove++;
    this.keyLo ^= SIDE_LO;
    this.keyHi ^= SIDE_HI;
    this.ply = n + 1;
    this.checks[n + 1] = 0;
  }

  legalMoves(): number[] {
    const out: number[] = [];
    for (const m of this.generate([])) {
      if (this.play(m)) {
        out.push(m);
        this.undo();
      }
    }
    return out;
  }

  hasLegalMove(): boolean {
    for (const m of this.generate([])) {
      if (this.play(m)) {
        this.undo();
        return true;
      }
    }
    return false;
  }

  isLegal(m: number): boolean {
    if (!m || !IN_BOARD[m & 255] || !IN_BOARD[m >> 8]) return false;
    const p = this.board[m & 255];
    if (!p || sideOf(p) !== this.turn) return false;
    const list = this.generate([]);
    if (!list.includes(m)) return false;
    if (!this.play(m)) return false;
    this.undo();
    return true;
  }

  /**
   * Looks for a repetition of the current position since the last capture, and decides it by
   * the perpetual-check rule: the side that checked on every move of the cycle loses.
   */
  repetition(): number {
    const n = this.ply;
    let selfChecks = true;
    let oppChecks = true;
    let opponentMove = true;
    const limit = Math.max(0, n - this.halfmove);
    for (let i = n - 1; i >= limit; i--) {
      if (!this.moves[i]) break;
      const gaveCheck = this.checks[i + 1] === 1;
      if (opponentMove) oppChecks &&= gaveCheck;
      else selfChecks &&= gaveCheck;
      opponentMove = !opponentMove;
      if (opponentMove && this.keysLo[i] === this.keyLo && this.keysHi[i] === this.keyHi) {
        if (oppChecks && !selfChecks) return REP_WIN;
        if (selfChecks && !oppChecks) return REP_LOSS;
        return REP_DRAW;
      }
    }
    return REP_NONE;
  }

  /** How many times the current position occurred before, since the last capture. */
  repetitionCount(): number {
    let count = 0;
    const limit = Math.max(0, this.ply - this.halfmove);
    for (let i = this.ply - 2; i >= limit; i -= 2) {
      if (this.keysLo[i] === this.keyLo && this.keysHi[i] === this.keyHi) count++;
    }
    return count;
  }

  /** Whether `side` has any piece able to give mate (rook, horse, cannon or pawn). */
  hasAttackers(side: Side): boolean {
    for (const s of SQUARES) {
      const p = this.board[s];
      if (p && sideOf(p) === side && typeOf(p) >= HORSE) return true;
    }
    return false;
  }

  pieceAt(sq: number): number {
    return this.board[sq];
  }
}
