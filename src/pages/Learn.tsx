import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Board, type Shape } from '../components/Board';
import { LESSONS, type Lesson, type LessonStep } from '../content/lessons';
import { legalDests, moveSquares } from '../core/game';
import { MateSolver } from '../core/mate';
import { playSound } from '../core/sound';
import { Position, makeMove, moveToUci, parseSquare, uciToMove } from '../core/xiangqi';
import type { Settings } from '../data/db';
import { completeLesson, useCompletedLessons, useProfile } from '../data/store';

export function Learn() {
  const { id } = useParams();
  const lesson = LESSONS.find((l) => l.id === id);
  return lesson ? <LessonPlayer key={lesson.id} lesson={lesson} /> : <LessonList />;
}

function LessonList() {
  const done = useCompletedLessons();
  if (!done) return null;
  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold">Học luật cờ tướng</h1>
      <p className="mb-5 text-muted">
        Các bài học tương tác từ cách đi từng quân đến các thế sát kinh điển. Đã học {LESSONS.filter((l) => done.has(l.id)).length}/{LESSONS.length} bài.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LESSONS.map((l, i) => (
          <Link key={l.id} to={`/learn/${l.id}`} className={`card flex gap-3 transition-colors hover:bg-panel-2 ${done.has(l.id) ? 'border border-good/40' : ''}`}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f3dfb6] font-serif text-2xl text-[#c0161c]">{l.icon}</span>
            <span>
              <span className="block text-xs text-muted">Bài {i + 1}</span>
              <span className="block font-semibold">
                {l.title} {done.has(l.id) && <span className="text-good">✓</span>}
              </span>
              <span className="block text-xs text-muted">{l.summary}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const profile = useProfile();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  if (!profile) return null;
  const step = lesson.steps[index];
  const lessonIndex = LESSONS.indexOf(lesson);
  const next = LESSONS[lessonIndex + 1];

  const advance = () => {
    if (index + 1 < lesson.steps.length) setIndex(index + 1);
    else {
      setFinished(true);
      void completeLesson(lesson.id);
    }
  };

  return (
    <div>
      <Link to="/learn" className="link mb-3 inline-block text-sm">
        ← Tất cả bài học
      </Link>
      {finished ? (
        <div className="card mx-auto max-w-lg text-center">
          <div className="text-5xl">🎉</div>
          <div className="mt-2 text-xl font-bold">Hoàn thành bài “{lesson.title}”!</div>
          <div className="mt-4 flex justify-center gap-2">
            {next ? (
              <button className="btn btn-primary" onClick={() => navigate(`/learn/${next.id}`)}>
                Bài tiếp theo: {next.title} →
              </button>
            ) : (
              <Link className="btn btn-primary" to="/puzzles">
                Luyện puzzle →
              </Link>
            )}
            <button
              className="btn"
              onClick={() => {
                setIndex(0);
                setFinished(false);
              }}
            >
              Học lại
            </button>
          </div>
        </div>
      ) : (
        <StepView key={index} lesson={lesson} step={step} index={index} settings={profile.settings} onDone={advance} onBack={() => setIndex(Math.max(0, index - 1))} />
      )}
    </div>
  );
}

function StepView(props: { lesson: Lesson; step: LessonStep; index: number; settings: Settings; onDone: () => void; onBack: () => void }) {
  const { lesson, step, index, settings, onDone, onBack } = props;
  const [fen, setFen] = useState(step.fen);
  const [lastMove, setLastMove] = useState<[number, number] | undefined>();
  const [solved, setSolved] = useState(step.type === 'explain');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [found, setFound] = useState<number[]>([]);
  const [wrong, setWrong] = useState<number[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [syncKey, setSyncKey] = useState(0);
  const timer = useRef<number>(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const pos = useMemo(() => new Position(fen), [fen]);
  const targets = useMemo(() => {
    if (step.type !== 'dests') return [];
    return legalDests(new Position(step.fen)).get(parseSquare(step.square)) ?? [];
  }, [step]);

  const interactive = (step.type === 'move' || step.type === 'mate') && !solved;
  const dests = useMemo(() => (interactive ? legalDests(pos) : new Map<number, number[]>()), [pos, interactive]);

  const onMove = (from: number, to: number) => {
    const uci = moveToUci(makeMove(from, to));
    const p = new Position(fen);
    const captured = p.board[to] !== 0;
    p.play(uciToMove(uci));
    let ok = false;
    if (step.type === 'move') ok = step.anyLegal === true || step.solution.includes(uci);
    if (step.type === 'mate') ok = !p.hasLegalMove();
    if (!ok) {
      playSound('error');
      setFeedback({ ok: false, text: step.type === 'mate' ? 'Nước này chưa chiếu hết. Thử lại nhé!' : 'Chưa đúng, thử lại nhé!' });
      setSyncKey((k) => k + 1);
      return;
    }
    playSound(step.type === 'mate' ? 'success' : captured ? 'capture' : 'move');
    setFen(p.fen());
    setLastMove([from, to]);
    setSolved(true);
    setShowHint(false);
    setFeedback({ ok: true, text: ('success' in step && step.success) || 'Chính xác!' });
    if (step.type === 'move' && step.reply) {
      const reply = step.reply;
      timer.current = window.setTimeout(() => {
        const q = new Position(p.fen());
        q.play(uciToMove(reply));
        playSound('move');
        setFen(q.fen());
        setLastMove(moveSquares(reply));
      }, 600);
    }
  };

  const onSquareClick = (sq: number) => {
    if (step.type !== 'dests' || solved) return;
    if (found.includes(sq)) return;
    if (targets.includes(sq)) {
      const f = [...found, sq];
      setFound(f);
      playSound('move');
      if (f.length === targets.length) {
        setSolved(true);
        playSound('success');
        setFeedback({ ok: true, text: `Đúng hết ${targets.length} điểm!` });
      }
    } else {
      playSound('error');
      setWrong((w) => [...w, sq]);
      setFeedback({ ok: false, text: 'Quân này không đi tới điểm đó được.' });
      timer.current = window.setTimeout(() => setWrong([]), 700);
    }
  };

  const shapes: Shape[] = [];
  if (step.type === 'explain') {
    for (const a of step.arrows ?? []) {
      const s = moveSquares(a);
      if (s) shapes.push({ from: s[0], to: s[1], color: 'green' });
    }
  }
  if (showHint && step.type === 'move' && step.solution[0]) {
    const s = moveSquares(step.solution[0])!;
    shapes.push({ from: s[0], to: s[1], color: 'blue' });
  }
  if (showHint && step.type === 'mate') {
    const m = new MateSolver(new Position(step.fen)).winningMoves(1, true)[0];
    if (m) shapes.push({ from: m & 255, to: m >> 8, color: 'blue' });
  }
  if (showHint && step.type === 'dests') for (const t of targets) if (!found.includes(t)) shapes.push({ from: t, color: 'blue' });
  if (step.type === 'dests') shapes.push({ from: parseSquare(step.square), color: 'yellow' });
  for (const w of wrong) shapes.push({ from: w, color: 'red' });

  const marks = step.type === 'explain' ? (step.marks ?? []).map(parseSquare) : step.type === 'dests' ? found : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="mx-auto w-full max-w-[min(100%,calc((100vh-150px)*0.84))]">
        <Board
          fen={fen}
          orientation={step.type === 'move' && new Position(step.fen).turn === 1 ? 1 : 0}
          movable={interactive ? pos.turn : undefined}
          dests={dests}
          lastMove={lastMove}
          check={pos.inCheck() ? pos.kings[pos.turn] : undefined}
          shapes={shapes}
          marks={marks}
          coordinates={settings.coordinates}
          animation={settings.animation}
          theme={settings.boardTheme}
          pieceStyle={settings.pieceStyle}
          syncKey={syncKey}
          onMove={onMove}
          onSquareClick={onSquareClick}
        />
      </div>
      <aside className="flex flex-col gap-3">
        <div className="card">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{lesson.title}</span>
            <span>
              Bước {index + 1}/{lesson.steps.length}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-accent" style={{ width: `${((index + (solved ? 1 : 0)) / lesson.steps.length) * 100}%` }} />
          </div>
          <p className="mt-3 leading-relaxed">{step.text}</p>
          {step.type === 'dests' && !solved && (
            <p className="mt-2 text-sm text-muted">
              Đã tìm {found.length}/{targets.length} điểm.
            </p>
          )}
        </div>
        {feedback && <div className={`rounded-xl p-3 text-sm font-semibold ${feedback.ok ? 'bg-good/20 text-good' : 'bg-bad/20 text-bad'}`}>{feedback.text}</div>}
        <div className="flex flex-wrap gap-2">
          {index > 0 && (
            <button className="btn" onClick={onBack}>
              ← Trước
            </button>
          )}
          {!solved && step.type !== 'explain' && !(step.type === 'move' && step.anyLegal) && (
            <button className="btn" onClick={() => setShowHint(true)}>
              💡 Gợi ý
            </button>
          )}
          <button className="btn btn-primary flex-1" onClick={onDone} disabled={!solved}>
            {index + 1 < lesson.steps.length ? 'Tiếp →' : 'Hoàn thành'}
          </button>
        </div>
      </aside>
    </div>
  );
}
