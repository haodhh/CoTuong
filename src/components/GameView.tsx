import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Game, REASON_TEXT, legalDests, moveSquares, sideName, type GameResult } from '../core/game';
import { PIECE_NAME } from '../core/notation';
import { playSound } from '../core/sound';
import { BLACK, Position, RED, SQUARES, makeMove, moveToUci, sideOf, typeOf, type Side } from '../core/xiangqi';
import type { GameRecord, Settings } from '../data/db';
import { botMove, stopEngine, think } from '../engine/client';
import { botLevel } from '../engine/levels';
import { Board, type Shape } from './Board';

interface Props {
  record: GameRecord;
  settings: Settings;
  /** Persists the record after every change. */
  onChange: (record: GameRecord) => void;
  /** Extra end condition checked after each move (endgame drills). */
  checkEnd?: (game: Game) => GameResult | null;
  /** Bot strength override in milliseconds per move (drills). */
  botTimeMs?: number;
  onEnd?: (result: GameResult, game: Game) => void;
  header?: ReactNode;
  /** Shown below the result when the game is over. */
  endActions?: ReactNode;
}

function resultOf(record: GameRecord): GameResult | null {
  if (record.result === undefined || !record.reason) return null;
  return { winner: record.result === 'draw' ? null : record.result, reason: record.reason };
}

