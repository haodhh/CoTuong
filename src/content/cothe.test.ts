import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseRow, playerMoves } from '../data/cotheData';
import { BLACK, Position, RED, uciToMove } from '../core/xiangqi';
import { COTHE_BOOKS } from './cotheBooks';

const data = JSON.parse(readFileSync(new URL('../../public/data/cothe.json', import.meta.url), 'utf8'));
const problems = data.entries.map(parseRow);

describe('cờ thế data', () => {
  it('has unique ids from known books', () => {
    expect(problems.length).toBeGreaterThan(900);
    expect(new Set(problems.map((p: { id: string }) => p.id)).size).toBe(problems.length);
    const books = new Set(COTHE_BOOKS.map((b) => b.id));
    for (const p of problems) expect(books.has(p.book), p.id).toBe(true);
  });

  it('has a Vietnamese title for every problem', () => {
    for (const p of problems) expect(p.titleVi, p.title).not.toMatch(/[一-鿿]/);
  });

  it('starts from legal positions and the book lines are legal', () => {
    for (const p of problems) {
      const pos = new Position(p.fen);
      expect(pos.kings[RED] && pos.kings[BLACK], p.id).toBeTruthy();
      expect(pos.isInCheck((1 - pos.turn) as 0 | 1), p.id).toBe(false);
      for (const m of p.moves) {
        expect(pos.isLegal(uciToMove(m)), `${p.id} ${m}`).toBe(true);
        pos.play(uciToMove(m));
      }
      expect(!pos.hasLegalMove(), p.id).toBe(p.mate);
    }
  });

  it('counts the player moves of a line', () => {
    const p = parseRow(['x', 'stnt', 1, 't', 't', 1, 0, '4k4/9/9/9/9/9/9/9/9/R2K5 w', 'a0a8 e9f9 a8a9', 0]);
    expect(playerMoves(p)).toBe(2);
  });
});
