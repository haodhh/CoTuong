import { describe, expect, it } from 'vitest';
import { Rating } from 'ts-fsrs';
import { gradeFor, reviveCard, scheduleReview } from './srs';

describe('srs', () => {
  const now = new Date('2026-01-01T10:00:00Z');
  const minutes = (d: Date) => (d.getTime() - now.getTime()) / 60_000;

  it('brings a failed puzzle back after ten minutes', () => {
    const card = scheduleReview(undefined, Rating.Again, now);
    expect(minutes(card.due)).toBeCloseTo(10, 0);
  });

  it('spaces out successful reviews', () => {
    let card = scheduleReview(undefined, Rating.Again, now);
    const t1 = new Date(now.getTime() + 11 * 60_000);
    card = scheduleReview(card, Rating.Good, t1);
    expect(card.due.getTime() - t1.getTime()).toBeGreaterThanOrEqual(24 * 3600_000 - 60_000);
    const t2 = card.due;
    const next = scheduleReview(card, Rating.Good, t2);
    expect(next.due.getTime() - t2.getTime()).toBeGreaterThan(card.due.getTime() - t1.getTime());
  });

  it('grades by success and time', () => {
    expect(gradeFor(false, 1000)).toBe(Rating.Again);
    expect(gradeFor(true, 5000)).toBe(Rating.Good);
    expect(gradeFor(true, 90_000)).toBe(Rating.Hard);
  });

  it('revives dates from JSON', () => {
    const card = scheduleReview(undefined, Rating.Again, now);
    const revived = reviveCard(JSON.parse(JSON.stringify(card)));
    expect(revived.due).toBeInstanceOf(Date);
    expect(revived.due.getTime()).toBe(card.due.getTime());
  });
});