export function GameView({ record, settings, onChange, checkEnd, botTimeMs, onEnd, header, endActions }: Props) {
  // The parent remounts this component (key) for a different game.
  const [game] = useState(() => new Game(record.startFen, record.moves));
  const botSide: Side | undefined = record.mode === 'bot' ? ((1 - (record.playerSide ?? RED)) as Side) : undefined;
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<GameResult | null>(() => resultOf(record));
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [hint, setHint] = useState<Shape[]>([]);
  const [hintLoading, setHintLoading] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [autoFlip, setAutoFlip] = useState(false);
  const [syncKey, setSyncKey] = useState(0);
  // The latest saved state; the `record` prop is only the starting point.
  const recordRef = useRef(record);
  const callbacks = useRef({ onChange, checkEnd, onEnd });
  callbacks.current = { onChange, checkEnd, onEnd };

  const persist = useCallback(
    (patch: Partial<GameRecord>) => {
      const next = { ...recordRef.current, moves: [...game.moves], ...patch };
      recordRef.current = next;
      callbacks.current.onChange(next);
    },
    [game],
  );

  const finish = useCallback(
    (r: GameResult) => {
      setResult(r);
      persist({ result: r.winner === null ? 'draw' : (r.winner as 0 | 1), reason: r.reason });
      callbacks.current.onEnd?.(r, game);
      const playerSide = recordRef.current.playerSide;
      if (record.mode === 'bot') playSound(r.winner === playerSide ? 'success' : r.winner === null ? 'move' : 'error');
      else playSound('success');
    },
    [game, persist, record.mode],
  );

  const applyMove = useCallback(
    (uci: string) => {
      if (!game.play(uci)) return;
      playSound(game.pos.lastCaptured ? 'capture' : 'move');
      setHint([]);
      setViewPly(null);
      setVersion((v) => v + 1);
      const r = game.status() ?? callbacks.current.checkEnd?.(game) ?? null;
      if (r) finish(r);
      else persist({ result: undefined, reason: undefined });
    },
    [game, finish, persist],
  );

  useEffect(() => window.scrollTo(0, 0), []);

  // The bot's turn.
  useEffect(() => {
    if (botSide === undefined || result || game.pos.turn !== botSide) return;
    let cancelled = false;
    const started = Date.now();
    setThinking(true);
    const request = botTimeMs
      ? think({ fen: game.startFen, moves: [...game.moves], timeMs: botTimeMs })
      : botMove(game.startFen, [...game.moves], record.level ?? 3, game.moves.length);
    request
      .then((r) => {
        if (cancelled || !r.move) return;
        const move = r.move;
        window.setTimeout(() => {
          if (cancelled) return;
          setThinking(false);
          applyMove(move);
        }, Math.max(0, 400 - (Date.now() - started)));
      })
      .catch(() => {
        if (!cancelled) setThinking(false);
      });
    return () => {
      cancelled = true;
      setThinking(false);
      stopEngine();
    };
  }, [version, result, botSide, game, record.level, botTimeMs, applyMove]);

  const turn = game.pos.turn;
  const playerSide = record.playerSide ?? RED;
  const canMove = !result && viewPly === null && !thinking && (botSide === undefined || turn !== botSide);
  const baseOrientation = botSide === undefined ? (autoFlip ? turn : RED) : playerSide;
  const orientation = (flipped ? 1 - baseOrientation : baseOrientation) as Side;

  const notation = useMemo(() => game.notation(), [game, version]);
  const viewFen = useMemo(() => (viewPly === null ? game.pos.fen() : game.fenAt(viewPly)), [game, version, viewPly]);
  const viewPos = useMemo(() => new Position(viewFen), [viewFen]);
  const shownPly = viewPly ?? game.moves.length;
  const lastMove = useMemo(() => moveSquares(game.moves[shownPly - 1]), [game, version, shownPly]);
  const dests = useMemo(() => (canMove ? legalDests(game.pos) : new Map<number, number[]>()), [game, version, canMove]);
  const captured = useMemo(() => capturedPieces(game.startFen, viewPos), [game, viewPos]);

  const onMove = (from: number, to: number) => applyMove(moveToUci(makeMove(from, to)));

  const takeback = () => {
    stopEngine();
    setThinking(false);
    let n = 1;
    if (botSide !== undefined) n = turn === playerSide ? 2 : 1;
    for (let i = 0; i < n; i++) game.undo();
    setResult(null);
    setHint([]);
    setViewPly(null);
    setSyncKey((k) => k + 1);
    setVersion((v) => v + 1);
    persist({ result: undefined, reason: undefined, takebacks: (recordRef.current.takebacks ?? 0) + 1 });
  };

  const askHint = async () => {
    setHintLoading(true);
    try {
      const r = await think({ fen: game.startFen, moves: [...game.moves], timeMs: 1200 });
      const sq = moveSquares(r.move ?? undefined);
      if (sq) setHint([{ from: sq[0], to: sq[1], color: 'blue' }]);
      persist({ hints: (recordRef.current.hints ?? 0) + 1 });
    } catch {
      // Cancelled by a move or takeback.
    } finally {
      setHintLoading(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft') setViewPly((p) => Math.max(0, (p ?? game.moves.length) - 1));
      if (e.key === 'ArrowRight')
        setViewPly((p) => (p === null || p + 1 >= game.moves.length ? null : p + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game]);

  const level = record.level ? botLevel(record.level) : undefined;
  const topSide = (1 - orientation) as Side;
  const playerLabel = (side: Side) =>
    botSide === undefined ? `Bên ${sideName(side)}` : side === botSide ? `🤖 Máy · ${level?.name ?? 'Tàn cuộc'}` : '🙂 Bạn';

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="mx-auto flex w-full max-w-[min(100%,calc((100vh-190px)*0.84))] flex-col gap-1.5">
        <PlayerBar label={playerLabel(topSide)} side={topSide} captured={captured[topSide]} active={!result && turn === topSide} thinking={thinking && botSide === topSide} style={settings.pieceStyle} />
        <Board
          fen={viewFen}
          orientation={orientation}
          movable={canMove ? turn : undefined}
          dests={dests}
          lastMove={lastMove}
          check={viewPos.inCheck() ? viewPos.kings[viewPos.turn] : undefined}
          shapes={viewPly === null ? hint : []}
          coordinates={settings.coordinates}
          animation={settings.animation}
          theme={settings.boardTheme}
          pieceStyle={settings.pieceStyle}
          syncKey={syncKey}
          onMove={onMove}
        />
        <PlayerBar label={playerLabel(orientation)} side={orientation} captured={captured[orientation]} active={!result && turn === orientation} thinking={thinking && botSide === orientation} style={settings.pieceStyle} />
      </div>

      <aside className="flex flex-col gap-3">
        {header}
        {result ? (
          <ResultCard result={result} playerSide={botSide === undefined ? undefined : playerSide}>
            {endActions}
          </ResultCard>
        ) : (
          <div className="card">
            <div className="text-lg font-semibold">
              {thinking ? '🤔 Máy đang suy nghĩ…' : botSide === undefined ? `Lượt ${sideName(turn)}` : turn === playerSide ? 'Lượt của bạn' : 'Lượt của máy'}
            </div>
            <div className="text-sm text-muted">
              {game.pos.inCheck() ? '⚠ Đang bị chiếu!' : `Nước thứ ${Math.floor(game.moves.length / 2) + 1} · ${sideName(turn)} đi`}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {!result && (
            <button className="btn" onClick={askHint} disabled={!canMove || hintLoading}>
              {hintLoading ? '…' : '💡 Gợi ý'}
            </button>
          )}
          <button className="btn" onClick={takeback} disabled={game.moves.length === 0 || (botSide !== undefined && game.moves.length < 2 && playerSide === BLACK)}>
            ↩ Đi lại
          </button>
          <button className="btn" onClick={() => setFlipped((f) => !f)}>
            🔄 Lật bàn
          </button>
          {!result && (
            <button
              className="btn text-bad"
              onClick={() => {
                if (confirm(botSide === undefined ? `Bên ${sideName(turn)} xin thua?` : 'Bạn chắc chắn muốn xin thua?')) {
                  stopEngine();
                  finish({ winner: (botSide === undefined ? 1 - turn : botSide) as Side, reason: 'resign' });
                }
              }}
            >
              🏳 Xin thua
            </button>
          )}
          {!result && botSide === undefined && (
            <button className="btn" onClick={() => confirm('Hai bên đồng ý hòa?') && finish({ winner: null, reason: 'agreement' })}>
              🤝 Hòa
            </button>
          )}
        </div>
        {botSide === undefined && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input type="checkbox" className="h-4 w-4 accent-[#d64933]" checked={autoFlip} onChange={(e) => setAutoFlip(e.target.checked)} />
            Tự lật bàn theo lượt đi
          </label>
        )}

        <MoveTable notation={notation} current={shownPly} onSelect={(ply) => setViewPly(ply >= game.moves.length ? null : ply)} />
      </aside>
    </div>
  );
}

function PlayerBar(props: { label: string; side: Side; captured: number[]; active: boolean; thinking: boolean; style: Settings['pieceStyle'] }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${props.active ? 'bg-panel-2' : 'bg-panel/60'}`}>
      <span className={`h-3 w-3 rounded-full ${props.side === RED ? 'bg-[#c0161c]' : 'bg-stone-900 ring-1 ring-stone-500'}`} />
      <span className="font-semibold">{props.label}</span>
      {props.thinking && <span className="animate-pulse text-muted">đang nghĩ…</span>}
      <span className="ml-auto flex flex-wrap justify-end gap-0.5">
        {props.captured.map((p, i) => (
          <span
            key={i}
            title={PIECE_NAME[typeOf(p)]}
            className={`flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f3dfb6] px-1 text-[11px] font-bold ${sideOf(p) === RED ? 'text-[#c0161c]' : 'text-stone-900'}`}
          >
            {props.style === 'han' ? HAN_SHORT[sideOf(p)][typeOf(p)] : PIECE_NAME[typeOf(p)][0]}
          </span>
        ))}
      </span>
    </div>
  );
}

const HAN_SHORT = [
  ['', '帥', '仕', '相', '傌', '俥', '炮', '兵'],
  ['', '將', '士', '象', '馬', '車', '砲', '卒'],
];

/** Pieces each side has captured so far (the opponent's pieces missing compared to the start). */
function capturedPieces(startFen: string, pos: Position): [number[], number[]] {
  const start = new Position(startFen);
  const count = (p: Position) => {
    const c = new Array(16).fill(0);
    for (const s of SQUARES) if (p.board[s]) c[p.board[s]]++;
    return c;
  };
  const a = count(start);
  const b = count(pos);
  const out: [number[], number[]] = [[], []];
  for (let piece = 15; piece >= 1; piece--) {
    for (let i = 0; i < a[piece] - b[piece]; i++) out[1 - sideOf(piece)].push(piece);
  }
  return out;
}

function ResultCard({ result, playerSide, children }: { result: GameResult; playerSide?: Side; children?: ReactNode }) {
  let title: string;
  let tone = 'bg-panel';
  if (result.winner === null) title = '🤝 Hòa';
  else if (playerSide === undefined) title = `🏆 Bên ${sideName(result.winner)} thắng`;
  else if (result.winner === playerSide) {
    title = '🎉 Bạn thắng!';
    tone = 'bg-good/20 border-good';
  } else {
    title = '😔 Bạn thua';
    tone = 'bg-bad/20 border-bad';
  }
  return (
    <div className={`rounded-xl border border-transparent p-4 ${tone}`}>
      <div className="text-xl font-bold">{title}</div>
      <div className="text-sm text-muted">Kết thúc do {REASON_TEXT[result.reason]}.</div>
      {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function MoveTable({ notation, current, onSelect }: { notation: string[]; current: number; onSelect: (ply: number) => void }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (current === notation.length) end.current?.scrollIntoView({ block: 'nearest' });
  }, [current, notation.length]);
  const rows = [];
  for (let i = 0; i < notation.length; i += 2) rows.push(i);
  return (
    <div className="rounded-xl bg-panel p-3">
      <div className="mb-2 flex items-center justify-between text-sm text-muted">
        <span>Biên bản ({notation.length} nước)</span>
        <span className="flex gap-1">
          <button className="btn btn-sm" onClick={() => onSelect(0)} aria-label="Về đầu">
            ⏮
          </button>
          <button className="btn btn-sm" onClick={() => onSelect(Math.max(0, current - 1))} aria-label="Nước trước">
            ◀
          </button>
          <button className="btn btn-sm" onClick={() => onSelect(Math.min(notation.length, current + 1))} aria-label="Nước sau">
            ▶
          </button>
          <button className="btn btn-sm" onClick={() => onSelect(notation.length)} aria-label="Về cuối">
            ⏭
          </button>
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto font-mono text-sm">
        {rows.length === 0 && <div className="py-2 text-center text-xs text-muted">Chưa có nước nào.</div>}
        {rows.map((i) => (
          <div key={i} className="grid grid-cols-[2.5rem_1fr_1fr] items-center">
            <span className="text-muted">{i / 2 + 1}.</span>
            {[i, i + 1].map((j) =>
              j < notation.length ? (
                <button
                  key={j}
                  onClick={() => onSelect(j + 1)}
                  className={`rounded px-1.5 py-0.5 text-left ${current === j + 1 ? 'bg-accent text-white' : 'hover:bg-white/10'}`}
                >
                  {notation[j]}
                </button>
              ) : (
                <span key={j} />
              ),
            )}
          </div>
        ))}
        <div ref={end} />
      </div>
    </div>
  );
}
