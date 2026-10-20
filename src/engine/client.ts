import type { EngineInfo, EngineRequest, EngineResponse } from './protocol';
import { botLevel } from './levels';

export type { EngineInfo };

export type EngineResult = { move: string | null } & EngineInfo;

/** A request to the engine: a promise plus the id used to cancel exactly this request. */
export type EngineRequestHandle = Promise<EngineResult> & { id: number };

/** Rejection reason when a request was cancelled on purpose (not a failure to show the user). */
export class EngineCancelled extends Error {
  constructor() {
    super('cancelled');
  }
}

interface Pending {
  resolve: (r: EngineResult) => void;
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
      // A worker that cannot load (offline, or its file was replaced by a new deploy) gives an
      // event without a message.
      const message = e.message || 'Không tải được máy cờ. Hãy kiểm tra mạng hoặc tải lại trang.';
      for (const p of pending.values()) p.reject(new Error(message));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

/**
 * Stops the engine. With an id, only if that request is still the one running, so a component
 * never cancels work it did not start.
 */
export function stopEngine(id?: number) {
  if (!worker || pending.size === 0) return;
  if (id !== undefined && !pending.has(id)) return;
  worker.terminate();
  worker = null;
  for (const p of pending.values()) p.reject(new EngineCancelled());
  pending.clear();
}

export function think(req: Omit<EngineRequest, 'id'>, onInfo?: (i: EngineInfo) => void): EngineRequestHandle {
  // The engine is single-threaded: a new request replaces the previous one.
  if (pending.size > 0) stopEngine();
  const id = nextId++;
  const promise = new Promise<EngineResult>((resolve, reject) => {
    pending.set(id, { resolve, reject, onInfo });
    try {
      getWorker().postMessage({ ...req, id, info: !!onInfo } satisfies EngineRequest);
    } catch (e) {
      pending.delete(id);
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
  return Object.assign(promise, { id });
}

/** Asks the bot of the given level for a move. `ply` is the game's move count, for opening variety. */
export function botMove(fen: string, moves: string[], level: number, ply: number): EngineRequestHandle {
  const l = botLevel(level);
  if (l.timeMs) {
    // Strong levels vary their first moves a little so games are not all identical.
    if (ply < 6) return think({ fen, moves, depth: 4, temperature: 12 });
    return think({ fen, moves, timeMs: l.timeMs });
  }
  return think({ fen, moves, depth: l.depth, temperature: l.temperature });
}
