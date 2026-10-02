import { describe, expect, it } from 'vitest';
import { decayRd, updateGlicko, updateGlickoPeriod } from './glicko2';

describe('glicko2', () => {
  it('matches the worked example from Glickman (2012)', () => {
    const r = updateGlickoPeriod({ rating: 1500, rd: 200, vol: 0.06 }, [
      { rating: 1400, rd: 30, score: 1 },
      { rating: 1550, rd: 100, score: 0 },
      { rating: 1700, rd: 300, score: 0 },
    ]);
    expect(r.rating).toBeCloseTo(1464.06, 1);
    expect(r.rd).toBeCloseTo(151.52, 1);
    expect(r.vol).toBeCloseTo(0.05999, 4);
  });

  it('gains rating for a win and loses for a loss', () => {
    const p = { rating: 1500, rd: 100, vol: 0.06 };
    const win = updateGlicko(p, { rating: 1500, rd: 80 }, 1);
    const loss = updateGlicko(p, { rating: 1500, rd: 80 }, 0);
    expect(win.rating).toBeGreaterThan(1500);
    expect(loss.rating).toBeLessThan(1500);
    expect(win.rating - 1500).toBeCloseTo(1500 - loss.rating, 5);
    expect(win.rd).toBeLessThan(100);
  });

  it('beating a much weaker puzzle gains little', () => {
    const p = { rating: 2000, rd: 60, vol: 0.06 };
    const r = updateGlicko(p, { rating: 1000, rd: 80 }, 1);
    expect(r.rating - 2000).toBeLessThan(1);
  });

  it('grows deviation with inactivity, capped at 350', () => {
    const p = { rating: 1500, rd: 60, vol: 0.06 };
    expect(decayRd(p, 0).rd).toBe(60);
    expect(decayRd(p, 30).rd).toBeGreaterThan(60);
    expect(decayRd(p, 100000).rd).toBe(350);
  });
});
