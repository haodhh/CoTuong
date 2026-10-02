import { useMemo } from 'react';
import { Link } from 'react-router';
import { useNow } from '../components/Layout';
import { RatingChart } from '../components/RatingChart';
import { isProvisional } from '../core/glicko2';
import { ratingHistory, streakDays, themeStats, weakestThemes } from '../core/stats';
import { themeName } from '../core/themes';
import type { PuzzleMode } from '../data/db';
import { currentRating, useAttempts, useDueCount, useProfile, useRushBest } from '../data/store';

const MODE_LABEL: Record<PuzzleMode, string> = {
  rated: 'Tính điểm',
  theme: 'Chủ đề',
  rush: 'Rush',
  review: 'Ôn lỗi',
  daily: 'Hằng ngày',
};

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="card">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Stats() {
  const profile = useProfile();
  const attempts = useAttempts();
  const best = useRushBest();
  const due = useDueCount(useNow());
  const history = useMemo(() => ratingHistory(attempts ?? []), [attempts]);
  const themes = useMemo(() => themeStats(attempts ?? []), [attempts]);
  const weakest = useMemo(() => weakestThemes(themes), [themes]);

  if (!profile || !attempts) return null;
  const rating = currentRating(profile);
  const solved = attempts.filter((a) => a.success).length;
  const recent = [...attempts].reverse().slice(0, 15);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">Thống kê</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat
          label="Rating puzzle"
          value={
            <>
              {Math.round(rating.rating)}
              {isProvisional(rating) && <span className="text-muted">?</span>}
            </>
          }
          sub={isProvisional(rating) ? 'tạm tính, cần giải thêm' : undefined}
        />
        <Stat label="Đã làm" value={attempts.length} sub="puzzle" />
        <Stat
          label="Tỉ lệ đúng"
          value={attempts.length ? `${Math.round((solved / attempts.length) * 100)}%` : '–'}
          sub={`${solved} bài đúng`}
        />
        <Stat label="Chuỗi ngày" value={`${streakDays(attempts)} 🔥`} />
        <Stat label="Kỷ lục Rush 3 phút" value={best?.['3m'] ?? 0} sub={`5 phút: ${best?.['5m'] ?? 0} · Sống sót: ${best?.survival ?? 0}`} />
        <Stat label="Cần ôn" value={due ?? 0} sub={<Link className="link" to="/review">Ôn ngay</Link>} />
      </div>

      <div className="card">
        <div className="mb-2 font-semibold">Rating puzzle</div>
        <RatingChart points={history} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card">
          <div className="mb-1 font-semibold">Điểm yếu cần luyện</div>
          <p className="mb-3 text-xs text-muted">Các chủ đề có tỉ lệ đúng thấp nhất (tối thiểu 5 lần làm).</p>
          {weakest.length === 0 ? (
            <p className="text-sm text-muted">Chưa đủ dữ liệu. Hãy giải thêm puzzle nhé.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {weakest.map((s) => (
                <div key={s.theme} className="flex items-center gap-3">
                  <span className="flex-1">{themeName(s.theme)}</span>
                  <span className="text-sm text-bad">{Math.round(s.rate * 100)}%</span>
                  <Link to={`/themes/${s.theme}`} className="btn btn-sm">
                    Luyện ngay
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="mb-3 font-semibold">Lịch sử gần đây</div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">Chưa có puzzle nào.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="pb-1 font-normal">Chế độ</th>
                  <th className="pb-1 font-normal">Độ khó</th>
                  <th className="pb-1 font-normal">Kết quả</th>
                  <th className="pb-1 text-right font-normal">Rating</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => (
                  <tr key={a.id} className="border-t border-white/5">
                    <td className="py-1">{MODE_LABEL[a.mode]}</td>
                    <td className="py-1">{a.puzzleRating}</td>
                    <td className={`py-1 ${a.success ? 'text-good' : 'text-bad'}`}>{a.success ? '✓ Đúng' : '✗ Sai'}</td>
                    <td className="py-1 text-right tabular-nums">
                      {a.ratingAfter !== undefined && a.ratingBefore !== undefined
                        ? `${a.ratingAfter} (${a.ratingAfter >= a.ratingBefore ? '+' : ''}${a.ratingAfter - a.ratingBefore})`
                        : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="mb-3 font-semibold">Theo chủ đề</div>
        {themes.length === 0 ? (
          <p className="text-sm text-muted">Chưa có dữ liệu.</p>
        ) : (
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {themes.map((s) => (
              <Link key={s.theme} to={`/themes/${s.theme}`} className="flex items-center gap-3 text-sm hover:text-accent">
                <span className="w-40 truncate">{themeName(s.theme)}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${s.rate * 100}%` }} />
                </div>
                <span className="w-16 text-right text-xs text-muted tabular-nums">
                  {s.solved}/{s.attempts}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
