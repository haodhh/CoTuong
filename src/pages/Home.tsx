import { useMemo } from 'react';
import { Link } from 'react-router';
import { useNow } from '../components/Layout';
import { isProvisional } from '../core/glicko2';
import { attemptsToday, streakDays, themeStats, weakestThemes } from '../core/stats';
import { themeName } from '../core/themes';
import { currentRating, useAttempts, useDueCount, useGames, useProfile, useRushBest } from '../data/store';

export function Home() {
  const profile = useProfile();
  const attempts = useAttempts();
  const games = useGames();
  const due = useDueCount(useNow()) ?? 0;
  const best = useRushBest();
  const weakest = useMemo(() => weakestThemes(themeStats(attempts ?? []), 1)[0], [attempts]);

  if (!profile || !attempts) return null;

  const rating = currentRating(profile);
  const today = attemptsToday(attempts).length;
  const goal = profile.settings.dailyGoal;
  const streak = streakDays(attempts);
  const botGames = (games ?? []).filter((g) => g.mode === 'bot' && g.result !== undefined);
  const wins = botGames.filter((g) => g.result === g.playerSide).length;
  const unfinished = (games ?? []).find((g) => g.result === undefined && g.moves.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <section className="card flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="text-sm text-muted">Rating puzzle</div>
          <div className="text-4xl font-extrabold">
            {profile.onboarded ? Math.round(rating.rating) : '—'}
            {profile.onboarded && isProvisional(rating) && <span className="text-muted">?</span>}
          </div>
          <div className="mt-3 text-sm">
            Hôm nay: <b>{today}</b>/{goal} puzzle {today >= goal && '✅'}
          </div>
          <div className="mt-1 h-2 max-w-sm overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (today / goal) * 100)}%` }} />
          </div>
        </div>
        <div className="flex gap-6 text-center">
          <div>
            <div className="text-3xl font-extrabold">{streak}🔥</div>
            <div className="text-xs text-muted">ngày liên tiếp</div>
          </div>
          <div>
            <div className="text-3xl font-extrabold">{best?.['3m'] ?? 0}</div>
            <div className="text-xs text-muted">kỷ lục Rush</div>
          </div>
          <div>
            <div className="text-3xl font-extrabold">
              {wins}/{botGames.length}
            </div>
            <div className="text-xs text-muted">thắng máy</div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/play" className="btn btn-primary py-5 text-xl">
          🤖 Chơi với máy
        </Link>
        <Link to="/puzzles" className="btn py-5 text-xl">
          🧩 Giải puzzle
        </Link>
      </div>

      {unfinished && (
        <Link
          to={`/${unfinished.mode === 'bot' ? 'play' : 'local'}?game=${unfinished.id}`}
          className="card flex items-center gap-3 border border-warn/40 hover:bg-panel-2"
        >
          <span className="text-2xl">⏸</span>
          <span className="flex-1">
            <span className="block font-semibold">Tiếp tục ván đang dở</span>
            <span className="text-sm text-muted">
              {unfinished.mode === 'bot' ? `Với máy cấp ${unfinished.level}` : 'Hai người'} · {unfinished.moves.length} nước
            </span>
          </span>
          <span>→</span>
        </Link>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile to="/review" icon="🔁" title="Ôn lỗi" desc={due > 0 ? `${due} bài đến hạn ôn` : 'Không có bài đến hạn'} highlight={due > 0} />
        <Tile to="/rush" icon="⚡" title="Puzzle Rush" desc="Giải nhanh trong 3 hoặc 5 phút" />
        <Tile to="/daily" icon="📅" title="Puzzle hằng ngày" desc="Mỗi ngày một bài" />
        <Tile
          to={weakest ? `/themes/${weakest.theme}` : '/themes'}
          icon="🎯"
          title={weakest ? `Luyện: ${themeName(weakest.theme)}` : 'Theo chủ đề'}
          desc={weakest ? `Chủ đề yếu nhất (${Math.round(weakest.rate * 100)}% đúng)` : 'Mã hậu pháo, Trùng pháo, Song Xe…'}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Luyện tập</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile to="/endgames" icon="🏁" title="Tàn cuộc" desc="Thực hành thắng các thế tàn cuộc cơ bản với máy" />
          <Tile to="/learn" icon="🎓" title="Học luật" desc="Cách đi từng quân, luật chiếu, các thế sát cơ bản" />
          <Tile to="/local" icon="👥" title="Hai người" desc="Chơi với bạn trên cùng thiết bị" />
          <Tile to="/analysis" icon="🔍" title="Phân tích" desc="Bàn cờ tự do có máy phân tích" />
        </div>
      </section>
    </div>
  );
}

function Tile(props: { to: string; icon: string; title: string; desc: string; highlight?: boolean }) {
  return (
    <Link to={props.to} className={`card block transition-colors hover:bg-panel-2 ${props.highlight ? 'border border-bad/60' : ''}`}>
      <div className="text-2xl">{props.icon}</div>
      <div className="mt-1 font-bold">{props.title}</div>
      <div className="text-sm text-muted">{props.desc}</div>
    </Link>
  );
}
