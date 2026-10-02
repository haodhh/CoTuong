import { NON_SKILL_THEMES } from './themes';

export interface AttemptLike {
  ts: number;
  success: boolean;
  themes: string[];
  ratingBefore?: number;
  ratingAfter?: number;
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Consecutive days with at least one attempt, ending today (or yesterday if nothing yet today). */
export function streakDays(attempts: AttemptLike[], now = Date.now()): number {
  const days = new Set(attempts.map((a) => dayKey(a.ts)));
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function attemptsToday(attempts: AttemptLike[], now = Date.now()): AttemptLike[] {
  const today = dayKey(now);
  return attempts.filter((a) => dayKey(a.ts) === today);
}

export interface ThemeStat {
  theme: string;
  attempts: number;
  solved: number;
  rate: number;
}

export function themeStats(attempts: AttemptLike[]): ThemeStat[] {
  const map = new Map<string, ThemeStat>();
  for (const a of attempts) {
    for (const theme of a.themes) {
      let s = map.get(theme);
      if (!s) map.set(theme, (s = { theme, attempts: 0, solved: 0, rate: 0 }));
      s.attempts++;
      if (a.success) s.solved++;
    }
  }
  for (const s of map.values()) s.rate = s.solved / s.attempts;
  return [...map.values()].sort((a, b) => b.attempts - a.attempts);
}

/** Skill themes with the lowest success rate, among those tried at least `minAttempts` times. */
export function weakestThemes(stats: ThemeStat[], count = 3, minAttempts = 5): ThemeStat[] {
  return stats
    .filter((s) => s.attempts >= minAttempts && !NON_SKILL_THEMES.has(s.theme))
    .sort((a, b) => a.rate - b.rate || b.attempts - a.attempts)
    .slice(0, count);
}

/** Rating after each rated attempt, starting with the rating before the first one. */
export function ratingHistory(attempts: AttemptLike[]): { ts: number; rating: number }[] {
  const rated = attempts.filter((a) => a.ratingAfter !== undefined).sort((a, b) => a.ts - b.ts);
  const points = rated.map((a) => ({ ts: a.ts, rating: a.ratingAfter! }));
  if (rated.length > 0 && rated[0].ratingBefore !== undefined) {
    points.unshift({ ts: rated[0].ts, rating: rated[0].ratingBefore });
  }
  return points;
}
