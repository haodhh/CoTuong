import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { PuzzleTrainer } from '../components/PuzzleTrainer';
import { themeStats, weakestThemes } from '../core/stats';
import { THEME_GROUPS, THEMES, themeName } from '../core/themes';
import { loadIndex, type PuzzleIndex } from '../data/puzzleData';
import { useAttempts } from '../data/store';

export function Themes() {
  const [index, setIndex] = useState<PuzzleIndex | null>(null);
  const attempts = useAttempts();
  useEffect(() => {
    loadIndex().then(setIndex, () => setIndex(null));
  }, []);
  const stats = useMemo(() => new Map(themeStats(attempts ?? []).map((s) => [s.theme, s])), [attempts]);
  const weakest = useMemo(() => weakestThemes([...stats.values()]), [stats]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">Puzzle theo chủ đề</h1>
      <p className="mb-5 text-muted">Chọn một đòn chiến thuật hoặc mẫu chiếu hết để luyện tập trung. Kết quả vẫn tính vào rating.</p>

      {weakest.length > 0 && (
        <div className="card mb-6 border border-warn/40">
          <div className="mb-2 font-semibold">⚠ Chủ đề bạn đang yếu</div>
          <div className="flex flex-wrap gap-2">
            {weakest.map((s) => (
              <Link key={s.theme} to={`/themes/${s.theme}`} className="btn btn-sm">
                {themeName(s.theme)} · {Math.round(s.rate * 100)}%
              </Link>
            ))}
          </div>
        </div>
      )}

      {THEME_GROUPS.map((group) => (
        <section key={group.title} className="mb-6">
          <h2 className="mb-3 text-lg font-bold">{group.title}</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {group.themes
              .filter((t) => !index || (index.themeCounts[t] ?? 0) > 0)
              .map((t) => {
                const s = stats.get(t);
                return (
                  <Link key={t} to={`/themes/${t}`} className="card block transition-colors hover:bg-panel-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{themeName(t)}</span>
                      {index && <span className="text-xs text-muted">{index.themeCounts[t]} bài</span>}
                    </div>
                    {THEMES[t]?.desc && <p className="mt-1 text-xs text-muted">{THEMES[t].desc}</p>}
                    {s && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${s.rate * 100}%` }} />
                        </div>
                        <span className="text-muted">
                          {s.solved}/{s.attempts}
                        </span>
                      </div>
                    )}
                  </Link>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function ThemePuzzles() {
  const { theme = '' } = useParams();
  return (
    <div>
      <Link to="/themes" className="link mb-3 inline-block text-sm">
        ← Tất cả chủ đề
      </Link>
      <PuzzleTrainer key={theme} mode="theme" theme={theme} />
    </div>
  );
}
