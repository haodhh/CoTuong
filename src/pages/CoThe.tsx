import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Board } from '../components/Board';
import { GameView, MoveTable } from '../components/GameView';
import { COTHE_BOOKS, cotheBook } from '../content/cotheBooks';
import { moveSquares, sideName, type Game, type GameResult } from '../core/game';
import { lineNotation } from '../core/notation';
import { Position, uciToMove, type Side } from '../core/xiangqi';
import { LEVELS } from '../core/difficulty';
import { bookOfId, loadCoTheBooks, loadCoTheIndex, playerMoves, type CoThe, type CoTheIndex } from '../data/cotheData';
import type { DrillResult, GameRecord, Settings } from '../data/db';
import { saveDrillResult, useDrillResults, useProfile } from '../data/store';

const PAGE = 24;
const BOT_MS = 1000;
const resultKey = (id: string) => `cothe:${id}`;

export type CoTheGroup = 'all' | 'classic' | 'modern';
export const GROUPS: { id: CoTheGroup; label: string; icon: string; desc: string }[] = [
  { id: 'all', label: 'Tất cả', icon: '📶', desc: 'Mọi thế cờ, xếp từ dễ đến khó.' },
  { id: 'classic', label: 'Cổ phổ', icon: '📜', desc: 'Các kỳ phổ cổ đời Minh, Thanh và thế cờ giang hồ.' },
  { id: 'modern', label: 'Sách hiện đại', icon: '📚', desc: 'Sách tàn cục, sát cục và chiến thuật in gần đây.' },
];

type Sort = 'easy' | 'hard' | 'book';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'easy', label: 'Từ dễ đến khó' },
  { id: 'hard', label: 'Từ khó đến dễ' },
  { id: 'book', label: 'Theo thứ tự trong sách' },
];

const bookOrder = new Map(COTHE_BOOKS.map((b, i) => [b.id, i]));
const byBook = (a: CoThe, b: CoThe) => (bookOrder.get(a.book) ?? 0) - (bookOrder.get(b.book) ?? 0);
const SORTERS: Record<Sort, (a: CoThe, b: CoThe) => number> = {
  easy: (a, b) => a.score - b.score || byBook(a, b),
  hard: (a, b) => b.score - a.score || byBook(a, b),
  // Data files are already in book order; keep it.
  book: () => 0,
};

/** Loads the given books (every book when `books` is undefined). */
function useCoThe(books: string[] | undefined) {
  const key = books ? books.join(',') : '*';
  const [state, setState] = useState<{ key: string; data?: CoThe[]; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    loadCoTheBooks(key === '*' ? undefined : key.split(',')).then(
      (data) => live && setState({ key, data }),
      (e) => live && setState({ key, error: String(e instanceof Error ? e.message : e) }),
    );
    return () => {
      live = false;
    };
  }, [key, attempt]);
  // Results belong to the books they were loaded for; switching books never shows stale ones.
  const current = state?.key === key ? state : null;
  const retry = () => {
    setState(null);
    setAttempt((a) => a + 1);
  };
  return { data: current?.data ?? null, error: current?.error ?? null, retry };
}

function useCoTheIndex() {
  const [index, setIndex] = useState<CoTheIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setError(null);
    loadCoTheIndex().then(
      (i) => live && setIndex(i),
      (e) => live && setError(String(e instanceof Error ? e.message : e)),
    );
    return () => {
      live = false;
    };
  }, [attempt]);
  return { index, error, retry: () => setAttempt((a) => a + 1) };
}

/** A load error with a way to try again (the network may be back). */
function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card text-center">
      <div className="font-semibold text-bad">Không tải được dữ liệu cờ thế</div>
      <div className="mt-1 text-sm text-muted">{message}</div>
      <div className="mt-3 flex justify-center gap-2">
        <button className="btn btn-primary" onClick={onRetry}>
          ↻ Thử lại
        </button>
        <button className="btn" onClick={() => window.location.reload()}>
          Tải lại trang
        </button>
      </div>
    </div>
  );
}

export function CoThePage() {
  const { id } = useParams();
  return id ? <CoTheProblem key={id} id={id} /> : <CoTheList />;
}

