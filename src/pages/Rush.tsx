import { useEffect, useRef, useState } from 'react';
import { PuzzlePlayer, type PuzzleOutcome } from '../components/PuzzlePlayer';
import type { Puzzle } from '../core/puzzle';
import { playSound } from '../core/sound';
import type { RushMode } from '../data/db';
import { findPuzzle } from '../data/puzzleData';
import { attemptedIds, recordAttempt, saveRushRun, useProfile, useRushBest } from '../data/store';

const MODES: Record<RushMode, { label: string; icon: string; seconds: number | null; desc: string }> = {
  '3m': { label: '3 phút', icon: '⚡', seconds: 180, desc: 'Giải càng nhiều càng tốt trong 3 phút.' },
  '5m': { label: '5 phút', icon: '⏱', seconds: 300, desc: 'Giải càng nhiều càng tốt trong 5 phút.' },
  survival: { label: 'Sống sót', icon: '❤️', seconds: null, desc: 'Không giới hạn thời gian, chỉ có 3 mạng.' },
};
const MAX_STRIKES = 3;
const targetFor = (i: number) => Math.min(2400, 600 + i * 50);

interface LogEntry {
  puzzle: Puzzle;
  success: boolean;
}

export function Rush() {
  const [mode, setMode] = useState<RushMode | null>(null);
  const [runId, setRunId] = useState(0);
  const best = useRushBest();

  if (mode) {
    return (
      <RushRun
        key={runId}
        mode={mode}
        previousBest={best?.[mode] ?? 0}
        onRestart={() => setRunId((r) => r + 1)}
        onExit={() => setMode(null)}
      />
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">Puzzle Rush</h1>
      <p className="mb-5 text-muted">
        Puzzle bắt đầu rất dễ và khó dần. Sai {MAX_STRIKES} lần là kết thúc. Luyện phản xạ nhìn thế sát nhanh.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(MODES) as RushMode[]).map((m) => (
          <button
            key={m}
            className="card text-left transition-colors hover:bg-panel-2"
            onClick={() => {
              setMode(m);
              setRunId((r) => r + 1);
            }}
          >
            <div className="text-3xl">{MODES[m].icon}</div>
            <div className="mt-2 text-xl font-bold">{MODES[m].label}</div>
            <div className="text-sm text-muted">{MODES[m].desc}</div>
            <div className="mt-3 text-sm">
              Kỷ lục: <b className="text-accent">{best?.[m] ?? 0}</b>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function RushRun({
  mode,
  previousBest,
  onRestart,
  onExit,
}: {
  mode: RushMode;
  previousBest: number;
  onRestart: () => void;
  onExit: () => void;
}) {
  const profile = useProfile();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endsAt] = useState(() => (MODES[mode].seconds ? Date.now() + MODES[mode].seconds! * 1000 : null));
  // The best score before this run; the live value includes this run once it is saved.
  const [bestBefore] = useState(previousBest);
  const queue = useRef<Promise<Puzzle | undefined>[]>([]);
  const used = useRef<Set<string>>(new Set());
  const index = useRef(0);
  const logRef = useRef<LogEntry[]>([]);
  const finished = useRef(false);

  const seen = useRef<Promise<Set<string>> | null>(null);

  const fetchAt = (i: number) => {
    queue.current[i] ??= (async () => {
      seen.current ??= attemptedIds();
      const exclude = new Set([...(await seen.current), ...used.current]);
      const p = await findPuzzle({ target: targetFor(i), exclude });
      if (p) used.current.add(p.id);
      return p;
    })();
    return queue.current[i];
  };

  const show = async (i: number) => {
    try {
      const p = await fetchAt(i);
      void fetchAt(i + 1);
      if (!p) throw new Error('Hết puzzle phù hợp.');
      if (!finished.current) setPuzzle(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void show(0);
  }, []);

  const end = () => {
    if (finished.current) return;
    finished.current = true;
    setOver(true);
    const entries = logRef.current;
    void saveRushRun({
      mode,
      score: entries.filter((e) => e.success).length,
      ts: Date.now(),
      puzzles: entries.map((e) => ({ id: e.puzzle.id, rating: e.puzzle.rating, success: e.success })),
    });
  };

  const onResult = (outcome: PuzzleOutcome) => {
    if (!puzzle || finished.current) return;
    logRef.current = [...logRef.current, { puzzle, success: outcome.success }];
    setLog(logRef.current);
    void recordAttempt({ puzzle, mode: 'rush', ...outcome, rated: false });
  };

  const onFinished = () => {
    if (finished.current) return;
    const strikes = logRef.current.filter((e) => !e.success).length;
    if (strikes >= MAX_STRIKES) {
      end();
      return;
    }
    index.current++;
    void show(index.current);
  };

  const score = log.filter((e) => e.success).length;
  const strikes = log.filter((e) => !e.success).length;

  if (over) {
    const record = score > bestBefore;
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card mb-4 text-center">
          <div className="text-muted">{MODES[mode].label} · Kết thúc</div>
          <div className="my-2 text-6xl font-extrabold">{score}</div>
          {record ? (
            <div className="font-bold text-warn">🏆 Kỷ lục mới!</div>
          ) : (
            <div className="text-muted">Kỷ lục: {bestBefore}</div>
          )}
          <div className="mt-4 flex justify-center gap-2">
            <button className="btn btn-primary" onClick={onRestart}>
              Chơi lại
            </button>
            <button className="btn" onClick={onExit}>
              Chọn chế độ khác
            </button>
          </div>
        </div>
        <div className="card">
          <div className="mb-2 font-semibold">Các puzzle đã gặp</div>
          <p className="mb-3 text-xs text-muted">Bài sai đã được thêm vào mục Ôn lỗi.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {log.map((e, i) => (
              <div key={e.puzzle.id} className={`rounded-lg px-3 py-2 text-sm ${e.success ? 'bg-good/20' : 'bg-bad/20'}`}>
                <span className="font-bold">{i + 1}.</span> {e.success ? '✓' : '✗'} {e.puzzle.rating}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) return <div className="card text-bad">{error}</div>;
  if (!profile || !puzzle) return <div className="text-muted">Đang chuẩn bị puzzle…</div>;

  const header = (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted">Điểm</div>
          <div className="text-5xl font-extrabold">{score}</div>
        </div>
        {endsAt ? <RushClock endsAt={endsAt} onTimeout={end} /> : <div className="text-4xl">❤️</div>}
      </div>
      <div className="mt-3 flex gap-2">
        {Array.from({ length: MAX_STRIKES }, (_, i) => (
          <span
            key={i}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg font-bold ${i < strikes ? 'bg-bad text-white' : 'bg-white/10 text-white/30'}`}
          >
            ✗
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {log.map((e, i) => (
          <span key={i} className={`h-2 w-4 rounded-full ${e.success ? 'bg-good' : 'bg-bad'}`} />
        ))}
      </div>
      <button className="btn btn-sm mt-3" onClick={end}>
        Dừng
      </button>
    </div>
  );

  return (
    <PuzzlePlayer
      key={puzzle.id}
      puzzle={puzzle}
      settings={profile.settings}
      rush
      onResult={onResult}
      onFinished={onFinished}
      header={header}
    />
  );
}

function RushClock({ endsAt, onTimeout }: { endsAt: number; onTimeout: () => void }) {
  const [left, setLeft] = useState(endsAt - Date.now());
  const timeout = useRef(onTimeout);
  timeout.current = onTimeout;
  useEffect(() => {
    const id = window.setInterval(() => {
      const ms = endsAt - Date.now();
      setLeft(ms);
      if (ms <= 10_000 && ms > 0 && Math.ceil(ms / 1000) !== Math.ceil((ms + 250) / 1000)) playSound('tick');
      if (ms <= 0) {
        clearInterval(id);
        timeout.current();
      }
    }, 250);
    return () => clearInterval(id);
  }, [endsAt]);
  const s = Math.max(0, Math.ceil(left / 1000));
  return (
    <div className={`font-mono text-4xl font-bold tabular-nums ${s <= 10 ? 'text-bad' : ''}`}>
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
    </div>
  );
}
