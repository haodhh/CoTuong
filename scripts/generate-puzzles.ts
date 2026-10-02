// Generates xiangqi mate puzzles from engine self-play games.
//
// Weakened engines play each other; at every position we look for a forced mate (every attacker
// move a check, up to 5 moves) created by the move just played, and also try a few plausible
// "blunders" that look fine at a shallow depth. A puzzle is kept when its first move is the only
// winning move. Results are tagged with themes, given an estimated rating and written as rating
// shards to public/data/puzzles/.
//
//   npm run build:puzzles -- --minutes 30 --workers 4 --per-band 300

import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { MateSolver } from '../src/core/mate';
import { analyzePuzzle } from '../src/core/puzzleThemes';
import { hashString } from '../src/core/select';
import { THEMES } from '../src/core/themes';
import { Position, moveToUci } from '../src/core/xiangqi';
import { Engine, isMateScore } from '../src/engine/search';

const MAX_N = 5;
const BAND = 100;

interface RawPuzzle {
  fen: string;
  moves: string[];
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Builds a puzzle if the side to move has a forced mate with a unique first move. */
export function findPuzzle(pos: Position): RawPuzzle | null {
  const setup = pos.lastMove;
  if (!setup) return null;
  const solver = new MateSolver(pos);
  const n = solver.mateLength(MAX_N);
  if (!n) return null;
  const wins = solver.winningMoves(n, true);
  if (wins.length !== 1) return null;

  const line = [wins[0]];
  pos.play(wins[0]);
  let used = 1;
  let ok = true;
  for (;;) {
    const def = solver.bestDefence(n - used);
    if (!def) break;
    if (def.remaining > n - used) {
      ok = false;
      break;
    }
    pos.play(def.move);
    line.push(def.move);
    const next = solver.winningMoves(def.remaining)[0];
    if (!next) {
      ok = false;
      break;
    }
    pos.play(next);
    line.push(next);
    used++;
  }
  for (let i = 0; i < line.length; i++) pos.undo();
  if (!ok || line.length !== 2 * n - 1) return null;

  pos.undo();
  const fen = pos.fen();
  pos.play(setup);
  return { fen, moves: [setup, ...line].map(moveToUci) };
}

function runWorker(seed: number, deadline: number) {
  const rng = makeRng(seed);
  const engine = new Engine();
  const emit = (p: RawPuzzle) => process.stdout.write(JSON.stringify(p) + '\n');

  const choose = (pos: Position, depth: number, temperature: number) => {
    const r = engine.search(pos, { maxDepth: depth, scoreAllRoot: true });
    const best = r.rootScores[0].score;
    const weights = r.rootScores.map((s) => Math.exp((s.score - best) / temperature));
    let t = rng() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < weights.length; i++) {
      t -= weights[i];
      if (t <= 0) return r.rootScores[i].move;
    }
    return r.move;
  };

  while (Date.now() < deadline) {
    const pos = new Position();
    const temps = [0, 1].map(() => [8, 20, 40, 80][Math.floor(rng() * 4)]);
    const depths = [0, 1].map(() => (rng() < 0.3 ? 3 : 2));
    const opening = 4 + Math.floor(rng() * 8);
    let lastPuzzle = -10;
    for (let ply = 0; ply < 240 && Date.now() < deadline; ply++) {
      if (!pos.hasLegalMove() || pos.halfmove >= 120 || pos.repetitionCount() >= 2) break;
      if (ply >= 10 && ply - lastPuzzle >= 4) {
        const real = findPuzzle(pos);
        if (real) {
          emit(real);
          lastPuzzle = ply;
        } else if (rng() < 0.6) {
          // A plausible blunder: a move that looks fine one ply deep.
          const shallow = engine.search(pos, { maxDepth: 1, scoreAllRoot: true }).rootScores;
          const best = shallow[0].score;
          const candidates = shallow.filter((s) => s.score >= best - 120 && !isMateScore(s.score));
          for (let i = 0; i < 6 && candidates.length > 0; i++) {
            const [c] = candidates.splice(Math.floor(rng() * candidates.length), 1);
            pos.play(c.move);
            const p = findPuzzle(pos);
            pos.undo();
            if (p) {
              emit(p);
              lastPuzzle = ply;
              break;
            }
          }
        }
      }
      const side = pos.turn;
      const move = ply < opening ? choose(pos, 1, 60) : choose(pos, depths[side], temps[side]);
      pos.play(move);
    }
  }
}

async function main() {
  const minutes = Number(arg('minutes', '20'));
  const workers = Number(arg('workers', String(cpus().length)));
  const perBand = Number(arg('per-band', '300'));
  const deadline = Date.now() + minutes * 60_000;
  const raw = new Map<string, RawPuzzle>();
  console.error(`Generating for ${minutes} min with ${workers} workers…`);

  await Promise.all(
    Array.from({ length: workers }, (_, i) => {
      const child = spawn(
        process.execPath,
        [...process.execArgv, fileURLToPath(import.meta.url), '--worker', String(Date.now() + i * 7919), String(deadline)],
        { stdio: ['ignore', 'pipe', 'inherit'] },
      );
      createInterface({ input: child.stdout }).on('line', (line) => {
        const p = JSON.parse(line) as RawPuzzle;
        const key = p.fen.split(' ').slice(0, 2).join(' ') + p.moves[0];
        if (!raw.has(key)) raw.set(key, p);
      });
      return new Promise((resolve) => child.on('close', resolve));
    }),
  );
  console.error(`Found ${raw.size} unique puzzles.`);

  const themeIds = Object.keys(THEMES);
  const bands = new Map<number, [string, string, string, number, number[]][]>();
  const usedIds = new Set<string>();
  for (const p of raw.values()) {
    const { themes, rating } = analyzePuzzle(p);
    let id = (hashString(p.fen + p.moves.join(' ')) >>> 0).toString(36).padStart(6, '0').slice(0, 6);
    while (usedIds.has(id)) id = (hashString(id + 'x') >>> 0).toString(36).slice(0, 6);
    usedIds.add(id);
    const band = Math.floor(rating / BAND) * BAND;
    if (!bands.has(band)) bands.set(band, []);
    bands.get(band)!.push([id, p.fen, p.moves.join(' '), rating, themes.map((t) => themeIds.indexOf(t))]);
  }

  const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'puzzles');
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(outDir)) rmSync(join(outDir, f));
  const index = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'Sinh tự động từ các ván máy tự đấu (scripts/generate-puzzles.ts)',
    bandSize: BAND,
    total: 0,
    bands: [] as { band: number; count: number; file: string }[],
    themes: themeIds,
    themeCounts: {} as Record<string, number>,
  };
  for (const band of [...bands.keys()].sort((a, b) => a - b)) {
    const rows = bands
      .get(band)!
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, perBand);
    const file = `r${String(band).padStart(4, '0')}.json`;
    writeFileSync(join(outDir, file), JSON.stringify({ band, puzzles: rows }));
    index.bands.push({ band, count: rows.length, file });
    index.total += rows.length;
    for (const r of rows) for (const t of r[4]) index.themeCounts[themeIds[t]] = (index.themeCounts[themeIds[t]] ?? 0) + 1;
  }
  writeFileSync(join(outDir, 'index.json'), JSON.stringify(index, null, 1));
  console.error(`Wrote ${index.total} puzzles in ${index.bands.length} bands.`);
  console.error(JSON.stringify(index.themeCounts));
}

if (process.argv.includes('--worker')) {
  const i = process.argv.indexOf('--worker');
  runWorker(Number(process.argv[i + 1]), Number(process.argv[i + 2]));
} else {
  void main();
}
