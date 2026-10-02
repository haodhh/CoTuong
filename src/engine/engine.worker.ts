import { Position, moveToUci, uciToMove } from '../core/xiangqi';
import type { EngineInfo, EngineRequest, EngineResponse } from './protocol';
import { Engine, isMateScore, mateIn, type SearchInfo } from './search';

const engine = new Engine();
// The project is typed with the DOM library; this is the part of the worker scope we use.
const ctx = self as unknown as { postMessage(message: unknown): void; onmessage: ((e: MessageEvent) => void) | null };

function toInfo(i: SearchInfo): EngineInfo {
  return {
    depth: i.depth,
    score: i.score,
    mate: isMateScore(i.score) ? mateIn(i.score) : undefined,
    pv: i.pv.map(moveToUci),
    nodes: i.nodes,
    timeMs: i.timeMs,
  };
}

ctx.onmessage = (e: MessageEvent<EngineRequest>) => {
  const req = e.data;
  const post = (r: EngineResponse) => ctx.postMessage(r);
  const pos = new Position(req.fen);
  for (const m of req.moves) pos.play(uciToMove(m));
  const result = engine.search(pos, {
    maxDepth: req.depth,
    timeMs: req.timeMs,
    scoreAllRoot: req.temperature !== undefined,
    onInfo: req.info ? (i) => post({ id: req.id, type: 'info', ...toInfo(i) }) : undefined,
  });
  let move = result.move;
  if (req.temperature !== undefined && result.rootScores.length > 0) {
    const best = result.rootScores[0].score;
    const weights = result.rootScores.map((r) => Math.exp((r.score - best) / req.temperature!));
    let t = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < weights.length; i++) {
      t -= weights[i];
      if (t <= 0) {
        move = result.rootScores[i].move;
        break;
      }
    }
  }
  post({ id: req.id, type: 'done', move: move ? moveToUci(move) : null, ...toInfo(result) });
};
