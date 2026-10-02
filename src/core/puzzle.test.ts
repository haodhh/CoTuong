import { describe, expect, it } from 'vitest';
import { MateSolver } from './mate';
import { PuzzleSession, mateLength, type Puzzle } from './puzzle';
import { analyzePuzzle } from './puzzleThemes';
import { Position, moveToUci } from './xiangqi';

const puzzle: Puzzle = {
  id: 't1',
  fen: '1rba1k3/4a4/4b4/1P7/9/2N6/5n2p/8c/9/2BAK4 w - - 18 102',
  moves: ['c0e2', 'f3g1', 'e0e1', 'i2i1'],
  rating: 1000,
  themes: [],
};

describe('MateSolver', () => {
  it('finds mates and their unique first move', () => {
    const pos = new Position('4k4/9/9/9/9/9/9/9/9/R3K4 w');
    const solver = new MateSolver(pos);
    expect(solver.mateLength(3)).toBe(0); // a lone rook cannot mate by checks alone here
    const mate1 = new Position('3k5/9/9/9/9/9/9/9/4R4/4K4 w');
    // The black king on d9 is boxed in by the red king's file; Rd1 mates.
    expect(new MateSolver(mate1).winningMoves(1).map(moveToUci)).toEqual(['e1d1']);
  });

  it('proves the generated puzzle is a mate in 2', () => {
    const s = new PuzzleSession(puzzle);
    s.playScripted();
    const solver = new MateSolver(s.pos);
    expect(solver.mateLength(5)).toBe(2);
    expect(solver.winningMoves(2, true).map(moveToUci)).toEqual(['f3g1']);
  });
});

describe('PuzzleSession', () => {
  it('plays the setup move, rejects wrong moves and accepts the solution', () => {
    const s = new PuzzleSession(puzzle);
    expect(mateLength(puzzle)).toBe(2);
    expect(s.isSolverTurn).toBe(false);
    expect(s.playScripted()).toBe('c0e2');
    expect(s.isSolverTurn).toBe(true);
    expect(s.expectedMove).toBe('f3g1');
    expect(s.tryMove('i2i1')).toBe('wrong');
    expect(s.tryMove('f3g1')).toBe('correct');
    expect(s.playScripted()).toBe('e0e1');
    expect(s.tryMove('i2i1')).toBe('solved');
    expect(s.isComplete).toBe(true);
  });

  it('tags themes and estimates a rating', () => {
    const a = analyzePuzzle(puzzle);
    expect(a.themes).toContain('mateIn2');
    expect(a.rating).toBeGreaterThan(700);
    expect(a.rating).toBeLessThan(1500);
  });
});