function CoTheProblem({ id }: { id: string }) {
  const { data, error, retry } = useCoThe([bookOfId(id)]);
  if (error) return <LoadError message={error} onRetry={retry} />;
  if (!data) return <div className="text-muted">Đang tải cờ thế…</div>;
  const problem = data.find((p) => p.id === id);
  if (!problem) return <div className="card">Không tìm thấy thế cờ này.</div>;
  return <CoThePlayer key={problem.id} problem={problem} siblings={data} />;
}

/** "cục 12", "tập 2 · cục 5" or "phần 3 · cục 7", depending on how the book numbers its problems. */
export function numberLabel(p: CoThe): string {
  if (!p.no) return '';
  if (p.book === 'tuongcuc' && p.no > 100) return `tập 2 · cục ${p.no - 100}`;
  if (p.book === 'khuybi') return `phần ${Math.floor(p.no / 100)} · cục ${p.no % 100}`;
  return `cục ${p.no}`;
}

export function goalText(p: CoThe): string {
  const toMove = new Position(p.fen).turn;
  const player = sideName(p.side);
  if (toMove === p.side) return `${player} đi trước ${p.goal === 'win' ? 'thắng' : 'hòa'}`;
  return `${sideName(toMove)} đi trước, ${p.goal === 'win' ? `${player} thắng` : 'hòa'}`;
}

function Stars({ n }: { n: number }) {
  return (
    <span>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= n ? 'text-warn' : 'text-white/15'}>
          ★
        </span>
      ))}
    </span>
  );
}

export function LevelBadge({ level }: { level: number }) {
  const l = LEVELS.find((x) => x.level === level);
  return l ? <span className={`rounded px-1.5 py-0.5 ${l.color}`}>{l.name}</span> : null;
}

/** Group of the URL: an explicit ?group=, or the group of an old ?book= link. */
function groupFromParams(params: URLSearchParams): CoTheGroup {
  const g = params.get('group');
  if (g === 'classic' || g === 'modern') return g;
  const book = params.get('book');
  return book ? (cotheBook(book)?.group ?? 'all') : 'all';
}

