import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { legalDests, moveSquares, sideName } from '../core/game';
import { PuzzleSession, mateLength, puzzleLine, type Puzzle } from '../core/puzzle';
import { playSound } from '../core/sound';
import { themeName } from '../core/themes';
import { Position, makeMove, moveToUci, uciToMove } from '../core/xiangqi';
import type { Settings } from '../data/db';
import { Board, type Shape } from './Board';

export interface PuzzleOutcome {
  success: boolean;
  usedHint: boolean;
  timeMs: number;
}

type Status = 'setup' | 'play' | 'wrong' | 'correct' | 'solved' | 'revealing' | 'failed';

interface Props {
  puzzle: Puzzle;
  settings: Settings;
  /** Rush mode: a wrong move ends the puzzle at once, and there are no hints or solutions. */
  rush?: boolean;
  /** Called exactly once per puzzle: at the first mistake, when the solution is shown, or when solved. */
  onResult: (outcome: PuzzleOutcome) => void;
  /** Called when the puzzle is over (solved, failed in rush mode, or solution fully shown). */
  onFinished?: (success: boolean) => void;
  onNext?: () => void;
  nextLabel?: string;
  header?: ReactNode;
  footer?: ReactNode;
}

export function PuzzlePlayer({ puzzle, settings, rush, onResult, onFinished, onNext, nextLabel, header, footer }: Props) {
  const session = useMemo(() => new PuzzleSession(puzzle), [puzzle]);
  const [, setTick] = useState(0);
  const rerender = () => setTick((t) => t + 1);
  const [status, setStatus] = useState<Status>('setup');
  const [syncKey, setSyncKey] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [viewPly, setViewPly] = useState<number | null>(null);

  const timers = useRef<number[]>([]);
  const reported = useRef(false);
  const hadMistake = useRef(false);
  const usedHint = useRef(false);
  const startedAt = useRef(0);
  const callbacks = useRef({ onResult, onFinished });
  callbacks.current = { onResult, onFinished };

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const report = useCallback((success: boolean) => {
    if (reported.current) return;
    reported.current = true;
    callbacks.current.onResult({ success, usedHint: usedHint.current, timeMs: Date.now() - startedAt.current });
  }, []);

  const moveSound = (captured: boolean) => playSound(captured ? 'capture' : 'move');
  const playScripted = () => {
    if (session.playScripted()) moveSound(session.pos.lastCaptured !== 0);
  };

  // Start each puzzle by playing the opponent's setup move.
  useEffect(() => {
    reported.current = false;
    hadMistake.current = false;
    usedHint.current = false;
    setStatus('setup');
    setHintLevel(0);
    setViewPly(null);
    later(rush ? 250 : 600, () => {
      playScripted();
      startedAt.current = Date.now();
      setStatus('play');
    });
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [session, rush, later]);

  const handleMove = (from: number, to: number) => {
    const verdict = session.tryMove(moveToUci(makeMove(from, to)));
    setHintLevel(0);
    if (verdict === 'wrong') {
      playSound('error');
      hadMistake.current = true;
      report(false);
      setSyncKey((k) => k + 1);
      if (rush) {
        setStatus('failed');
        later(500, () => callbacks.current.onFinished?.(false));
      } else {
        setStatus('wrong');
      }
      return;
    }
    moveSound(session.pos.lastCaptured !== 0);
    if (verdict === 'solved') {
      const success = !hadMistake.current && !usedHint.current;
      playSound('success');
      report(success);
      setStatus('solved');
      later(rush ? 300 : 0, () => callbacks.current.onFinished?.(success));
      rerender();
      return;
    }
    setStatus('correct');
    rerender();
    later(rush ? 250 : 450, () => {
      playScripted();
      setStatus('play');
    });
  };

  const showHint = () => {
    usedHint.current = true;
    setHintLevel((h) => Math.min(2, h + 1));
  };

  const showSolution = () => {
    report(false);
    setHintLevel(0);
    setStatus('revealing');
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const step = () => {
      if (session.isComplete) {
        setStatus('failed');
        callbacks.current.onFinished?.(false);
        return;
      }
      if (session.isSolverTurn) {
        const m = session.expectedMove;
        if (!m || session.tryMove(m) === 'wrong') {
          setStatus('failed');
          callbacks.current.onFinished?.(false);
          return;
        }
        moveSound(session.pos.lastCaptured !== 0);
      } else if (!session.playScripted()) {
        setStatus('failed');
        callbacks.current.onFinished?.(false);
        return;
      } else {
        moveSound(session.pos.lastCaptured !== 0);
      }
      rerender();
      later(650, step);
    };
    later(150, step);
  };

  const finished = status === 'solved' || status === 'failed';
  const line = useMemo(() => {
    // After the puzzle, show the moves actually played (they may differ from the stored line).
    if (!finished) return [];
    const pos = new Position(puzzle.fen);
    return session.history.map((uci) => {
      pos.play(uciToMove(uci));
      return { fen: pos.fen(), move: uci };
    });
  }, [finished, puzzle, session, status]);
  const notations = useMemo(() => {
    if (!finished) return [];
    const stored = puzzleLine(puzzle);
    const same = stored.length === line.length && stored.every((s, i) => s.move === line[i].move);
    return same ? stored.map((s) => s.notation) : puzzleLine({ ...puzzle, moves: line.map((l) => l.move) }).map((s) => s.notation);
  }, [finished, line, puzzle]);

  // Board state: the live session, or a position from the move list once the puzzle is over.
  const viewing = finished && viewPly !== null ? line[viewPly] : null;
  const fen = viewing ? viewing.fen : session.fen;
  const lastUci = viewing ? viewing.move : session.lastMove;
  const lastMove = useMemo(() => moveSquares(lastUci), [lastUci]);
  const pos = useMemo(() => new Position(fen), [fen]);
  const canMove = (status === 'play' || status === 'wrong') && session.isSolverTurn && !viewing;
  const dests = useMemo(() => (canMove ? legalDests(pos) : new Map<number, number[]>()), [pos, canMove]);
  const inCheck = pos.inCheck();

  const shapes = useMemo<Shape[]>(() => {
    if (hintLevel === 0) return [];
    const expected = session.expectedMove;
    if (!expected) return [];
    const [from, to] = moveSquares(expected)!;
    return hintLevel === 1 ? [{ from, color: 'green' }] : [{ from, to, color: 'green' }];
  }, [hintLevel, session, status]);

  useEffect(() => {
    if (!finished) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setViewPly((p) => Math.max(0, (p ?? line.length - 1) - 1));
      if (e.key === 'ArrowRight') setViewPly((p) => Math.min(line.length - 1, (p ?? line.length - 1) + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finished, line.length]);

  const success = status === 'solved' && !hadMistake.current && !usedHint.current;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]" data-puzzle-id={puzzle.id}>
      <div className="mx-auto w-full max-w-[min(100%,calc((100vh-130px)*0.84))]">
        <Board
          fen={fen}
          orientation={session.solverSide}
          movable={canMove ? session.solverSide : undefined}
          dests={dests}
          lastMove={lastMove}
          check={inCheck ? pos.kings[pos.turn] : undefined}
          shapes={shapes}
          coordinates={settings.coordinates}
          animation={settings.animation}
          theme={settings.boardTheme}
          pieceStyle={settings.pieceStyle}
          syncKey={syncKey}
          onMove={handleMove}
        />
      </div>

      <aside className="flex flex-col gap-3">
        {header}
        <StatusCard
          status={status}
          solver={sideName(session.solverSide)}
          moves={mateLength(puzzle)}
          left={session.movesLeft}
          success={success}
          rush={rush}
        />

        {!rush && !finished && (
          <div className="grid grid-cols-2 gap-2">
            <button className="btn" onClick={showHint} disabled={!canMove || hintLevel >= 2}>
              💡 Gợi ý
            </button>
            <button className="btn" onClick={showSolution} disabled={status === 'setup' || status === 'revealing'}>
              👁 Xem lời giải
            </button>
          </div>
        )}

        {finished && !rush && (
          <>
            {onNext && (
              <button className="btn btn-primary text-lg" onClick={onNext} autoFocus>
                {nextLabel ?? 'Puzzle tiếp theo →'}
              </button>
            )}
            <MoveList notations={notations} current={viewPly ?? line.length - 1} onSelect={setViewPly} />
            <PuzzleMeta puzzle={puzzle} />
          </>
        )}
        {footer}
      </aside>
    </div>
  );
}

function StatusCard(props: { status: Status; solver: string; moves: number; left: number; success: boolean; rush?: boolean }) {
  const { status, solver, moves, left, success, rush } = props;
  const goal = moves === 1 ? 'Chiếu hết trong 1 nước.' : `Chiếu hết trong ${moves} nước (còn ${left}).`;
  const content: Record<Status, { icon: string; title: string; text?: string; tone: string }> = {
    setup: { icon: '⏳', title: 'Đối thủ đang đi…', tone: 'bg-panel' },
    play: { icon: '♟', title: `Bạn cầm quân ${solver}`, text: goal, tone: 'bg-panel' },
    correct: { icon: '✓', title: 'Chính xác!', text: 'Tiếp tục…', tone: 'bg-good/20 border-good' },
    wrong: { icon: '✗', title: 'Chưa đúng', text: 'Thử nước khác nhé.', tone: 'bg-bad/20 border-bad' },
    revealing: { icon: '👁', title: 'Đang hiện lời giải…', tone: 'bg-panel' },
    solved: success
      ? { icon: '🎉', title: 'Giải đúng!', tone: 'bg-good/20 border-good' }
      : { icon: '✓', title: 'Đã giải xong', text: 'Không tính là đúng vì đã đi sai hoặc dùng gợi ý.', tone: 'bg-panel' },
    failed: rush
      ? { icon: '✗', title: 'Sai rồi!', tone: 'bg-bad/20 border-bad' }
      : { icon: '📘', title: 'Lời giải', text: 'Bài này đã được thêm vào mục Ôn lỗi.', tone: 'bg-panel' },
  };
  const c = content[status];
  return (
    <div className={`rounded-xl border border-transparent p-4 ${c.tone}`}>
      <div className="flex items-center gap-3">
        <span className="text-3xl leading-none">{c.icon}</span>
        <div>
          <div className="text-lg font-semibold">{c.title}</div>
          {c.text && <div className="text-sm text-muted">{c.text}</div>}
        </div>
      </div>
    </div>
  );
}

function MoveList({ notations, current, onSelect }: { notations: string[]; current: number; onSelect: (i: number) => void }) {
  return (
    <div className="rounded-xl bg-panel p-3">
      <div className="mb-2 flex items-center justify-between text-sm text-muted">
        <span>Diễn biến</span>
        <span className="flex gap-1">
          <button className="btn btn-sm" onClick={() => onSelect(Math.max(0, current - 1))} aria-label="Nước trước">
            ◀
          </button>
          <button className="btn btn-sm" onClick={() => onSelect(Math.min(notations.length - 1, current + 1))} aria-label="Nước sau">
            ▶
          </button>
        </span>
      </div>
      <div className="flex flex-wrap gap-1 font-mono text-sm">
        {notations.map((n, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`rounded px-1.5 py-0.5 ${i === current ? 'bg-accent text-white' : 'hover:bg-white/10'} ${i === 0 ? 'opacity-60' : ''}`}
            title={i === 0 ? 'Nước của đối thủ trước khi bắt đầu' : undefined}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function PuzzleMeta({ puzzle }: { puzzle: Puzzle }) {
  return (
    <div className="rounded-xl bg-panel p-3 text-sm">
      <div className="mb-2 flex justify-between">
        <span className="text-muted">Puzzle #{puzzle.id}</span>
        <span>
          Độ khó <b>{puzzle.rating}</b>
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {puzzle.themes.map((t) => (
          <span key={t} className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
            {themeName(t)}
          </span>
        ))}
      </div>
    </div>
  );
}
