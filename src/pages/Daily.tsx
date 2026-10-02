import { useEffect, useState } from 'react';
import { PuzzlePlayer, type PuzzleOutcome } from '../components/PuzzlePlayer';
import type { Puzzle } from '../core/puzzle';
import { dayKey } from '../core/stats';
import { dailyPuzzle } from '../data/puzzleData';
import { recordAttempt, useAttempts, useProfile } from '../data/store';

export function Daily() {
  const profile = useProfile();
  const attempts = useAttempts();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = dayKey(Date.now());

  useEffect(() => {
    dailyPuzzle(today).then(
      (p) => (p ? setPuzzle(p) : setError('Không có dữ liệu puzzle.')),
      (e) => setError(String(e)),
    );
  }, [today]);

  if (error) return <div className="card text-bad">{error}</div>;
  if (!profile || !puzzle || !attempts) return <div className="text-muted">Đang tải…</div>;

  const doneToday = attempts.find((a) => a.mode === 'daily' && a.puzzleId === puzzle.id);
  const onResult = (outcome: PuzzleOutcome) => {
    if (!doneToday) void recordAttempt({ puzzle, mode: 'daily', ...outcome, rated: false });
  };

  const header = (
    <div className="card">
      <div className="text-lg font-bold">📅 Puzzle hằng ngày</div>
      <div className="text-sm text-muted">
        {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
      {doneToday && (
        <div className={`mt-2 text-sm ${doneToday.success ? 'text-good' : 'text-bad'}`}>
          Hôm nay bạn đã {doneToday.success ? 'giải đúng' : 'làm sai'} bài này. Quay lại vào ngày mai nhé!
        </div>
      )}
    </div>
  );

  return <PuzzlePlayer puzzle={puzzle} settings={profile.settings} onResult={onResult} header={header} />;
}
