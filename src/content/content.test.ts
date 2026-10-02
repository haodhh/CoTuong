import { describe, expect, it } from 'vitest';
import { MateSolver } from '../core/mate';
import { BLACK, Position, RED, parseSquare, sideOf, uciToMove } from '../core/xiangqi';
import { DRILLS } from './drills';
import { LESSONS } from './lessons';

function legalPosition(fen: string): Position {
  const pos = new Position(fen);
  expect(pos.kings[RED], fen).toBeGreaterThan(0);
  expect(pos.kings[BLACK], fen).toBeGreaterThan(0);
  // The side that just moved cannot be in check (this also rules out facing kings).
  expect(pos.isInCheck((1 - pos.turn) as 0 | 1), fen).toBe(false);
  return pos;
}

describe('lessons', () => {
  it('have unique ids', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
  });

  for (const lesson of LESSONS) {
    it(`"${lesson.title}" has valid steps`, () => {
      for (const step of lesson.steps) {
        const pos = legalPosition(step.fen);
        if (step.type === 'explain') {
          for (const a of step.arrows ?? []) expect(uciToMove(a), a).toBeGreaterThan(0);
          for (const m of step.marks ?? []) expect(parseSquare(m), m).toBeGreaterThan(0);
        }
        if (step.type === 'dests') {
          const sq = parseSquare(step.square);
          expect(pos.board[sq], step.text).toBeGreaterThan(0);
          expect(sideOf(pos.board[sq])).toBe(pos.turn);
          expect(pos.legalMoves().some((m) => (m & 255) === sq), step.text).toBe(true);
        }
        if (step.type === 'move') {
          if (step.anyLegal) expect(pos.hasLegalMove()).toBe(true);
          else expect(step.solution.length).toBeGreaterThan(0);
          for (const uci of step.solution) {
            const p = new Position(step.fen);
            expect(p.isLegal(uciToMove(uci)), uci).toBe(true);
            p.play(uciToMove(uci));
            if (step.reply && uci === step.solution[0]) expect(p.isLegal(uciToMove(step.reply)), step.reply).toBe(true);
          }
        }
        if (step.type === 'mate') {
          expect(new MateSolver(pos).winningMoves(1, true).length, step.fen).toBeGreaterThan(0);
        }
      }
    });
  }
});

describe('endgame drills', () => {
  it('have unique ids and sensible targets', () => {
    expect(new Set(DRILLS.map((d) => d.id)).size).toBe(DRILLS.length);
    for (const d of DRILLS) expect(d.par, d.id).toBeLessThan(d.limit);
  });

  it('start from legal, undecided positions', () => {
    for (const d of DRILLS) {
      const pos = legalPosition(d.fen);
      expect(pos.hasLegalMove(), d.id).toBe(true);
      expect(pos.hasAttackers(pos.turn), d.id).toBe(true);
    }
  });
});
