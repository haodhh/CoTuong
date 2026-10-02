import { describe, expect, it } from 'vitest';
import { lineNotation, moveNotation } from './notation';
import { Position, START_FEN, uciToMove } from './xiangqi';

const note = (fen: string, uci: string) => moveNotation(new Position(fen), uciToMove(uci));

describe('Vietnamese notation', () => {
  it('writes common opening moves', () => {
    expect(lineNotation(START_FEN, ['h2e2', 'h9g7', 'b0c2', 'i9h9', 'i0i1', 'b7e7'].map(uciToMove))).toEqual([
      'P2-5',
      'M8.7',
      'M8.7',
      'X9-8',
      'X1.1',
      'P2-5',
    ]);
  });

  it('uses the destination file for diagonal pieces and the distance for straight ones', () => {
    expect(note(START_FEN, 'f0e1')).toBe('S4.5');
    expect(note(START_FEN, 'c0e2')).toBe('T7.5');
    expect(note(START_FEN, 'e0e1')).toBe('Tg5.1');
    expect(note('4k4/9/9/9/9/9/9/9/4R4/4K4 w', 'e1e8')).toBe('X5.7');
    expect(note('4k4/9/9/9/9/9/9/9/9/2R1K4 w', 'c0c5')).toBe('X7.5');
    expect(note('2r1k4/9/9/9/9/9/9/9/9/4K4 b', 'c9c3')).toBe('X3.6');
    expect(note('4k4/9/2r6/9/9/9/9/9/9/4K4 b', 'c7c9')).toBe('X3/2');
  });

  it('marks front and rear pieces on the same file', () => {
    const fen = '4k4/9/9/9/9/2R6/9/9/2R6/4K4 w';
    expect(note(fen, 'c4d4')).toBe('Xt-6');
    expect(note(fen, 'c1c0')).toBe('Xs/1');
  });
});
