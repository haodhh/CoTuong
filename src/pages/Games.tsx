import { Link } from 'react-router';
import { REASON_TEXT } from '../core/game';
import type { GameRecord } from '../data/db';
import { deleteGame, useGames } from '../data/store';
import { botLevel } from '../engine/levels';

function resultText(g: GameRecord): { text: string; tone: string } {
  if (g.result === undefined) return { text: 'Đang chơi', tone: 'text-warn' };
  if (g.result === 'draw') return { text: 'Hòa', tone: 'text-muted' };
  if (g.mode === 'bot') return g.result === g.playerSide ? { text: 'Thắng', tone: 'text-good' } : { text: 'Thua', tone: 'text-bad' };
  return { text: g.result === 0 ? 'Đỏ thắng' : 'Đen thắng', tone: 'text-white' };
}

export function Games() {
  const games = useGames();
  if (!games) return null;
  const played = games.filter((g) => g.moves.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Ván đã chơi</h1>
        <div className="flex gap-2">
          <Link to="/play" className="btn btn-primary">
            🤖 Chơi với máy
          </Link>
          <Link to="/local" className="btn">
            👥 Hai người
          </Link>
        </div>
      </div>
      {played.length === 0 ? (
        <div className="card text-center text-muted">Chưa có ván nào. Hãy chơi một ván với máy nhé!</div>
      ) : (
        <div className="card divide-y divide-white/5 p-0">
          {played.map((g) => {
            const r = resultText(g);
            const resume = `/${g.mode === 'bot' ? 'play' : 'local'}?game=${g.id}`;
            return (
              <div key={g.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-40 flex-1">
                  <div className="font-semibold">
                    {g.mode === 'bot' ? `Với máy · ${botLevel(g.level ?? 3).name}` : g.title ?? 'Hai người'}
                    {g.mode === 'bot' && <span className="text-muted"> · bạn cầm {g.playerSide === 1 ? 'Đen' : 'Đỏ'}</span>}
                  </div>
                  <div className="text-xs text-muted">
                    {new Date(g.updatedAt).toLocaleString('vi-VN')} · {g.moves.length} nước
                    {g.title && g.mode === 'bot' && ` · ${g.title}`}
                  </div>
                </div>
                <div className={`w-28 font-bold ${r.tone}`}>
                  {r.text}
                  {g.reason && <div className="text-xs font-normal text-muted">{REASON_TEXT[g.reason]}</div>}
                </div>
                <div className="flex gap-1">
                  {g.result === undefined && (
                    <Link to={resume} className="btn btn-sm">
                      ▶ Tiếp tục
                    </Link>
                  )}
                  <Link to={`/analysis?game=${g.id}`} className="btn btn-sm">
                    🔍 Phân tích
                  </Link>
                  <button
                    className="btn btn-sm"
                    title="Xóa ván"
                    onClick={() => confirm('Xóa ván này?') && g.id !== undefined && void deleteGame(g.id)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
