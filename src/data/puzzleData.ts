import type { Puzzle } from '../core/puzzle';
import { bandsByDistance, choosePuzzle, hashString, type SelectOptions } from '../core/select';

export interface PuzzleIndex {
  total: number;
  bandSize: number;
  bands: { band: number; count: number; file: string }[];
  themes: string[];
  themeCounts: Record<string, number>;
}

type Row = [id: string, fen: string, moves: string, rating: number, themes: number[]];

const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/puzzles/${file}`;

let indexPromise: Promise<PuzzleIndex> | undefined;
const bandCache = new Map<number, Promise<Puzzle[]>>();

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được ${url} (${res.status})`);
  return res.json() as Promise<T>;
}

export function loadIndex(): Promise<PuzzleIndex> {
  indexPromise ??= fetchJson<PuzzleIndex>(dataUrl('index.json')).catch((e) => {
    indexPromise = undefined;
    throw e;
  });
  return indexPromise;
}

export async function loadBand(band: number): Promise<Puzzle[]> {
  let cached = bandCache.get(band);
  if (!cached) {
    cached = (async () => {
      const index = await loadIndex();
      const meta = index.bands.find((b) => b.band === band);
      if (!meta) return [];
      const shard = await fetchJson<{ puzzles: Row[] }>(dataUrl(meta.file));
      return shard.puzzles.map(([id, fen, moves, rating, themes]) => ({
        id,
        fen,
        moves: moves.split(' '),
        rating,
        themes: themes.map((t) => index.themes[t]),
      }));
    })();
    cached.catch(() => bandCache.delete(band));
    bandCache.set(band, cached);
  }
  return cached;
}

/**
 * Finds a puzzle near the target rating, searching outward through the rating bands.
 * If every matching puzzle has been excluded, exclusions are ignored.
 */
export async function findPuzzle(opts: SelectOptions & { maxDistance?: number }): Promise<Puzzle | undefined> {
  const index = await loadIndex();
  const maxDistance = opts.maxDistance ?? Infinity;
  const bands = bandsByDistance(
    index.bands.map((b) => b.band),
    opts.target,
  ).filter((b) => Math.abs(b + 50 - opts.target) <= maxDistance + 50);
  for (const withExclusions of [true, false]) {
    for (const band of bands) {
      const found = choosePuzzle(await loadBand(band), withExclusions ? opts : { ...opts, exclude: undefined });
      if (found) return found;
    }
  }
  return undefined;
}

/** The same puzzle for everyone on a given day, rated around 1500. */
export async function dailyPuzzle(date: string): Promise<Puzzle | undefined> {
  const h = hashString(date);
  const index = await loadIndex();
  const bands = index.bands.map((b) => b.band).filter((b) => b >= 1200 && b <= 1800);
  if (bands.length === 0) return undefined;
  const puzzles = await loadBand(bands[h % bands.length]);
  return puzzles[(h >>> 8) % puzzles.length];
}
