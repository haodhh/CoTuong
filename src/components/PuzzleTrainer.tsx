import { useCallback, useEffect, useRef, useState } from 'react';
import { isProvisional } from '../core/glicko2';
import type { Puzzle } from '../core/puzzle';
import { themeName } from '../core/themes';
import type { PuzzleMode } from '../data/db';
import { findPuzzle } from '../data/puzzleData';
import { attemptedIds, currentRating, recordAttempt, updateSettings, useProfile } from '../data/store';
import { Onboarding } from './Onboarding';
import { PuzzlePlayer, type PuzzleOutcome } from './PuzzlePlayer';

const DIFFICULTIES = [
  { value: -300, label: 'Dễ' },
  { value: 0, label: 'Vừa' },
  { value: 300, label: 'Khó' },
];

interface Result {
  success: boolean;
  delta?: number;
}

/** Endless rated puzzles around the player's rating, optionally limited to one theme. */
export function PuzzleTrainer({ mode, theme }: { mode: PuzzleMode; theme?: string }) {
  const profile = useProfile();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const seen = useRef<Set<string> | null>(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const loadNext = useCallback(async () => {
    const p = profileRef.current;
    if (!p) return;
    try {
      setError(null);
      seen.current ??= await attemptedIds();
      const target = currentRating(p).rating + p.settings.difficulty;
      const next = await findPuzzle({ target, exclude: seen.current, theme });
      if (!next) throw new Error('Không tìm thấy puzzle phù hợp.');
      seen.current.add(next.id);
      setPuzzle(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [theme]);

  const ready = profile?.onboarded;
  useEffect(() => {
    if (ready) void loadNext();
  }, [ready, loadNext]);

  if (!profile) return null;
  if (!profile.onboarded) return <Onboarding />;

  const onResult = async (outcome: PuzzleOutcome) => {
    if (!puzzle) return;
    const r = await recordAttempt({ puzzle, mode, ...outcome, rated: true });
    const delta = r.ratingAfter !== undefined && r.ratingBefore !== undefined ? r.ratingAfter - r.ratingBefore : undefined;
    setResults((rs) => [...rs, { success: outcome.success && !outcome.usedHint, delta }]);
  };

  const rating = currentRating(profile);
  const last = results[results.length - 1];
  const solved = results.filter((r) => r.success).length;

  const header = (
    <div className="card">
      {theme && (
        <div className="mb-2 text-sm text-muted">
          Chủ đề: <b className="text-white">{themeName(theme)}</b>
        </div>
      )}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm text-muted">Rating puzzle</div>
          <div className="text-3xl font-extrabold">
            {Math.round(rating.rating)}
            {isProvisional(rating) && <span className="text-muted">?</span>}
          </div>
        </div>
        {last?.delta !== undefined && (
          <div className={`text-xl font-bold ${last.delta >= 0 ? 'text-good' : 'text-bad'}`}>
            {last.delta >= 0 ? '+' : ''}
            {last.delta}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className="text-muted">Độ khó:</span>
        {DIFFICULTIES.map((d) => (
          <button
            key={d.value}
            className={`btn btn-sm ${profile.settings.difficulty === d.value ? 'bg-accent text-white' : ''}`}
            onClick={() => updateSettings({ difficulty: d.value })}
          >
            {d.label}
          </button>
        ))}
      </div>
      {results.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs text-muted">
            Phiên này: {solved}/{results.length} đúng
          </div>
          <div className="flex flex-wrap gap-1">
            {results.slice(-30).map((r, i) => (
              <span
                key={i}
                className={`flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold ${r.success ? 'bg-good' : 'bg-bad'}`}
              >
                {r.success ? '✓' : '✗'}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (error) {
    return (
      <div className="card">
        <p className="mb-3 text-bad">{error}</p>
        <button className="btn" onClick={loadNext}>
          Thử lại
        </button>
      </div>
    );
  }
  if (!puzzle) return <div className="text-muted">Đang tải puzzle…</div>;

  return (
    <PuzzlePlayer
      key={puzzle.id}
      puzzle={puzzle}
      settings={profile.settings}
      onResult={onResult}
      onNext={loadNext}
      header={header}
    />
  );
}
