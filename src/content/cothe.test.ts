import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bookOfId, parseRow, playerMoves, type CoThe } from '../data/cotheData';
import { BLACK, Position, RED, uciToMove } from '../core/xiangqi';
import { LEVEL_THRESHOLDS, difficultyScore, levelOf } from '../core/difficulty';
import { COTHE_BOOKS } from './cotheBooks';

const dir = new URL('../../public/data/cothe/', import.meta.url);
const index = JSON.parse(readFileSync(new URL('index.json', dir), 'utf8')) as { total: number; books: { id: string; count: number; file: string }[] };
const problems: CoThe[] = index.books.flatMap((b) => JSON.parse(readFileSync(new URL(b.file, dir), 'utf8')).entries.map(parseRow));

describe('cờ thế data', () => {
  it('matches its index and uses known books', () => {
    expect(problems.length).toBe(index.total);
    for (const b of index.books) {
      expect(COTHE_BOOKS.some((x) => x.id === b.id), b.id).toBe(true);
      expect(problems.filter((p) => p.book === b.id).length).toBe(b.count);
    }
  });

  it('has unique ids that name their book', () => {
    expect(new Set(problems.map((p) => p.id)).size).toBe(problems.length);
    for (const p of problems) expect(bookOfId(p.id), p.id).toBe(p.book);
  });

  it('has a Vietnamese title for every problem', () => {
    for (const p of problems) expect(p.titleVi, `${p.id} ${p.title}`).not.toMatch(/[一-鿿]/);
  });

  it('starts from legal positions and every solution move is legal', () => {
    for (const p of problems) {
      const pos = new Position(p.fen);
      expect(pos.kings[RED] && pos.kings[BLACK], p.id).toBeTruthy();
      expect(pos.isInCheck((1 - pos.turn) as 0 | 1), p.id).toBe(false);
      // The opponent can only start if the line gives it a first move.
      if (pos.turn !== p.side) expect(p.moves.length, p.id).toBeGreaterThan(0);
      for (const m of p.moves) {
        expect(pos.isLegal(uciToMove(m)), `${p.id} ${m}`).toBe(true);
        pos.play(uciToMove(m));
      }
      expect(!pos.hasLegalMove(), p.id).toBe(p.mate);
      // A line that ends in mate is mate by the player in a win problem.
      if (p.mate && p.goal === 'win') expect(pos.turn, p.id).toBe(1 - p.side);
    }
  });

  it('counts the player moves of a line', () => {
    const p = parseRow(['x', 'stnt', 1, 't', 't', 1, 0, '4k4/9/9/9/9/9/9/9/9/R2K5 w', 'a0a8 e9f9 a8a9', 0, 9.6, 2]);
    expect(playerMoves(p)).toBe(2);
  });

  it('stores the difficulty the builder computes', () => {
    for (const p of problems) {
      expect(p.score, p.id).toBe(difficultyScore(p));
      expect(p.level, p.id).toBe(levelOf(p.score));
    }
  });
});

describe('difficulty', () => {
  const mate1 = { fen: '3k5/9/9/9/9/9/9/9/4R4/4K4 w', moves: ['e1d1'], side: 0 as const, goal: 'win' as const };
  const longer = { fen: '4k4/9/9/9/9/9/9/9/9/R2K5 w', moves: ['a0a8', 'e9f9', 'a8a9', 'f9f8', 'd0d1'], side: 0 as const, goal: 'win' as const };

  it('rates longer and quieter solutions as harder', () => {
    expect(difficultyScore(mate1)).toBeLessThan(difficultyScore(longer));
    expect(levelOf(difficultyScore(mate1))).toBe(1);
  });

  it('rates holding a draw as harder than the same line for a win', () => {
    expect(difficultyScore({ ...longer, goal: 'draw' })).toBeGreaterThan(difficultyScore(longer));
  });

  it('maps scores to the four levels', () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(LEVEL_THRESHOLDS[0])).toBe(1);
    expect(levelOf(LEVEL_THRESHOLDS[0] + 0.1)).toBe(2);
    expect(levelOf(LEVEL_THRESHOLDS[2] + 1)).toBe(4);
  });
});
