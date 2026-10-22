import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, addCoTheResult, normalizeProfile, normalizeSettings } from './store';

describe('normalizeProfile', () => {
  it('fills a missing or malformed rating and settings from defaults', () => {
    const p = normalizeProfile({ onboarded: true } as never);
    expect(p.rating.rating).toBeGreaterThan(0);
    expect(Number.isFinite(p.ratedAt)).toBe(true);
    expect(p.settings).toEqual(DEFAULT_SETTINGS);
    expect(p.onboarded).toBe(true);
    const bad = normalizeProfile({ rating: { rating: 'x' }, settings: { sound: false } } as never);
    expect(typeof bad.rating.rating).toBe('number');
    expect(bad.settings.sound).toBe(false);
    expect(bad.settings.boardTheme).toBe(DEFAULT_SETTINGS.boardTheme);
  });

  it('keeps a valid profile', () => {
    const rating = { rating: 1500, rd: 80, vol: 0.06 };
    const p = normalizeProfile({ id: 'me', rating, ratedAt: 5, createdAt: 1, onboarded: true, settings: DEFAULT_SETTINGS });
    expect(p.rating).toEqual(rating);
    expect(p.ratedAt).toBe(5);
  });
});

describe('normalizeSettings', () => {
  it('replaces unknown or malformed values with defaults', () => {
    const s = normalizeSettings({ boardTheme: 'neon', pieceStyle: 'emoji', dailyGoal: 'x', sound: 'yes', difficulty: 300 } as never);
    expect(s).toEqual({ ...DEFAULT_SETTINGS, difficulty: 300 });
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values', () => {
    const s = { boardTheme: 'dark', pieceStyle: 'viet', sound: false, coordinates: false, animation: false, difficulty: -300, dailyGoal: 50 } as const;
    expect(normalizeSettings(s)).toEqual(s);
  });
});

describe('addCoTheResult', () => {
  it('counts wins and losses and keeps the best result', () => {
    let r = addCoTheResult(undefined, 'cothe:x', false, 0, 9, 1);
    expect(r).toMatchObject({ stars: 0, wins: 0, losses: 1, bestMoves: 0 });
    r = addCoTheResult(r, 'cothe:x', true, 2, 11, 2);
    expect(r).toMatchObject({ stars: 2, wins: 1, losses: 1, bestMoves: 11 });
    r = addCoTheResult(r, 'cothe:x', true, 1, 7, 3);
    expect(r).toMatchObject({ stars: 2, wins: 2, losses: 1, bestMoves: 7 });
    r = addCoTheResult(r, 'cothe:x', false, 0, 3, 4);
    expect(r).toMatchObject({ stars: 2, wins: 2, losses: 2, bestMoves: 7, ts: 4 });
  });

  it('counts a problem solved before the counts existed as one win', () => {
    const old = { drillId: 'cothe:x', stars: 3, bestMoves: 5, ts: 1 };
    expect(addCoTheResult(old, 'cothe:x', false, 0, 9, 2)).toMatchObject({ stars: 3, wins: 1, losses: 1, bestMoves: 5 });
  });
});
