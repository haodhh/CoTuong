// Alpha-beta engine: iterative deepening, principal variation search, transposition table,
// null-move pruning, late move reductions, check extension and quiescence search.

import {
  CANNON,
  HORSE,
  PAWN,
  Position,
  REP_LOSS,
  REP_NONE,
  REP_WIN,
  ROOK,
  SQUARES,
  fileOf,
  rankOf,
  sideOf,
  typeOf,
  type Side,
} from '../core/xiangqi';

export const MATE = 10000;
/** Scores above this are mates (MATE - ply). */
export const MATE_BOUND = MATE - 200;
/** Losing by perpetual check is scored like a slow mate, below real mates. */
const BAN = 9500;
/** Scores above this depend on the search ply and are adjusted in the transposition table. */
const WIN = 9000;
const INF = 30000;
const MAX_PLY = 64;
const TEMPO = 10;

const TT_BITS = 20;
const TT_SIZE = 1 << TT_BITS;
const TT_EXACT = 1;
const TT_LOWER = 2;
const TT_UPPER = 3;

const MVV = [0, 50, 2, 2, 4, 9, 5, 1];

export interface SearchInfo {
  depth: number;
  score: number;
  pv: number[];
  nodes: number;
  timeMs: number;
}

export interface SearchOptions {
  maxDepth?: number;
  timeMs?: number;
  /** Score every root move exactly (slower); used to pick weaker moves on purpose. */
  scoreAllRoot?: boolean;
  onInfo?: (info: SearchInfo) => void;
}

export interface RootScore {
  move: number;
  score: number;
}

export interface SearchResult extends SearchInfo {
  move: number;
  rootScores: RootScore[];
}

class Stop extends Error {}

export class Engine {
  private ttLock = new Int32Array(TT_SIZE);
  private ttMove = new Int32Array(TT_SIZE);
  private ttScore = new Int16Array(TT_SIZE);
  private ttDepth = new Int8Array(TT_SIZE);
  private ttFlag = new Uint8Array(TT_SIZE);
  private history = new Int32Array(16 * 256);
  private killers = new Int32Array(MAX_PLY * 2);
  private nodes = 0;
  private deadline = Infinity;
  private pos!: Position;
  private moveBuf: number[][] = Array.from({ length: MAX_PLY + 8 }, () => []);
  private scoreBuf: number[][] = Array.from({ length: MAX_PLY + 8 }, () => []);

  clear() {
    this.ttLock.fill(0);
    this.ttMove.fill(0);
    this.ttFlag.fill(0);
    this.history.fill(0);
  }

  /** Static evaluation from the side to move's point of view. */
  evaluate(pos: Position): number {
    const side = pos.turn;
    let score = pos.vals[side] - pos.vals[1 - side] + TEMPO;
    score += mopUp(pos, side) - mopUp(pos, (1 - side) as Side);
    return score;
  }

