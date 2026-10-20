// Fills in solutions for problems that come without one (the QP files of 绝对精妙杀局4000局 only
// store the position). For each JSON line with an empty "main", searches for the shortest forced
// mate for the side to move — checks only, or a quiet first move followed by checks — and writes
// the line with the most stubborn defence. Lines that cannot be solved keep an empty "main".
//
//   npx tsx scripts/solve-mates.ts in.jsonl out.jsonl [--shard i/n]

import { readFileSync, writeFileSync } from 'node:fs';
import { MateSolver } from '../src/core/mate';
import { Position, moveToUci } from '../src/core/xiangqi';

const MAX_CHECKS = 9;
const MAX_QUIET = 4;
const TIME_LIMIT_MS = 30_000;

export function solveMate(fen: string): string[] | null {
  const pos = new Position(fen);
  const solver = new MateSolver(pos);
  const started = Date.now();
  let n = 0;
  let quiet = false;
  for (let k = 1; k <= MAX_CHECKS && Date.now() - started < TIME_LIMIT_MS; k++) {
    if (solver.canMate(k)) {
      n = k;
      break;
    }
    if (k <= MAX_QUIET && solver.winningMoves(k, true).length > 0) {
      n = k;
      quiet = true;
      break;
    }
  }
  if (!n) return null;
  const first = solver.winningMoves(n, quiet);
  if (first.length === 0) return null;
  const line = [first[0]];
  pos.play(first[0]);
  let used = 1;
  for (;;) {
    const def = solver.bestDefence(n - used);
    if (!def) break;
    if (def.remaining > n - used) return null;
    pos.play(def.move);
    line.push(def.move);
    const next = solver.winningMoves(def.remaining)[0];
    if (!next) return null;
    pos.play(next);
    line.push(next);
    used++;
  }
  return pos.hasLegalMove() ? null : line.map(moveToUci);
}

const [input, output] = process.argv.slice(2);
const shardArg = process.argv.indexOf('--shard');
const [shard, shards] = shardArg >= 0 ? process.argv[shardArg + 1].split('/').map(Number) : [0, 1];
const rows = readFileSync(input, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const out: string[] = [];
let solved = 0;
rows.forEach((r, i) => {
  if (i % shards !== shard) return;
  if (r.fen && (!r.main || r.main.length === 0)) {
    try {
      const line = solveMate(r.fen);
      if (line) {
        r.main = line;
        r.solved = true;
        solved++;
      }
    } catch {
      // Positions our rules reject are dropped later by the builder.
    }
  }
  out.push(JSON.stringify(r));
});
writeFileSync(output, out.join('\n') + '\n');
console.error(`shard ${shard}/${shards}: solved ${solved} of ${out.length}`);
