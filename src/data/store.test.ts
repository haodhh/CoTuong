import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normalizeProfile } from './store';

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
