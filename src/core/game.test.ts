import { describe, expect, it } from 'vitest';
import { positionProblem } from './game';
import { Position, START_FEN } from './xiangqi';

const problem = (fen: string) => positionProblem(new Position(fen));

describe('positionProblem', () => {
  it('accepts positions that can come up in a game', () => {
    expect(problem(START_FEN)).toBeNull();
    expect(problem('3k5/9/9/9/9/9/9/9/4R4/4K4 b')).toBeNull();
    expect(problem('2bak4/4a4/4b4/9/9/2P6/9/9/4A4/3AK1B2 w')).toBeNull();
  });

  it('rejects impossible positions', () => {
    // A king outside the palace, two kings, no king.
    expect(problem('k8/9/9/9/9/9/9/9/9/4K4 w')).toMatch(/ngoài cung/);
    expect(problem('4k4/9/9/9/9/9/9/9/9/3KK4 w')).toMatch(/một Tướng/);
    expect(problem('9/9/9/9/9/9/9/9/9/4K4 w')).toMatch(/một Tướng/);
    // Black is in check but it is Red's turn.
    expect(problem('4k4/9/9/9/9/9/9/9/4R4/3K5 w')).toMatch(/bị chiếu/);
    // Facing kings.
    expect(problem('4k4/9/9/9/9/9/9/9/9/4K4 w')).toMatch(/bị chiếu/);
    // An advisor, an elephant and a pawn on points they can never reach.
    expect(problem('4k4/9/9/9/9/9/9/9/9/3KA4 w')).toMatch(/Sĩ/);
    expect(problem('4k4/9/9/9/9/9/9/9/9/3KB4 w')).toMatch(/Tượng/);
    expect(problem('4k4/9/9/9/9/9/9/9/P8/3K5 w')).toMatch(/Tốt/);
    expect(problem('4k4/9/9/9/9/9/1P7/9/9/3K5 w')).toMatch(/Tốt/);
    // Too many pieces of one kind.
    expect(problem('4k4/9/9/9/9/9/9/RRR6/9/3K5 w')).toMatch(/quá 2/);
  });
});