  search(pos: Position, opts: SearchOptions = {}): SearchResult {
    this.pos = pos;
    this.nodes = 0;
    const startPly = pos.ply;
    const start = Date.now();
    this.deadline = opts.timeMs ? start + opts.timeMs : Infinity;
    const maxDepth = Math.min(opts.maxDepth ?? MAX_PLY - 4, MAX_PLY - 4);
    this.killers.fill(0);
    for (let i = 0; i < this.history.length; i++) this.history[i] >>= 2;

    let root = pos.legalMoves().map((move) => ({ move, score: -INF }));
    const result: SearchResult = { move: root[0]?.move ?? 0, score: 0, depth: 0, pv: [], nodes: 0, timeMs: 0, rootScores: [] };
    if (root.length === 0) {
      result.score = -MATE;
      return result;
    }
    // Order the first iteration by a shallow guess: captures first.
    root.sort((a, b) => this.captureScore(b.move) - this.captureScore(a.move));

    for (let depth = 1; depth <= maxDepth; depth++) {
      try {
        if (opts.scoreAllRoot) {
          for (const r of root) r.score = this.rootMoveScore(r.move, depth, -INF, INF);
        } else {
          this.searchRoot(root, depth);
        }
      } catch (e) {
        if (!(e instanceof Stop)) throw e;
        while (pos.ply > startPly) pos.undo();
        break;
      }
      root = [...root].sort((a, b) => b.score - a.score);
      result.move = root[0].move;
      result.score = root[0].score;
      result.depth = depth;
      result.rootScores = root.map((r) => ({ ...r }));
      result.pv = this.extractPv(root[0].move);
      result.nodes = this.nodes;
      result.timeMs = Date.now() - start;
      opts.onInfo?.({ depth, score: result.score, pv: result.pv, nodes: this.nodes, timeMs: result.timeMs });
      if (Math.abs(result.score) > MATE_BOUND && depth > 2 * (MATE - Math.abs(result.score)) + 2) break;
      if (root.length === 1 && depth >= 4 && !opts.scoreAllRoot) break;
      // Stop early when the next iteration would most likely not finish in time.
      if (opts.timeMs && Date.now() - start > opts.timeMs * 0.45) break;
    }
    result.nodes = this.nodes;
    result.timeMs = Date.now() - start;
    return result;
  }

  private rootMoveScore(move: number, depth: number, alpha: number, beta: number): number {
    const pos = this.pos;
    pos.play(move);
    const ext = pos.lastMoveGaveCheck ? 1 : 0;
    const score = -this.alphaBeta(depth - 1 + ext, -beta, -alpha, 1, true);
    pos.undo();
    return score;
  }

  /** Searches the root moves in order; afterwards the best move is first. */
  private searchRoot(root: RootScore[], depth: number) {
    let alpha = -INF;
    let bestIndex = 0;
    for (let i = 0; i < root.length; i++) {
      const r = root[i];
      let score: number;
      if (i === 0) {
        score = this.rootMoveScore(r.move, depth, -INF, INF);
      } else {
        score = this.rootMoveScore(r.move, depth, alpha, alpha + 1);
        if (score > alpha) score = this.rootMoveScore(r.move, depth, alpha, INF);
      }
      // Moves that fail low only have an upper bound; keep them below the best move.
      r.score = i === 0 || score > alpha ? score : Math.min(score, alpha - 1);
      if (score > alpha) {
        alpha = score;
        bestIndex = i;
      }
    }
    const [best] = root.splice(bestIndex, 1);
    root.unshift(best);
  }

  private checkTime() {
    if ((this.nodes & 2047) === 0 && Date.now() > this.deadline) throw new Stop();
  }

