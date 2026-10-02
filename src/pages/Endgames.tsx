import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Board } from '../components/Board';
import { GameView } from '../components/GameView';
import { DRILLS, type Drill } from '../content/drills';
import type { Game, GameResult } from '../core/game';
import { Position, type Side } from '../core/xiangqi';
import type { GameRecord } from '../data/db';
import { saveDrillResult, useDrillResults, useProfile } from '../data/store';

const BOT_MS = 900;

export function starsFor(drill: Drill, moves: number): number {
  if (moves <= drill.par) return 3;
  if (moves <= Math.ceil(drill.par * 1.5)) return 2;
  return 1;
}

const playerMoves = (game: Game) => Math.ceil(game.moves.length / 2);

export function Endgames() {
  const { id } = useParams();
  const drill = DRILLS.find((d) => d.id === id);
  return drill ? <DrillPlayer key={drill.id} drill={drill} /> : <DrillList />;
}

function Stars({ n, size = 'text-base' }: { n: number; size?: string }) {
  return (
    <span className={size}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= n ? 'text-warn' : 'text-white/15'}>
          ★
        </span>
      ))}
    </span>
  );
}

function DrillList() {
  const results = useDrillResults();
  const profile = useProfile();
  if (!results || !profile) return null;
  const groups = [...new Set(DRILLS.map((d) => d.group))];
  const total = [...results.values()].reduce((s, r) => s + r.stars, 0);
  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">Tàn cuộc</h1>
      <p className="mb-5 text-muted">
        Thực hành thắng các thế tàn cuộc cơ bản trước máy phòng thủ hết sức. Thắng càng nhanh càng nhiều sao. Đã đạt{' '}
        <b className="text-warn">{total}</b>/{DRILLS.length * 3} ★.
      </p>
      {groups.map((g) => (
        <section key={g} className="mb-6">
          <h2 className="mb-3 text-lg font-bold">{g}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DRILLS.filter((d) => d.group === g).map((d) => {
              const r = results.get(d.id);
              return (
                <Link key={d.id} to={`/endgames/${d.id}`} className="card flex gap-3 transition-colors hover:bg-panel-2">
                  <div className="w-24 shrink-0">
                    <Board fen={d.fen} orientation={new Position(d.fen).turn} coordinates={false} theme={profile.settings.boardTheme} pieceStyle={profile.settings.pieceStyle} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold">{d.title}</div>
                    <Stars n={r?.stars ?? 0} />
                    <p className="mt-1 text-xs text-muted">{d.desc}</p>
                    {r && <p className="mt-1 text-xs text-muted">Tốt nhất: {r.bestMoves} nước</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function DrillPlayer({ drill }: { drill: Drill }) {
  const profile = useProfile();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  const [stars, setStars] = useState<number | null>(null);
  const [record, setRecord] = useState<GameRecord>(() => newRecord(drill));
  const results = useDrillResults();
  if (!profile) return null;

  const playerSide = record.playerSide as Side;
  const index = DRILLS.indexOf(drill);
  const next = DRILLS[index + 1];

  const checkEnd = (game: Game): GameResult | null =>
    game.pos.turn === playerSide && playerMoves(game) >= drill.limit ? { winner: (1 - playerSide) as Side, reason: 'limit' } : null;

  const onEnd = (result: GameResult, game: Game) => {
    if (result.winner !== playerSide) {
      setStars(0);
      return;
    }
    const moves = playerMoves(game);
    const s = starsFor(drill, moves);
    setStars(s);
    void saveDrillResult(drill.id, s, moves);
  };

  const retry = () => {
    setStars(null);
    setRecord(newRecord(drill));
    setAttempt((a) => a + 1);
  };

  return (
    <div>
      <Link to="/endgames" className="link mb-3 inline-block text-sm">
        ← Tất cả bài tàn cuộc
      </Link>
      <GameView
        key={attempt}
        record={record}
        settings={profile.settings}
        onChange={setRecord}
        botTimeMs={BOT_MS}
        checkEnd={checkEnd}
        onEnd={onEnd}
        header={
          <div className="card">
            <div className="text-xs text-muted">{drill.group}</div>
            <div className="text-lg font-bold">{drill.title}</div>
            <p className="mt-1 text-sm text-muted">{drill.desc}</p>
            <div className="mt-2 text-sm">
              Mục tiêu: thắng trong tối đa <b>{drill.limit}</b> nước. ★★★ nếu ≤ {drill.par} nước, ★★ nếu ≤ {Math.ceil(drill.par * 1.5)} nước.
            </div>
            <div className="mt-1 text-sm">
              Đã đi: <b>{Math.ceil(record.moves.length / 2)}</b> nước
              {results?.get(drill.id) && (
                <span className="ml-2 text-muted">
                  · Kỷ lục: <Stars n={results.get(drill.id)!.stars} />
                </span>
              )}
            </div>
            {stars !== null && (
              <div className="mt-3 rounded-lg bg-panel-2 p-3 text-center">
                {stars > 0 ? (
                  <>
                    <Stars n={stars} size="text-3xl" />
                    <div className="text-sm">Hoàn thành!</div>
                  </>
                ) : (
                  <div className="text-sm text-bad">Chưa thành công. Thử lại nhé!</div>
                )}
              </div>
            )}
          </div>
        }
        endActions={
          <>
            <button className="btn btn-primary" onClick={retry}>
              ↻ Thử lại
            </button>
            {next && (
              <button className="btn" onClick={() => navigate(`/endgames/${next.id}`)}>
                Bài tiếp theo →
              </button>
            )}
          </>
        }
      />
    </div>
  );
}

function newRecord(drill: Drill): GameRecord {
  const now = Date.now();
  const side = new Position(drill.fen).turn;
  return { ts: now, updatedAt: now, mode: 'bot', playerSide: side, startFen: drill.fen, moves: [], title: drill.title };
}
