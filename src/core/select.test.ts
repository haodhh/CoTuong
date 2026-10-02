import { describe, expect, it } from 'vitest';
import { bandsByDistance, choosePuzzle } from './select';
import type { Puzzle } from './puzzle';

const p = (id: string, rating: number, themes: string[] = []): Puzzle => ({ id, fen: '', moves: [], rating, themes });

describe('choosePuzzle', () => {
  const pool = [p('a', 1000, ['mateIn2']), p('b', 1210, ['mateIn3']), p('c', 1240, ['mateIn2']), p('d', 1600)];

  it('prefers puzzles within 50 points of the target', () => {
    for (let i = 0; i < 20; i++) {
      expect(['b', 'c']).toContain(choosePuzzle(pool, { target: 1220 })?.id);
    }
  });

  it('skips excluded puzzles and filters by theme', () => {
    expect(choosePuzzle(pool, { target: 1220, exclude: new Set(['b']) })?.id).toBe('c');
    expect(choosePuzzle(pool, { target: 1220, theme: 'mateIn2', exclude: new Set(['c']) })?.id).toBe('a');
    expect(choosePuzzle(pool, { target: 1220, theme: 'trungPhao' })).toBeUndefined();
  });

  it('falls back to the closest puzzles when none are near', () => {
    expect(choosePuzzle([p('x', 400), p('y', 900)], { target: 2000, rng: () => 0 })?.id).toBe('y');
  });
});

describe('bandsByDistance', () => {
  it('orders bands outward from the target', () => {
    expect(bandsByDistance([400, 500, 600, 700, 800], 640).slice(0, 3)).toEqual([600, 500, 700]);
  });
});
