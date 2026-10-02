import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from 'ts-fsrs';

// A failed puzzle comes back after 10 minutes, then FSRS spaces it out.
const scheduler = fsrs(
  generatorParameters({
    learning_steps: ['10m'],
    relearning_steps: ['10m'],
    maximum_interval: 365,
    enable_fuzz: true,
  }),
);

export function gradeFor(success: boolean, timeMs: number): Grade {
  if (!success) return Rating.Again;
  return timeMs > 60_000 ? Rating.Hard : Rating.Good;
}

export function scheduleReview(card: Card | undefined, grade: Grade, now = new Date()): Card {
  return scheduler.next(card ?? createEmptyCard(now), now, grade).card;
}

/** Restores Date fields after a JSON round trip (backups). */
export function reviveCard(card: Card): Card {
  return {
    ...card,
    due: new Date(card.due),
    last_review: card.last_review ? new Date(card.last_review) : undefined,
  };
}