function CoTheList() {
  const profile = useProfile();
  const { index, error: indexError, retry: retryIndex } = useCoTheIndex();
  const results = useDrillResults();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const group = groupFromParams(params);
  const groupBooks = useMemo(
    () => COTHE_BOOKS.filter((b) => group !== 'all' && b.group === group && (index?.books.some((x) => x.id === b.id) ?? true)),
    [group, index],
  );
  const bookParam = params.get('book') ?? 'all';
  const book = group !== 'all' && groupBooks.some((b) => b.id === bookParam) ? bookParam : 'all';
  const goal = params.get('goal') ?? 'all';
  const level = Number(params.get('level') ?? '0');
  const status = params.get('status') ?? 'all';
  const query = params.get('q') ?? '';
  const pageParam = Math.max(1, Math.floor(Number(params.get('page') ?? '1')) || 1);
  // "Tất cả" is ordered from easy to hard; a single book keeps the book's order unless asked.
  const sortParam = params.get('sort');
  const sort: Sort = SORTS.some((s) => s.id === sortParam) ? (sortParam as Sort) : book !== 'all' ? 'book' : 'easy';

  const books = group === 'all' ? undefined : book !== 'all' ? [book] : groupBooks.map((b) => b.id);
  const { data, error, retry } = useCoThe(books);

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      // Defaults are left out of the URL ("0" is the default only for the level filter).
      if (!v || v === 'all' || (k === 'level' && v === '0')) next.delete(k);
      else next.set(k, v);
    }
    // Keep the menu explicit, so links that only named a book stay in their group.
    if (group !== 'all') next.set('group', group);
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };
  const chooseGroup = (g: CoTheGroup) => {
    // Switching the main menu starts fresh: no book or sort left over from the previous one.
    const next = new URLSearchParams();
    if (g !== 'all') next.set('group', g);
    setParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (data ?? []).filter((p) => {
      if (goal !== 'all' && p.goal !== goal) return false;
      if (level && p.level !== level) return false;
      const solved = (results?.get(resultKey(p.id))?.stars ?? 0) > 0;
      if (status === 'solved' && !solved) return false;
      if (status === 'unsolved' && solved) return false;
      if (q && !p.titleVi.toLowerCase().includes(q) && !p.title.includes(q) && String(p.no) !== q && !p.id.toLowerCase().includes(q)) return false;
      return true;
    });
    return sort === 'book' ? list : [...list].sort(SORTERS[sort]);
  }, [data, goal, level, status, query, results, sort]);

  if (indexError && !index) return <LoadError message={indexError} onRetry={retryIndex} />;
  if (!profile || !results || !index) return <div className="text-muted">Đang tải cờ thế…</div>;
  const count = (id: string) => index.books.find((b) => b.id === id)?.count ?? 0;
  const groupCount = (g: CoTheGroup) =>
    g === 'all' ? index.total : COTHE_BOOKS.filter((b) => b.group === g).reduce((s, b) => s + count(b.id), 0);
  const solvedIn = (ids: string[] | undefined) =>
    [...results.keys()].filter((k) => k.startsWith('cothe:') && (results.get(k)?.stars ?? 0) > 0 && (!ids || ids.includes(bookOfId(k.slice(6))))).length;
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  // The list can shrink under a saved page number (e.g. after solving the last unsolved problem).
  const page = Math.min(pages, pageParam);
  const shown = filtered.slice((page - 1) * PAGE, page * PAGE);
  const currentBook = book !== 'all' ? cotheBook(book) : undefined;
  const currentGroup = GROUPS.find((g) => g.id === group)!;

  const random = () => {
    const pool = filtered.filter((p) => !(results.get(resultKey(p.id))?.stars ?? 0));
    const list = pool.length ? pool : filtered;
    if (list.length) navigate(`/cothe/${list[Math.floor(Math.random() * list.length)].id}`);
  };

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold">Cờ thế</h1>
        <span className="text-sm text-muted">
          Đã giải <b className="text-warn">{solvedIn(undefined)}</b>/{index.total.toLocaleString('vi-VN')} thế
        </span>
      </div>
      <p className="mb-4 text-muted">
        Thế cờ (bài cục, tàn cục, sát cục) từ các cổ phổ và sách hiện đại. Đối thủ đi theo lời giải trong sách; nếu bạn đi khác sách, máy sẽ
        phòng thủ hết sức.
      </p>

      {/* Main menu */}
      <div className="mb-3 grid grid-cols-3 gap-2" role="tablist">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            role="tab"
            aria-selected={group === g.id}
            onClick={() => chooseGroup(g.id)}
            className={`rounded-xl px-3 py-2.5 text-left transition-colors ${group === g.id ? 'bg-accent text-white' : 'bg-panel hover:bg-panel-2'}`}
          >
            <div className="font-bold">
              {g.icon} {g.label}
            </div>
            <div className={`text-xs ${group === g.id ? 'text-white/80' : 'text-muted'}`}>{groupCount(g.id).toLocaleString('vi-VN')} thế</div>
          </button>
        ))}
      </div>

      {/* Sub-menu: the books of the chosen group */}
      {group !== 'all' && (
        // One scrolling row on phones, wrapped on wider screens.
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>button]:shrink-0 [&>button]:whitespace-nowrap">
          <button className={`chip ${book === 'all' ? 'chip-on' : ''}`} onClick={() => set({ book: 'all', sort: '' })}>
            Tất cả {currentGroup.label.toLowerCase()} ({groupCount(group)})
          </button>
          {groupBooks.map((b) => (
            <button key={b.id} className={`chip ${book === b.id ? 'chip-on' : ''}`} onClick={() => set({ book: b.id, sort: '' })}>
              {b.name} ({count(b.id)})
            </button>
          ))}
        </div>
      )}
      <div className="card mb-3 text-sm">
        {currentBook ? (
          <>
            <b>
              {currentBook.name} ({currentBook.zh})
            </b>
            <span className="text-muted"> · đã giải {solvedIn([currentBook.id])}/{count(currentBook.id)}</span>
            <p className="mt-1 text-muted">{currentBook.desc}</p>
          </>
        ) : (
          <>
            <b>{currentGroup.label}</b>
            <span className="text-muted">
              {' '}
              · đã giải {solvedIn(group === 'all' ? undefined : groupBooks.map((b) => b.id))}/{groupCount(group)}
            </span>
            <p className="mt-1 text-muted">{currentGroup.desc}</p>
          </>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className="rounded-lg bg-panel-2 px-3 py-1.5 text-sm" value={sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sắp xếp">
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select className="rounded-lg bg-panel-2 px-3 py-1.5 text-sm" value={level} onChange={(e) => set({ level: e.target.value })} aria-label="Độ khó">
          <option value={0}>Mọi độ khó</option>
          {LEVELS.map((l) => (
            <option key={l.level} value={l.level}>
              {l.name}
            </option>
          ))}
        </select>
        <select className="rounded-lg bg-panel-2 px-3 py-1.5 text-sm" value={goal} onChange={(e) => set({ goal: e.target.value })} aria-label="Mục tiêu">
          <option value="all">Thắng và hòa</option>
          <option value="win">Thế thắng</option>
          <option value="draw">Thế hòa</option>
        </select>
        <select className="rounded-lg bg-panel-2 px-3 py-1.5 text-sm" value={status} onChange={(e) => set({ status: e.target.value })} aria-label="Trạng thái">
          <option value="all">Mọi trạng thái</option>
          <option value="unsolved">Chưa giải</option>
          <option value="solved">Đã giải</option>
        </select>
        <input
          className="min-w-0 flex-1 rounded-lg bg-panel-2 px-3 py-1.5 text-sm sm:max-w-60"
          placeholder="Tìm tên thế cờ hoặc số cục…"
          value={query}
          onChange={(e) => set({ q: e.target.value })}
        />
        <button className="btn btn-sm btn-primary" onClick={random} disabled={filtered.length === 0}>
          🎲 Thế ngẫu nhiên
        </button>
      </div>

      {error ? (
        <LoadError message={error} onRetry={retry} />
      ) : !data ? (
        <div className="text-muted">Đang tải…</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center text-muted">Không có thế cờ nào phù hợp.</div>
      ) : (
        <>
          <div className="mb-2 text-xs text-muted">{filtered.length.toLocaleString('vi-VN')} thế</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((p) => (
              <CoTheCard key={p.id} p={p} settings={profile.settings} result={results.get(resultKey(p.id))} />
            ))}
          </div>
        </>
      )}

      {pages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-2 text-sm">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>
            ◀ Trước
          </button>
          <span className="text-muted">
            Trang {page}/{pages}
          </span>
          <button className="btn btn-sm" disabled={page >= pages} onClick={() => set({ page: String(page + 1) })}>
            Sau ▶
          </button>
        </div>
      )}
    </div>
  );
}

