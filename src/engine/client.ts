import type { EngineInfo, EngineRequest, EngineResponse } from './protocol';
import { botLevel } from './levels';

export type { EngineInfo };

interface Pending {
  resolve: (r: { move: string | null } & EngineInfo) => void;
  reject: (e: Error) => void;
  onInfo?: (i: EngineInfo) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<EngineResponse>) => {
      const r = e.data;
      const p = pending.get(r.id);
      if (!p) return;
      if (r.type === 'info') p.onInfo?.(r);
      else {
        pending.delete(r.id);
        p.resolve(r);
      }
    };
    worker.onerror = (e) => {
      for (const p of pending.values()) p.reject(new Error(e.message || 'Lỗi engine'));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

/** Stops whatever the engine is doing (the worker is restarted on the next request). */
export function stopEngine() {
  if (!worker || pending.size === 0) return;
  worker.terminate();
  worker = null;
  for (const p of pending.values()) p.reject(new Error('cancelled'));
  pending.clear();
}

export function think(req: Omit<EngineRequest, 'id'>, onInfo?: (i: EngineInfo) => void) {
  // The engine is single-threaded: a new request replaces the previous one.
  if (pending.size > 0) stopEngine();
  const id = nextId++;
  return new Promise<{ move: string | null } & EngineInfo>((resolve, reject) => {
    pending.set(id, { resolve, reject, onInfo });
    getWorker().postMessage({ ...req, id, info: !!onInfo } satisfies EngineRequest);
  });
}

/** Asks the bot of the given level for a move. `ply` is the game's move count, for opening variety. */
export function botMove(fen: string, moves: string[], level: number, ply: number) {
  const l = botLevel(level);
  if (l.timeMs) {
    // Strong levels vary their first moves a little so games are not all identical.
    if (ply < 6) return think({ fen, moves, depth: 4, temperature: 12 });
    return think({ fen, moves, timeMs: l.timeMs });
  }
  return think({ fen, moves, depth: l.depth, temperature: l.temperature });
}
