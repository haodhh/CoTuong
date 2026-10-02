import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Board, type Shape } from '../components/Board';
import { legalDests, moveSquares, sideName } from '../core/game';
import { lineNotation, moveNotation } from '../core/notation';
import { CLASS_INFO, reviewGame, sideAccuracy, winChance, type MoveReview, type PositionEval } from '../core/review';
import { playSound } from '../core/sound';
import { BLACK, Position, RED, START_FEN, makeMove, moveToUci, uciToMove, type Side } from '../core/xiangqi';
import type { GameRecord } from '../data/db';
import { getGame, useProfile } from '../data/store';
import { think, stopEngine, type EngineInfo } from '../engine/client';

const REVIEW_MS = 350;

export function Analysis() {
  const profile = useProfile();
  const [params] = useSearchParams();
  const gameId = Number(params.get('game'));
  const [record, setRecord] = useState<GameRecord | null>(null);
  const [startFen, setStartFen] = useState(params.get('fen') ?? START_FEN);
  const [moves, setMoves] = useState<string[]>([]);
  const [ply, setPly] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [engineOn, setEngineOn] = useState(false);
  const [info, setInfo] = useState<EngineInfo | null>(null);
  const [evals, setEvals] = useState<(PositionEval | undefined)[]>([]);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [fenInput, setFenInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cancelReview = useRef(false);

  useEffect(() => {
    if (!gameId) return;
    void getGame(gameId).then((g) => {
      if (!g) return;
      setRecord(g);
      setStartFen(g.startFen);
      setMoves(g.moves);
      setPly(g.moves.length);
      setFlipped(g.mode === 'bot' && g.playerSide === BLACK);
    });
  }, [gameId]);

  const positions = useMemo(() => {
    const pos = new Position(startFen);
    const fens = [pos.fen()];
    for (const m of moves) {
      pos.play(uciToMove(m));
      fens.push(pos.fen());
    }
    return fens;
  }, [startFen, moves]);
  const notation = useMemo(() => lineNotation(startFen, moves.map(uciToMove)), [startFen, moves]);
  const redFirst = useMemo(() => new Position(startFen).turn === RED, [startFen]);
  const reviews = useMemo<MoveReview[] | null>(
    () => (evals.length === moves.length + 1 && evals.every(Boolean) ? reviewGame(moves, evals as PositionEval[], redFirst) : null),
    [evals, moves, redFirst],
  );

  const pos = useMemo(() => {
    // Keep the move history so the engine and the board know about repetitions.
    const p = new Position(startFen);
    for (let i = 0; i < ply; i++) p.play(uciToMove(moves[i]));
    return p;
  }, [startFen, moves, ply]);
  const dests = useMemo(() => legalDests(pos), [pos]);

  // Live engine analysis of the current position.
  useEffect(() => {
    setInfo(null);
    if (!engineOn || reviewing !== null || !pos.hasLegalMove()) return;
    let cancelled = false;
    think({ fen: startFen, moves: moves.slice(0, ply), timeMs: 5000 }, (i) => !cancelled && setInfo(i))
      .then((r) => !cancelled && setInfo(r))
      .catch(() => {});
    return () => {
      cancelled = true;
      stopEngine();
    };
  }, [engineOn, startFen, moves, ply, reviewing, pos]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft') setPly((p) => Math.max(0, p - 1));
      if (e.key === 'ArrowRight') setPly((p) => Math.min(moves.length, p + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moves.length]);

  if (!profile) return null;
  const s = profile.settings;

  const onMove = (from: number, to: number) => {
    const uci = moveToUci(makeMove(from, to));
    playSound(pos.board[to] ? 'capture' : 'move');
    if (moves[ply] === uci) {
      setPly(ply + 1);
      return;
    }
    // A new move replaces the rest of the line.
    setMoves([...moves.slice(0, ply), uci]);
    setEvals((e) => e.slice(0, ply + 1));
    setPly(ply + 1);
  };

  const runReview = async () => {
    cancelReview.current = false;
    setEngineOn(false);
    const out: PositionEval[] = [];
    for (let i = 0; i <= moves.length; i++) {
      if (cancelReview.current) break;
      setReviewing(i);
      const p = new Position(startFen);
      for (let j = 0; j < i; j++) p.play(uciToMove(moves[j]));
      const toMove: Side = p.turn;
      if (!p.hasLegalMove()) {
        // The side to move is mated (or stalemated): a loss for it.
        out.push({ cp: 0, mate: toMove === RED ? -1 : 1 });
        continue;
      }
      try {
        const r = await think({ fen: startFen, moves: moves.slice(0, i), timeMs: REVIEW_MS });
        const sign = toMove === RED ? 1 : -1;
        out.push({ cp: r.score * sign, mate: r.mate !== undefined ? r.mate * sign : undefined, best: r.move ?? undefined });
      } catch {
        break;
      }
      setEvals([...out]);
    }
    setEvals([...out]);
    setReviewing(null);
  };

  const loadFen = () => {
    try {
      const p = new Position(fenInput);
      if (!p.kings[RED] || !p.kings[BLACK]) throw new Error('Thiếu Tướng.');
      setRecord(null);
      setStartFen(p.fen());
      setMoves([]);
      setEvals([]);
      setPly(0);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const currentEval = evals[ply];
  const shapes: Shape[] = [];
  const bestUci = engineOn && info?.pv[0] ? info.pv[0] : reviews && currentEval?.best && ply < moves.length && reviews[ply].cls !== 'best' && reviews[ply].cls !== 'good' ? currentEval.best : undefined;
  const best = moveSquares(bestUci);
  if (best) shapes.push({ from: best[0], to: best[1], color: engineOn ? 'blue' : 'green' });

  const redScore: PositionEval | null = engineOn && info ? toRed(info, pos.turn) : (currentEval ?? null);
  const orientation: Side = flipped ? BLACK : RED;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="mx-auto flex w-full max-w-[min(100%,calc((100vh-110px)*0.88))] gap-2 self-start">
        <EvalBar value={redScore} flipped={flipped} />
        <div className="flex-1">
          <Board
            fen={positions[ply]}
            orientation={orientation}
            movable={reviewing === null && pos.hasLegalMove() ? pos.turn : undefined}
            dests={dests}
            lastMove={moveSquares(moves[ply - 1])}
            check={pos.inCheck() ? pos.kings[pos.turn] : undefined}
            shapes={shapes}
            coordinates={s.coordinates}
            animation={s.animation}
            theme={s.boardTheme}
            pieceStyle={s.pieceStyle}
            onMove={onMove}
          />
        </div>
      </div>

      <aside className="flex flex-col gap-3">
        <div className="card">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">Phân tích</h1>
            {record && (
              <span className="text-xs text-muted">
                Ván #{record.id} · {record.mode === 'bot' ? `với máy cấp ${record.level}` : 'hai người'}
              </span>
            )}
          </div>
          <div className="text-sm text-muted">
            {pos.hasLegalMove() ? `${sideName(pos.turn)} đi` : `${sideName(pos.turn)} đã thua (hết nước)`}
            {pos.inCheck() && pos.hasLegalMove() && ' · đang bị chiếu'}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className={`btn ${engineOn ? 'bg-accent text-white' : ''}`} onClick={() => setEngineOn((v) => !v)} disabled={reviewing !== null}>
              {engineOn ? '⏹ Tắt máy' : '🧠 Bật máy'}
            </button>
            <button className="btn" onClick={() => setFlipped((f) => !f)}>
              🔄 Lật bàn
            </button>
          </div>
          {engineOn && (
            <div className="mt-3 rounded-lg bg-panel-2 p-2 text-sm">
              {info ? (
                <>
                  <div className="flex justify-between">
                    <b>{formatEval(toRed(info, pos.turn))}</b>
                    <span className="text-xs text-muted">
                      độ sâu {info.depth} · {Math.round(info.nodes / 1000)}k nút
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-xs text-stone-300">{lineNotation(positions[ply], info.pv.map(uciToMove)).join('  ')}</div>
                </>
              ) : (
                <span className="text-muted">Đang tính…</span>
              )}
            </div>
          )}
        </div>

        {moves.length > 0 && (
          <div className="card">
            {reviews ? (
              <ReviewSummary reviews={reviews} redFirst={redFirst} evals={evals as PositionEval[]} ply={ply} onSelect={setPly} />
            ) : reviewing !== null ? (
              <div>
                <div className="mb-2 text-sm">
                  Đang đánh giá nước {reviewing}/{moves.length}…
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-accent transition-all" style={{ width: `${(reviewing / (moves.length + 1)) * 100}%` }} />
                </div>
                <button className="btn btn-sm mt-2" onClick={() => (cancelReview.current = true)}>
                  Dừng
                </button>
              </div>
            ) : (
              <>
                <button className="btn btn-primary w-full" onClick={runReview}>
                  📊 Đánh giá cả ván
                </button>
                <p className="mt-2 text-xs text-muted">Máy chấm từng nước, chỉ ra nước sai và độ chính xác của mỗi bên (khoảng {Math.ceil(((moves.length + 1) * REVIEW_MS) / 1000)} giây).</p>
              </>
            )}
          </div>
        )}

        <AnalysisMoves notation={notation} reviews={reviews} ply={ply} onSelect={setPly} />
        {reviews && ply > 0 && reviews[ply - 1].cls !== 'good' && <MoveComment review={reviews[ply - 1]} best={evals[ply - 1]?.best} fen={positions[ply - 1]} onBack={() => setPly(ply - 1)} />}

        <div className="card text-sm">
          <div className="mb-1 font-semibold">Thế cờ (FEN)</div>
          <div className="mb-2 font-mono text-xs break-all text-muted">{positions[ply]}</div>
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-lg bg-panel-2 px-2 py-1.5 font-mono text-xs"
              placeholder="Dán FEN để mở thế cờ…"
              value={fenInput}
              onChange={(e) => setFenInput(e.target.value)}
            />
            <button className="btn btn-sm" onClick={loadFen} disabled={!fenInput.trim()}>
              Mở
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-bad">{error}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn btn-sm" onClick={() => void navigator.clipboard?.writeText(positions[ply])}>
              📋 Sao chép FEN
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                setRecord(null);
                setStartFen(START_FEN);
                setMoves([]);
                setEvals([]);
                setPly(0);
              }}
            >
              Bàn cờ mới
            </button>
            <Link className="btn btn-sm" to="/games">
              📜 Ván đã chơi
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}

function toRed(info: EngineInfo, turn: Side): PositionEval {
  const sign = turn === RED ? 1 : -1;
  return { cp: info.score * sign, mate: info.mate !== undefined ? info.mate * sign : undefined };
}

export function formatEval(e: PositionEval): string {
  if (e.mate !== undefined) return e.mate > 0 ? `Đỏ chiếu hết trong ${e.mate}` : `Đen chiếu hết trong ${-e.mate}`;
  const v = (e.cp / 100).toFixed(1);
  return e.cp > 0 ? `+${v}` : v;
}

function EvalBar({ value, flipped }: { value: PositionEval | null; flipped: boolean }) {
  const red = value ? winChance(value) : 50;
  return (
    <div className={`relative flex w-4 shrink-0 overflow-hidden rounded bg-stone-900 sm:w-5 ${flipped ? 'flex-col' : 'flex-col-reverse'}`} title={value ? formatEval(value) : ''}>
      <div className="bg-[#c0161c] transition-all duration-500" style={{ height: `${red}%` }} />
    </div>
  );
}

function AnalysisMoves({ notation, reviews, ply, onSelect }: { notation: string[]; reviews: MoveReview[] | null; ply: number; onSelect: (p: number) => void }) {
  const rows = [];
  for (let i = 0; i < notation.length; i += 2) rows.push(i);
  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between text-sm text-muted">
        <span>Biên bản</span>
        <span className="flex gap-1">
          <button className="btn btn-sm" onClick={() => onSelect(0)} aria-label="Về đầu">
            ⏮
          </button>
          <button className="btn btn-sm" onClick={() => onSelect(Math.max(0, ply - 1))} aria-label="Nước trước">
            ◀
          </button>
          <button className="btn btn-sm" onClick={() => onSelect(Math.min(notation.length, ply + 1))} aria-label="Nước sau">
            ▶
          </button>
          <button className="btn btn-sm" onClick={() => onSelect(notation.length)} aria-label="Về cuối">
            ⏭
          </button>
        </span>
      </div>
      <div className="max-h-72 overflow-y-auto font-mono text-sm">
        {rows.length === 0 && <div className="py-2 text-center text-xs text-muted">Đi quân trên bàn cờ để bắt đầu phân tích.</div>}
        {rows.map((i) => (
          <div key={i} className="grid grid-cols-[2.5rem_1fr_1fr] items-center">
            <span className="text-muted">{i / 2 + 1}.</span>
            {[i, i + 1].map((j) => {
              if (j >= notation.length) return <span key={j} />;
              const r = reviews?.[j];
              const c = r ? CLASS_INFO[r.cls] : null;
              return (
                <button key={j} onClick={() => onSelect(j + 1)} className={`rounded px-1.5 py-0.5 text-left ${ply === j + 1 ? 'bg-accent text-white' : 'hover:bg-white/10'}`}>
                  {notation[j]}
                  {c?.symbol && <span className={`ml-1 font-bold ${ply === j + 1 ? '' : c.color}`}>{c.symbol}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewSummary({ reviews, redFirst, evals, ply, onSelect }: { reviews: MoveReview[]; redFirst: boolean; evals: PositionEval[]; ply: number; onSelect: (p: number) => void }) {
  const counts = (red: boolean, cls: string) => reviews.filter((r) => (r.ply % 2 === 0) === redFirst === red && r.cls === cls).length;
  const acc = (red: boolean) => {
    const a = sideAccuracy(reviews, red, redFirst);
    return a === null ? '–' : `${Math.round(a)}%`;
  };
  return (
    <div>
      <div className="mb-2 font-semibold">Đánh giá ván</div>
      <EvalChart evals={evals} ply={ply} onSelect={onSelect} />
      <table className="mt-3 w-full text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="text-left font-normal" />
            <th className="font-normal text-[#f87171]">Đỏ</th>
            <th className="font-normal">Đen</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Độ chính xác</td>
            <td className="text-center font-bold">{acc(true)}</td>
            <td className="text-center font-bold">{acc(false)}</td>
          </tr>
          {(['inaccuracy', 'mistake', 'blunder'] as const).map((cls) => (
            <tr key={cls}>
              <td className={CLASS_INFO[cls].color}>
                {CLASS_INFO[cls].label} {CLASS_INFO[cls].symbol}
              </td>
              <td className="text-center">{counts(true, cls)}</td>
              <td className="text-center">{counts(false, cls)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EvalChart({ evals, ply, onSelect }: { evals: PositionEval[]; ply: number; onSelect: (p: number) => void }) {
  const W = 320;
  const H = 80;
  const n = evals.length;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
  const y = (e: PositionEval) => H - (winChance(e) / 100) * H;
  const path = evals.map((e, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(e).toFixed(1)}`).join('');
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-20 w-full cursor-pointer rounded bg-stone-900"
      preserveAspectRatio="none"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onSelect(Math.round(((e.clientX - rect.left) / rect.width) * (n - 1)));
      }}
      role="img"
      aria-label="Biểu đồ đánh giá"
    >
      <path d={`${path}L${W},${H}L0,${H}Z`} fill="rgba(192,22,28,0.55)" />
      <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="rgba(255,255,255,0.2)" />
      <line x1={x(ply)} x2={x(ply)} y1={0} y2={H} stroke="#fff" strokeWidth={1.5} />
    </svg>
  );
}

function MoveComment({ review, best, fen, onBack }: { review: MoveReview; best?: string; fen: string; onBack: () => void }) {
  const c = CLASS_INFO[review.cls];
  const showBest = best && review.cls !== 'best' && review.cls !== 'good';
  return (
    <div className="card text-sm">
      <span className={`font-bold ${c.color}`}>
        {c.label} {c.symbol}
      </span>
      {review.loss > 1 && <span className="text-muted"> · mất {Math.round(review.loss)}% cơ hội thắng</span>}
      {showBest && (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-muted">
          <span>
            Nước tốt hơn: <b className="text-white">{moveNotation(new Position(fen), uciToMove(best))}</b>
          </span>
          <button className="btn btn-sm" onClick={onBack}>
            ◀ Xem trên bàn cờ
          </button>
        </div>
      )}
    </div>
  );
}