function CoTheCard({ p, settings, result }: { p: CoThe; settings: Settings; result?: DrillResult }) {
  const book = cotheBook(p.book);
  return (
    <Link to={`/cothe/${p.id}`} className={`card flex gap-3 transition-colors hover:bg-panel-2 ${result?.stars ? 'border border-good/40' : ''}`}>
      <div className="w-24 shrink-0">
        <Board fen={p.fen} orientation={p.side} coordinates={false} animation={false} theme={settings.boardTheme} pieceStyle={settings.pieceStyle} />
      </div>
      <div className="min-w-0 text-sm">
        <div className="font-semibold leading-tight">{p.titleVi}</div>
        <div className="text-xs text-muted">{p.title}</div>
        <div className="mt-1 text-xs text-muted">
          {book?.name}
          {p.no > 0 && ` · ${numberLabel(p)}`}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
          <LevelBadge level={p.level} />
          <span className={`rounded px-1.5 py-0.5 ${p.goal === 'win' ? 'bg-accent/30' : 'bg-sky-700/40'}`}>{p.goal === 'win' ? 'Thắng' : 'Hòa'}</span>
          {p.side === 1 && <span className="rounded bg-stone-900 px-1.5 py-0.5 ring-1 ring-stone-600">cầm Đen</span>}
          {p.moves.length > 0 && <span className="text-muted">{playerMoves(p)} nước</span>}
          {result && <Stars n={result.stars} />}
        </div>
      </div>
    </Link>
  );
}

function newRecord(p: CoThe): GameRecord {
  const now = Date.now();
  return { ts: now, updatedAt: now, mode: 'bot', playerSide: p.side, startFen: p.fen, moves: [], title: p.titleVi };
}

