import { describe, expect, it } from 'vitest';
import { attemptsToday, ratingHistory, streakDays, themeStats, weakestThemes } from './stats';

const day = 24 * 3600_000;
const now = new Date('2026-03-10T12:00:00').getTime();
const a = (offsetDays: number, success = true, themes: string[] = [], ratingAfter?: number, ratingBefore?: number) => ({
  ts: now - offsetDays * day,
  success,
  themes,
  ratingAfter,
  ratingBefore,
});

describe('stats', () => {
  it('counts a streak ending today or yesterday', () => {
    expect(streakDays([a(0), a(1), a(2), a(4)], now)).toBe(3);
    expect(streakDays([a(1), a(2)], now)).toBe(2);
    expect(streakDays([a(2)], now)).toBe(0);
    expect(streakDays([], now)).toBe(0);
  });

  it('filters attempts made today', () => {
    expect(attemptsToday([a(0), a(0), a(1)], now)).toHaveLength(2);
  });

  it('finds the weakest skill themes', () => {
    const attempts = [
      ...Array.from({ length: 6 }, (_, i) => a(0, i < 1, ['sacrifice', 'endgame'])),
      ...Array.from({ length: 6 }, (_, i) => a(0, i < 5, ['maHauPhao'])),
      ...Array.from({ length: 2 }, () => a(0, false, ['skewer'])),
    ];
    const stats = themeStats(attempts);
    expect(stats.find((s) => s.theme === 'sacrifice')).toMatchObject({ attempts: 6, solved: 1 });
    expect(weakestThemes(stats).map((s) => s.theme)).toEqual(['sacrifice', 'maHauPhao']);
  });

  it('builds a sorted rating history starting from the initial rating', () => {
    expect(ratingHistory([a(0, true, [], 1520, 1500), a(2, true, [], 1500, 1450), a(1)])).toEqual([
      { ts: now - 2 * day, rating: 1450 },
      { ts: now - 2 * day, rating: 1500 },
      { ts: now, rating: 1520 },
    ]);
  });
});