  private alphaBeta(depth: number, alpha: number, beta: number, ply: number, allowNull: boolean): number {
    const pos = this.pos;
    const rep = pos.repetition();
    if (rep !== REP_NONE) return repScore(rep, ply);
    if (pos.halfmove >= 120) return 0;
    // Mate distance pruning.
    alpha = Math.max(alpha, -MATE + ply);
    beta = Math.min(beta, MATE - ply - 1);
    if (alpha >= beta) return alpha;
    if (depth <= 0 || ply >= MAX_PLY) return this.quiesce(alpha, beta, ply);

    this.nodes++;
    this.checkTime();
    const pvNode = beta - alpha > 1;

    // Transposition table.
    const idx = pos.keyLo & (TT_SIZE - 1);
    let ttMove = 0;
    if (this.ttLock[idx] === pos.keyHi && this.ttFlag[idx]) {
      ttMove = this.ttMove[idx];
      if (this.ttDepth[idx] >= depth && !pvNode) {
        const s = fromTT(this.ttScore[idx], ply);
        const f = this.ttFlag[idx];
        if (f === TT_EXACT || (f === TT_LOWER && s >= beta) || (f === TT_UPPER && s <= alpha)) return s;
      }
    }

    const inCheck = pos.inCheck();

    // Null move: if passing still fails high, the position is good enough.
    if (allowNull && !pvNode && !inCheck && depth >= 3 && beta < WIN && pos.hasAttackers(pos.turn) && this.evaluate(pos) >= beta) {
      pos.playNull();
      const s = -this.alphaBeta(depth - 3, -beta, -beta + 1, ply + 1, false);
      pos.undo();
      if (s >= beta) return s > WIN ? beta : s;
    }

    const moves = this.moveBuf[ply];
    const scores = this.scoreBuf[ply];
    moves.length = 0;
    scores.length = 0;
    pos.generate(moves);
    const k1 = this.killers[ply * 2];
    const k2 = this.killers[ply * 2 + 1];
    for (const m of moves) {
      let s: number;
      if (m === ttMove) s = 1 << 30;
      else if (pos.board[m >> 8]) s = (1 << 29) + this.captureScore(m);
      else if (m === k1) s = (1 << 28) + 1;
      else if (m === k2) s = 1 << 28;
      else s = this.history[(pos.board[m & 255] << 8) + (m >> 8)];
      scores.push(s);
    }

    const alphaOrig = alpha;
    let best = -INF;
    let bestMove = 0;
    let legal = 0;
    for (let i = 0; i < moves.length; i++) {
      // Selection sort: bring the best remaining move to position i.
      let bi = i;
      for (let j = i + 1; j < moves.length; j++) if (scores[j] > scores[bi]) bi = j;
      const m = moves[bi];
      moves[bi] = moves[i];
      moves[i] = m;
      const ms = scores[bi];
      scores[bi] = scores[i];
      scores[i] = ms;

      const capture = pos.board[m >> 8] !== 0;
      if (!pos.play(m)) continue;
      legal++;
      const givesCheck = pos.lastMoveGaveCheck;
      const newDepth = depth - 1 + (givesCheck ? 1 : 0);
      let score: number;
      if (legal === 1) {
        score = -this.alphaBeta(newDepth, -beta, -alpha, ply + 1, true);
      } else {
        let r = 0;
        if (depth >= 3 && legal > 3 && !capture && !inCheck && !givesCheck && m !== k1 && m !== k2) {
          r = legal > 10 ? 2 : 1;
        }
        score = -this.alphaBeta(newDepth - r, -alpha - 1, -alpha, ply + 1, true);
        if (score > alpha && r > 0) score = -this.alphaBeta(newDepth, -alpha - 1, -alpha, ply + 1, true);
        if (score > alpha && score < beta) score = -this.alphaBeta(newDepth, -beta, -alpha, ply + 1, true);
      }
      pos.undo();

      if (score > best) {
        best = score;
        bestMove = m;
        if (score > alpha) {
          alpha = score;
          if (score >= beta) {
            if (!capture) {
              if (m !== k1) {
                this.killers[ply * 2 + 1] = k1;
                this.killers[ply * 2] = m;
              }
              this.history[(pos.board[m & 255] << 8) + (m >> 8)] += depth * depth;
            }
            break;
          }
        }
      }
    }

    // No legal move: checkmate, or stalemate, which also loses in xiangqi.
    if (legal === 0) return -MATE + ply;

    const flag = best >= beta ? TT_LOWER : best > alphaOrig ? TT_EXACT : TT_UPPER;
    if (depth >= this.ttDepth[idx] || this.ttLock[idx] !== pos.keyHi || flag === TT_EXACT) {
      this.ttLock[idx] = pos.keyHi;
      this.ttMove[idx] = bestMove;
      this.ttScore[idx] = toTT(best, ply);
      this.ttDepth[idx] = depth;
      this.ttFlag[idx] = flag;
    }
    return best;
  }