function CoThePlayer({ problem, siblings }: { problem: CoThe; siblings: CoThe[] }) {
  const profile = useProfile();
  const results = useDrillResults();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  const [record, setRecord] = useState<GameRecord>(() => newRecord(problem));
  const [outcome, setOutcome] = useState<{ success: boolean; stars: number } | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  // Looking at the solution during an attempt counts like a hint.
  const [peeked, setPeeked] = useState(false);

  const index = siblings.indexOf(problem);
  const prev = siblings[index - 1];
  const next = siblings[index + 1];
  const book = cotheBook(problem.book);
  const lineMoves = playerMoves(problem);
  const limit = problem.goal === 'win' ? Math.max(lineMoves + 10, 15) : Math.min(Math.max(lineMoves, 15), 40);
  const best = results?.get(resultKey(problem.id));

  if (!profile) return null;
  const side = problem.side as Side;
  const madeMoves = (game: Game) => {
    const first = new Position(problem.fen).turn;
    let n = 0;
    for (let i = 0; i < game.moves.length; i++) if ((first + i) % 2 === side) n++;
    return n;
  };

  // The opponent follows the book while the player does; afterwards the engine takes over.
  const scriptedMove = (moves: string[]) => {
    if (moves.length >= problem.moves.length) return null;
    for (let i = 0; i < moves.length; i++) if (moves[i] !== problem.moves[i]) return null;
    return problem.moves[moves.length];
  };

  const checkEnd = (game: Game): GameResult | null => {
    // Playing the whole main line solves the problem, even when the book stops before mate.
    const line = problem.moves;
    if (line.length > 0 && game.moves.length === line.length && game.moves.every((m, i) => m === line[i])) {
      return problem.goal === 'win' ? { winner: side, reason: 'book' } : { winner: null, reason: 'book' };
    }
    if (game.pos.turn !== side || madeMoves(game) < limit) return null;
    return problem.goal === 'win' ? { winner: (1 - side) as Side, reason: 'limit' } : { winner: null, reason: 'limit' };
  };

  const onEnd = (result: GameResult) => {
    const success = problem.goal === 'win' ? result.winner === side : result.winner !== 1 - side;
    if (!success) {
      setOutcome({ success: false, stars: 0 });
      return;
    }
    const stars = record.hints || peeked ? 1 : record.takebacks ? 2 : 3;
    setOutcome({ success: true, stars });
    void saveDrillResult(resultKey(problem.id), stars, record.moves.length);
  };

  const retry = () => {
    setOutcome(null);
    setShowSolution(false);
    setPeeked(false);
    setRecord(newRecord(problem));
    setAttempt((a) => a + 1);
  };

  const header = (
    <div className="card">
      <div className="text-xs text-muted">
        {book?.name} ({book?.zh}){problem.no > 0 && ` · ${numberLabel(problem)}`}
      </div>
      <div className="text-xl font-bold leading-tight">{problem.titleVi}</div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>{problem.title}</span>
        <span className="text-xs">
          <LevelBadge level={problem.level} />
        </span>
      </div>
      <div className="mt-2 rounded-lg bg-panel-2 px-3 py-2 text-sm">
        <b>{goalText(problem)}</b>
        <div className="text-xs text-muted">
          {problem.goal === 'win'
            ? lineMoves
              ? `Đi đúng hết lời giải (${lineMoves} nước), hoặc tự tìm cách thắng trong tối đa ${limit} nước.`
              : `Thắng trong tối đa ${limit} nước.`
            : lineMoves
              ? `Đi đúng hết lời giải (${lineMoves} nước), hoặc giữ không thua trong ${limit} nước.`
              : `Giữ không thua trong ${limit} nước.`}{' '}
          Đi đúng lời giải thì đối thủ cũng đáp theo lời giải.
        </div>
      </div>
      {best && (
        <div className="mt-2 text-sm text-muted">
          Kết quả tốt nhất: <Stars n={best.stars} />
        </div>
      )}
      {outcome && (
        <div className={`mt-3 rounded-lg p-3 text-center ${outcome.success ? 'bg-good/20' : 'bg-bad/20'}`}>
          {outcome.success ? (
            <>
              <div className="text-2xl">
                <Stars n={outcome.stars} />
              </div>
              <div className="text-sm font-semibold">Giải thành công!</div>
              {outcome.stars < 3 && <div className="text-xs text-muted">Không dùng gợi ý và không đi lại để được ★★★.</div>}
            </>
          ) : (
            <div className="text-sm font-semibold text-bad">Chưa giải được. Xem lời giải hoặc thử lại nhé!</div>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {problem.moves.length > 0 && (
          <button
            className="btn btn-sm"
            onClick={() => {
              // Seeing the solution counts unless the problem is already solved; after a loss the
              // attempt can continue with a takeback, so it counts then too.
              if (!showSolution && !outcome?.success) setPeeked(true);
              setShowSolution((s) => !s);
            }}
          >
            {showSolution ? '♟ Quay lại chơi' : '📖 Xem lời giải'}
          </button>
        )}
        <button className="btn btn-sm" onClick={retry}>
          ↻ Chơi lại
        </button>
        {prev && (
          <button className="btn btn-sm" onClick={() => navigate(`/cothe/${prev.id}`)}>
            ◀ Thế trước
          </button>
        )}
        {next && (
          <button className="btn btn-sm" onClick={() => navigate(`/cothe/${next.id}`)}>
            Thế sau ▶
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <Link to="/cothe" className="link mb-3 inline-block text-sm">
        ← Tất cả cờ thế
      </Link>
      {showSolution ? (
        <SolutionViewer problem={problem} settings={profile.settings} header={header} />
      ) : (
        <GameView
          key={attempt}
          record={record}
          settings={profile.settings}
          onChange={(r) => {
            setRecord(r);
            // A takeback after the end reopens the game.
            if (r.result === undefined) setOutcome(null);
          }}
          botTimeMs={BOT_MS}
          scriptedMove={scriptedMove}
          checkEnd={checkEnd}
          onEnd={onEnd}
          header={header}
          endActions={
            <>
              <button className="btn btn-primary" onClick={retry}>
                ↻ Thử lại
              </button>
              {next && (
                <button className="btn" onClick={() => navigate(`/cothe/${next.id}`)}>
                  Thế sau →
                </button>
              )}
            </>
          }
        />
      )}
    </div>
  );
}

function SolutionViewer({ problem, settings, header }: { problem: CoThe; settings: Settings; header: React.ReactNode }) {
  const [ply, setPly] = useState(0);
  const positions = useMemo(() => {
    const pos = new Position(problem.fen);
    const fens = [pos.fen()];
    for (const m of problem.moves) {
      pos.play(uciToMove(m));
      fens.push(pos.fen());
    }
    return fens;
  }, [problem]);
  const notation = useMemo(() => lineNotation(problem.fen, problem.moves.map(uciToMove)), [problem]);
  const pos = useMemo(() => new Position(positions[ply]), [positions, ply]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setPly((p) => Math.max(0, p - 1));
      if (e.key === 'ArrowRight') setPly((p) => Math.min(problem.moves.length, p + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [problem.moves.length]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="mx-auto w-full max-w-[min(100%,calc((100vh-150px)*0.84))]">
        <Board
          fen={positions[ply]}
          orientation={problem.side}
          lastMove={moveSquares(problem.moves[ply - 1])}
          check={pos.inCheck() ? pos.kings[pos.turn] : undefined}
          coordinates={settings.coordinates}
          animation={settings.animation}
          theme={settings.boardTheme}
          pieceStyle={settings.pieceStyle}
        />
      </div>
      <aside className="flex flex-col gap-3">
        {header}
        <div className="card text-sm">
          <b>{cotheBook(problem.book)?.computed ? 'Lời giải (do máy tìm)' : 'Lời giải trong sách'}</b>
          <div className="text-xs text-muted">
            Dùng ◀ ▶ hoặc phím mũi tên để xem từng nước.
            {ply === problem.moves.length &&
              (problem.mate ? (pos.inCheck() ? ' Kết thúc: chiếu hết.' : ' Kết thúc: bên bị vây hết nước đi (thua).') : problem.goal === 'draw' ? ' Kết thúc: hòa.' : '')}
          </div>
        </div>
        <MoveTable notation={notation} current={ply} onSelect={setPly} />
      </aside>
    </div>
  );
}
