// Plays every endgame drill with the engine on both sides, to check the attacker can win and to
// pick the "par" move counts in src/content/drills.ts.
//
//   npm run verify:drills -- [drill-id]

import { DRILLS } from '../src/content/drills';
import { gameStatus, type GameResult } from '../src/core/game';
import { Position } from '../src/core/xiangqi';
import { Engine } from '../src/engine/search';

const only = process.argv[2];
for (const d of DRILLS) {
  if (only && d.id !== only) continue;
  const pos = new Position(d.fen);
  const attacker = pos.turn;
  const engines = [new Engine(), new Engine()];
  let moves = 0;
  let result: GameResult | null = null;
  for (let ply = 0; ply < d.limit * 2 && !result; ply++) {
    const attacking = pos.turn === attacker;
    const r = engines[attacking ? 0 : 1].search(pos, { timeMs: attacking ? 1500 : 700 });
    pos.play(r.move);
    if (attacking) moves++;
    result = gameStatus(pos);
  }
  const won = result?.winner === attacker;
  console.log(`${d.id}: ${won ? `won in ${moves} moves (${result!.reason})` : 'NOT WON'} · par ${d.par} · limit ${d.limit}`);
}