  private quiesce(alpha: number, beta: number, ply: number): number {
    const pos = this.pos;
    this.nodes++;
    this.checkTime();
    const rep = pos.repetition();
    if (rep !== REP_NONE) return repScore(rep, ply);
    const inCheck = pos.inCheck();
    let best: number;
    if (inCheck) {
      best = -MATE + ply;
    } else {
      best = this.evaluate(pos);
      if (best >= beta || ply >= MAX_PLY + 6) return best;
      if (best > alpha) alpha = best;
    }
    if (ply >= MAX_PLY + 6) return best;

    const moves = this.moveBuf[Math.min(ply, MAX_PLY + 7)];
    const scores = this.scoreBuf[Math.min(ply, MAX_PLY + 7)];
    moves.length = 0;
    scores.length = 0;
    pos.generate(moves, !inCheck);
    for (const m of moves) scores.push(pos.board[m >> 8] ? this.captureScore(m) + 1000 : this.history[(pos.board[m & 255] << 8) + (m >> 8)] >> 4);
    for (let i = 0; i < moves.length; i++) {
      let bi = i;
      for (let j = i + 1; j < moves.length; j++) if (scores[j] > scores[bi]) bi = j;
      const m = moves[bi];
      moves[bi] = moves[i];
      moves[i] = m;
      const ms = scores[bi];
      scores[bi] = scores[i];
      scores[i] = ms;
      if (!pos.play(m)) continue;
      const score = -this.quiesce(-beta, -alpha, ply + 1);
      pos.undo();
      if (score > best) {
        best = score;
        if (score > alpha) {
          alpha = score;
          if (score >= beta) break;
        }
      }
    }
    return best;
  }

  private captureScore(m: number): number {
    const b = this.pos.board;
    const victim = b[m >> 8];
    if (!victim) return 0;
    return MVV[typeOf(victim)] * 16 - MVV[typeOf(b[m & 255])];
  }

  private extractPv(first: number): number[] {
    const pos = this.pos;
    const pv: number[] = [];
    let m = first;
    while (m && pv.length < 16 && pos.isLegal(m)) {
      pv.push(m);
      pos.play(m);
      const idx = pos.keyLo & (TT_SIZE - 1);
      m = this.ttLock[idx] === pos.keyHi && this.ttFlag[idx] ? this.ttMove[idx] : 0;
      if (pos.repetition() !== REP_NONE) break;
    }
    for (let i = 0; i < pv.length; i++) pos.undo();
    return pv;
  }
}

function repScore(rep: number, ply: number): number {
  if (rep === REP_WIN) return BAN - ply;
  if (rep === REP_LOSS) return -BAN + ply;
  return 0;
}

const toTT = (s: number, ply: number) => (s > WIN ? s + ply : s < -WIN ? s - ply : s);
const fromTT = (s: number, ply: number) => (s > WIN ? s - ply : s < -WIN ? s + ply : s);

/**
 * When `side` is far ahead and the opponent has few defenders left, reward pushing the enemy king
 * out of its palace centre and bringing pieces close, so the engine converts won endgames.
 */
function mopUp(pos: Position, side: Side): number {
  const enemy = (1 - side) as Side;
  const lead = pos.vals[side] - pos.vals[enemy];
  if (lead < 250) return 0;
  let enemyAttackers = 0;
  let near = 0;
  const k = pos.kings[enemy];
  if (!k) return 0;
  const kx = fileOf(k);
  const ky = rankOf(k);
  for (const s of SQUARES) {
    const p = pos.board[s];
    if (!p) continue;
    const t = typeOf(p);
    if (sideOf(p) === enemy) {
      if (t >= HORSE) enemyAttackers += t === PAWN ? 1 : 3;
    } else if (t === ROOK || t === HORSE || t === CANNON || t === PAWN) {
      near += 14 - Math.abs(fileOf(s) - kx) - Math.abs(rankOf(s) - ky);
    }
  }
  if (enemyAttackers > 2) return 0;
  const homeY = enemy === 0 ? 0 : 9;
  const displaced = Math.abs(kx - 4) * 6 + Math.abs(ky - homeY) * 8;
  return near + displaced;
}

export const isMateScore = (score: number) => Math.abs(score) > MATE_BOUND;

/** Moves until mate for a mate score (positive: the side to move mates). */
export const mateIn = (score: number) => Math.sign(score) * Math.ceil((MATE - Math.abs(score)) / 2);

