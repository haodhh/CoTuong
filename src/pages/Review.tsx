import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useNow } from '../components/Layout';
import { PuzzlePlayer, type PuzzleOutcome } from '../components/PuzzlePlayer';
import { themeName } from '../core/themes';
import type { ReviewCard } from '../data/db';
import { nextDueReview, recordAttempt, removeReview, useProfile, useReviews } from '../data/store';

export function formatDue(due: number, now: number): string {
  const min = Math.round((due - now) / 60_000);
  if (min <= 0) return 'đến hạn';
  if (min < 60) return `${min} phút nữa`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} giờ nữa`;
  return `${Math.round(h / 24)} ngày nữa`;
}

export function Review() {
  const profile = useProfile();
  const reviews = useReviews();
  const now = useNow(30_000);
  const [current, setCurrent] = useState<ReviewCard | null | undefined>(undefined);
  const [done, setDone] = useState(0);
  const [round, setRound] = useState(0);

  const loadNext = useCallback(async () => {
    setCurrent((await nextDueReview(Date.now())) ?? null);
    setRound((r) => r + 1);
  }, []);

  useEffect(() => {
    void loadNext();
  }, [loadNext]);

  // When nothing was due, pick up cards as soon as they become due.
  useEffect(() => {
    if (current === null && reviews?.some((r) => r.due <= now)) void loadNext();
  }, [current, reviews, now, loadNext]);

  if (!profile || current === undefined) return null;

  const onResult = (outcome: PuzzleOutcome) => {
    if (!current) return;
    void recordAttempt({ puzzle: current.puzzle, mode: 'review', ...outcome, rated: false });
    setDone((d) => d + 1);
  };

  const dueCount = reviews?.filter((r) => r.due <= now).length ?? 0;

  if (current) {
    const header = (
      <div className="card">
        <div className="text-lg font-bold">🔁 Ôn lại bài đã sai</div>
        <div className="text-sm text-muted">
          Còn {dueCount} bài đến hạn · đã ôn {done} bài
        </div>
        <p className="mt-2 text-xs text-muted">
          Giải đúng thì bài sẽ quay lại sau lâu hơn; sai thì quay lại sau 10 phút.
        </p>
      </div>
    );
    return (
      <PuzzlePlayer
        key={`${current.puzzleId}-${round}`}
        puzzle={current.puzzle}
        settings={profile.settings}
        onResult={onResult}
        onNext={loadNext}
        nextLabel="Bài tiếp theo →"
        header={header}
      />
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">Ôn lỗi</h1>
      <p className="mb-5 text-muted">
        Mọi puzzle bạn giải sai được đưa vào đây và hẹn lịch ôn lại theo thuật toán lặp lại ngắt quãng (FSRS):
        giải đúng thì khoảng cách giữa các lần ôn tăng dần.
      </p>
      <div className="card mb-5 text-center">
        <div className="text-4xl">🎉</div>
        <div className="mt-2 text-lg font-bold">Không còn bài nào đến hạn</div>
        <div className="mb-4 text-sm text-muted">
          {reviews && reviews.length > 0
            ? `Bài tiếp theo đến hạn ${formatDue(reviews[0].due, now)}.`
            : 'Bạn chưa có bài sai nào để ôn.'}
        </div>
        <Link to="/puzzles" className="btn btn-primary">
          Giải puzzle mới
        </Link>
      </div>
      {reviews && reviews.length > 0 && (
        <div className="card">
          <div className="mb-3 font-semibold">Danh sách ôn tập ({reviews.length})</div>
          <div className="divide-y divide-white/5">
            {reviews.map((r) => (
              <div key={r.puzzleId} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="w-14 font-mono text-muted">{r.puzzle.rating}</span>
                <span className="flex-1 truncate">
                  {r.puzzle.themes
                    .slice(0, 3)
                    .map((t) => themeName(t))
                    .join(', ')}
                </span>
                <span className="text-xs text-muted">
                  {r.card.reps > 0 ? `${r.card.reps} lần ôn · ` : ''}
                  {formatDue(r.due, now)}
                </span>
                <button className="btn btn-sm" onClick={() => removeReview(r.puzzleId)} title="Bỏ khỏi danh sách ôn">
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
