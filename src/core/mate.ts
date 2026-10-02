// Forced-mate solver for puzzles. The attacker may only give check (the classic "liên sát"
// style of xiangqi puzzles), except optionally on the first move. In xiangqi a side with no
// legal move loses, so stalemate counts as mate.

import { Position } from './xiangqi';

export class MateSolver {
  /** Smallest n for which the position (attacker to move) is proven mate in n. */
  private proven = new Map<string, number>();
  /** Largest n for which the position is proven not to be mate in n. */
  private refuted = new Map<string, number>();
  nodes = 0;

  constructor(readonly pos: Position) {}

  private key() {
    return `${this.pos.keyLo},${this.pos.keyHi}`;
  }

  /** Legal checking moves of the side to move. */
  checks(): number[] {
    const pos = this.pos;
    const out: number[] = [];
    for (const m of pos.generate([])) {
      if (!pos.play(m)) continue;
      if (pos.lastMoveGaveCheck) out.push(m);
      pos.undo();
    }
    return out;
  }

  /** Whether the side to move can force mate within `n` of its moves, checking every move. */
  canMate(n: number): boolean {
    if (n <= 0) return false;
    const k = this.key();
    const p = this.proven.get(k);
    if (p !== undefined && p <= n) return true;
    const r = this.refuted.get(k);
    if (r !== undefined && r >= n) return false;
    this.nodes++;
    const pos = this.pos;
    let found = false;
    for (const m of pos.generate([])) {
      if (!pos.play(m)) continue;
      const ok = pos.lastMoveGaveCheck && this.defenceFails(n);
      pos.undo();
      if (ok) {
        found = true;
        break;
      }
    }
    if (found) this.proven.set(k, Math.min(n, p ?? n));
    else this.refuted.set(k, Math.max(n, r ?? n));
    return found;
  }

  /** After the attacker's move: whether every defence still allows mate within `n` attacker moves in total. */
  defenceFails(n: number): boolean {
    const pos = this.pos;
    for (const m of pos.generate([])) {
      if (!pos.play(m)) continue;
      const ok = n > 1 && this.canMate(n - 1);
      pos.undo();
      if (!ok) return false;
    }
    // Every reply loses, or there is none: checkmate (or stalemate, also a loss).
    return true;
  }

  /** Length of the shortest forced mate up to `maxN` moves, or 0. */
  mateLength(maxN: number): number {
    for (let n = 1; n <= maxN; n++) if (this.canMate(n)) return n;
    return 0;
  }

  /** Moves of the side to move that force mate within `n` (only checks, unless `quiet`). */
  winningMoves(n: number, quiet = false): number[] {
    const pos = this.pos;
    const out: number[] = [];
    for (const m of pos.legalMoves()) {
      pos.play(m);
      const ok = (quiet || pos.lastMoveGaveCheck) && this.defenceFails(n);
      pos.undo();
      if (ok) out.push(m);
    }
    return out;
  }

  /**
   * The defender's reply (defender to move) that delays mate the longest, when the attacker may
   * use at most `n` more moves after it. `remaining` is the attacker's moves still needed after
   * the reply (99 if the reply escapes). Returns null when the defender has no legal move.
   */
  bestDefence(n: number): { move: number; remaining: number } | null {
    const pos = this.pos;
    let best: { move: number; remaining: number; capture: boolean } | null = null;
    for (const m of pos.legalMoves()) {
      const capture = pos.board[m >> 8] !== 0;
      pos.play(m);
      let remaining = 99;
      for (let k = 1; k <= n; k++) {
        if (this.canMate(k)) {
          remaining = k;
          break;
        }
      }
      pos.undo();
      if (!best || remaining > best.remaining || (remaining === best.remaining && capture && !best.capture)) {
        best = { move: m, remaining, capture };
      }
    }
    return best && { move: best.move, remaining: best.remaining };
  }
}
