import { MateSolver } from './mate';
import { moveNotation } from './notation';
import { BLACK, Position, RED, moveToUci, uciToMove, type Side } from './xiangqi';

export interface Puzzle {
  id: string;
  /** Position before the opponent's setup move. */
  fen: string;
  /** UCCI moves: the opponent's setup move followed by the solution, alternating sides. */
  moves: string[];
  rating: number;
  themes: string[];
}

export type MoveVerdict = 'wrong' | 'correct' | 'solved';

/** Number of solver moves in a puzzle (every puzzle is a forced mate in this many moves). */
export const mateLength = (p: Puzzle) => Math.ceil((p.moves.length - 1) / 2);

/**
 * Plays through a puzzle: the first move is the opponent's, then the solver must mate within the
 * puzzle's number of moves. The stored solution is the main line, but any move that still forces
 * mate in time is accepted; the opponent then answers with its most stubborn defence.
 */
export class PuzzleSession {
  readonly pos: Position;
  readonly solverSide: Side;
  /** Solver moves allowed in total. */
  readonly budget: number;
  /** Expected continuation from the current position (starts as the stored solution). */
  private line: string[];
  private readonly played: string[] = [];
  private solverMoves = 0;
  private complete = false;

  constructor(readonly puzzle: Puzzle) {
    this.pos = new Position(puzzle.fen);
    this.solverSide = this.pos.turn === RED ? BLACK : RED;
    this.budget = mateLength(puzzle);
    this.line = [...puzzle.moves];
  }

  get fen() {
    return this.pos.fen();
  }

  get history(): string[] {
    return this.played;
  }

  get lastMove(): string | undefined {
    return this.played[this.played.length - 1];
  }

  get isSolverTurn() {
    return this.played.length > 0 && this.pos.turn === this.solverSide && !this.complete;
  }

  get isComplete() {
    return this.complete;
  }

  get movesLeft() {
    return this.budget - this.solverMoves;
  }

  /** The move the solver should play next, if it is their turn. */
  get expectedMove(): string | undefined {
    if (!this.isSolverTurn) return undefined;
    if (this.line.length > 0) return this.line[0];
    const wins = new MateSolver(this.pos).winningMoves(this.movesLeft);
    return wins.length ? moveToUci(wins[0]) : undefined;
  }

  private apply(uci: string) {
    this.pos.play(uciToMove(uci));
    this.played.push(uci);
    if (!this.pos.hasLegalMove()) this.complete = true;
  }

  /** Plays the next scripted move (the opponent's setup move or reply). Returns it, or undefined. */
  playScripted(): string | undefined {
    if (this.complete) return undefined;
    let uci = this.line.shift();
    if (this.played.length > 0 && this.pos.turn !== this.solverSide && !uci) {
      const best = new MateSolver(this.pos).bestDefence(this.movesLeft);
      uci = best ? moveToUci(best.move) : undefined;
    }
    if (!uci) return undefined;
    if (this.pos.turn === this.solverSide) this.solverMoves++;
    this.apply(uci);
    return uci;
  }

  /** Checks the solver's move. Accepted moves are played on the board; wrong moves are not. */
  tryMove(uci: string): MoveVerdict {
    if (!this.isSolverTurn) return 'wrong';
    const m = uciToMove(uci);
    if (!this.pos.isLegal(m)) return 'wrong';
    if (uci === this.line[0]) {
      this.line.shift();
    } else {
      const pos = this.pos;
      pos.play(m);
      const left = this.movesLeft;
      const ok = !pos.hasLegalMove() || (left > 1 && new MateSolver(pos).defenceFails(left));
      pos.undo();
      if (!ok) return 'wrong';
      // A different winning move: the rest of the line is computed as we go.
      this.line = [];
    }
    this.solverMoves++;
    this.apply(uci);
    return this.complete ? 'solved' : 'correct';
  }
}

/** Every position of the stored solution, for the move list after the puzzle. */
export function puzzleLine(puzzle: Puzzle): { fen: string; move: string; notation: string }[] {
  const pos = new Position(puzzle.fen);
  return puzzle.moves.map((move) => {
    const m = uciToMove(move);
    const notation = moveNotation(pos, m);
    pos.play(m);
    return { fen: pos.fen(), move, notation };
  });
}
