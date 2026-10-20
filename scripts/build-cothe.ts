// Builds the "cờ thế" (composed and textbook problems) data in public/data/cothe/.
//
// Inputs are JSON-lines files with one problem per line, extracted from the XQF records of the
// manuals with the `cchess` Python library, plus the decoded QP positions of 绝对精妙杀局4000局
// solved by scripts/solve-mates.ts (see README → "Dữ liệu cờ thế"):
//   {"file": "残局/烂柯神机/一夫发难 红胜.xqf", "folder": "残局/烂柯神机", "name": "一夫发难 红胜",
//    "info": {"result": "1-0", ...}, "fen": "...", "main": ["h2e2", ...]}
// Vietnamese titles come from scripts/cothe/titles-vi.json (Chinese title → Vietnamese).
//
//   npx tsx scripts/build-cothe.ts a.jsonl b.jsonl ...            # write the data
//   npx tsx scripts/build-cothe.ts a.jsonl b.jsonl ... --titles   # titles still missing a translation

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { difficultyScore, levelOf } from '../src/core/difficulty';
import { BLACK, Position, RED, uciToMove, type Side } from '../src/core/xiangqi';

interface Raw {
  file: string;
  folder: string;
  name: string;
  info: Record<string, string>;
  fen: string;
  main: string[];
}

interface Entry {
  id: string;
  book: string;
  no: number;
  title: string;
  titleVi: string;
  goal: 'win' | 'draw';
  /** Side the player takes (0 = Red, 1 = Black). */
  side: Side;
  fen: string;
  moves: string[];
  mate: boolean;
  /** Difficulty score and level (1 easy … 4 very hard), see src/core/difficulty.ts. */
  score: number;
  level: number;
}

/**
 * What a title or file name says about the result: an explicit winner, "win" (the winner comes
 * from the record's result or is the side to move), or "draw".
 */
type Tag = 'red' | 'black' | 'win' | 'draw' | undefined;

interface Meta {
  no?: number;
  title: string;
  /** Fixed Vietnamese title (no lookup in titles-vi.json). */
  titleVi?: string;
  tag?: Tag;
}

interface BookDef {
  id: string;
  match: (r: Raw) => boolean;
  parse: (r: Raw) => Meta | null;
  /** In the street problems a 0-1 record is a refutation line (Red going wrong), not a problem. */
  skipBlackWins?: boolean;
}

/** Tag from a 红先胜 / 红胜 / 正和 style suffix. */
function suffixTag(s: string | undefined): Tag {
  if (!s) return undefined;
  if (/黑先?胜/.test(s)) return 'black';
  if (/胜/.test(s)) return 'red';
  if (/和/.test(s)) return 'draw';
  return undefined;
}

/** Tag from a material description such as 炮兵胜双士 or 车兵和车卒士. 难胜 ("hard to win") is a draw with best defence. */
const materialTag = (title: string): Tag => (/难胜/.test(title) ? 'draw' : /胜/.test(title) ? 'win' : /和/.test(title) ? 'draw' : undefined);

const TACTICS: Record<string, string> = {
  运子战术: 'Chiến thuật vận quân',
  兑换战术: 'Chiến thuật đổi quân',
  谋子战术: 'Chiến thuật mưu bắt quân',
  弃子战术: 'Chiến thuật thí quân',
  先弃后取战术: 'Chiến thuật thí trước bắt sau',
  引离战术: 'Chiến thuật dụ rời',
  引入战术: 'Chiến thuật dụ vào',
  媵位战术: 'Chiến thuật nhường đường',
  破坏战术: 'Chiến thuật phá thế phòng thủ',
  双重打击战术: 'Chiến thuật đòn kép',
  闪击战术: 'Chiến thuật đòn mở',
  闪将战术: 'Chiến thuật mở chiếu',
  牵制战术: 'Chiến thuật ghim quân',
  阻截战术: 'Chiến thuật chặn đường',
  控制战术: 'Chiến thuật khống chế',
  反击战术: 'Chiến thuật phản kích',
  心理战术: 'Chiến thuật tâm lý',
};

const BOOKS: BookDef[] = [
  // ---- Classic manuals ----
  {
    id: 'stnt',
    match: (r) => r.file.includes('适情雅趣550局'),
    parse: (r) => {
      const m = r.name.match(/第(\d+)局\s*(.+)/);
      return m ? { no: Number(m[1]), title: m[2].trim() } : null;
    },
  },
  {
    id: 'stnt360',
    match: (r) => r.file.includes('适情雅趣360局'),
    parse: (r) => {
      const m = r.name.match(/适情雅趣(\d+)\s*(.+)/);
      return m ? { no: Number(m[1]), title: m[2].trim() } : null;
    },
  },
  {
    id: 'giangho',
    match: (r) => r.folder.endsWith('江湖八大排局') || r.folder.endsWith('四大名局'),
    parse: (r) => ({ title: r.name.replace(/[-(（].*$/, '').trim() }),
    skipBlackWins: true,
  },
  {
    id: 'tieusong',
    match: (r) => r.folder.endsWith('蕉窗逸品'),
    parse: (r) => ({ title: r.name.trim() }),
  },
  {
    id: 'lankha',
    match: (r) => r.folder.endsWith('烂柯神机'),
    parse: (r) => {
      const m = r.name.match(/^(\S+)\s*(红先胜|红先和|红胜|正和|和)?/);
      return m ? { title: m[1], tag: suffixTag(m[2]) } : null;
    },
  },
  {
    id: 'tuongcuc',
    match: (r) => r.folder.endsWith('象局汇存'),
    parse: (r) => {
      const m = r.name.match(/第(\d+)局\s*([^(（\d]+)\d?\s*[(（]?(红胜|正和|红先胜|红先和)?/);
      return m ? { no: Number(m[1]) + (r.file.includes('二集') ? 100 : 0), title: m[2].trim(), tag: suffixTag(m[3]) } : null;
    },
  },
  {
    id: 'quattrung',
    match: (r) => r.file.includes('桔中秘残局谱'),
    parse: (r) => {
      const title = r.name.replace(/[（(][^)）]*[)）]/g, '').replace(/\d+$/, '').trim();
      return { title, tag: materialTag(title) };
    },
  },
  // ---- Modern books ----
  {
    id: 'khuybi',
    match: (r) => r.folder.includes('实用残局窥秘'),
    parse: (r) => {
      const m = r.name.match(/第(\d+)局\s*(.+)/);
      const section = Number(r.file.match(/\/(\d)、/)?.[1] ?? 0);
      return m ? { no: section * 100 + Number(m[1]), title: m[2].trim(), tag: materialTag(m[2]) } : null;
    },
  },
  {
    id: 'thucdung1',
    match: (r) => r.folder.includes('象棋实用残局》第一集'),
    parse: (r) => {
      const m = r.name.match(/第(\d+)局\s*(.+)/);
      return m ? { no: Number(m[1]), title: m[2].trim(), tag: materialTag(m[2]) } : null;
    },
  },
  {
    id: 'thucdung2',
    match: (r) => r.folder.includes('象棋实用残局》第二集'),
    parse: (r) => {
      const m = r.name.match(/第(\d+)局\s*(.+)/);
      return m ? { no: Number(m[1]), title: m[2].trim(), tag: materialTag(m[2]) } : null;
    },
  },
  {
    id: 'tuyetsat',
    match: (r) => r.folder.includes('象棋绝杀与妙和'),
    parse: (r) => ({ title: r.name.trim(), tag: /红胜局|红先胜/.test(r.file) ? 'red' : /和局|红先和/.test(r.file) ? 'draw' : undefined }),
  },
  {
    id: 'phaotot',
    match: (r) => r.folder.endsWith('炮卒专集'),
    parse: (r) => ({ title: r.name.trim(), tag: materialTag(r.name) }),
  },
  {
    id: 'xema',
    match: (r) => r.folder.endsWith('车马专集'),
    parse: (r) => {
      const m = r.name.match(/^(\d+)(.+)/);
      return m ? { no: Number(m[1]), title: m[2].trim() } : null;
    },
  },
  {
    id: 'tonghop',
    match: (r) => r.folder === '残局/残局',
    parse: (r) => {
      const m = r.name.match(/^(\S+?)\s*(红先胜|红先和|黑先胜|黑先和|红胜|正和)?$/);
      return m ? { title: m[1], tag: suffixTag(m[2]) } : null;
    },
  },
  {
    id: 'dieuthu',
    match: (r) => r.folder.includes('中局妙手300'),
    parse: (r) => {
      const chapter = r.file.match(/\/\d+\.([^/]+)\//)?.[1] ?? '';
      const no = Number(r.name.match(/\d+/)?.[0] ?? 0);
      const players = r.info.red && r.info.black ? `${r.info.red} 对 ${r.info.black}` : '';
      return TACTICS[chapter] ? { no, title: players || chapter, titleVi: TACTICS[chapter] } : null;
    },
  },
  {
    id: 'sat4000',
    match: (r) => r.folder.includes('绝对精妙杀局4000局'),
    parse: (r) => ({ title: `绝杀 ${r.name}`, titleVi: `Sát cục ${r.name}`, tag: 'red' }),
  },
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const inputs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (inputs.length === 0) throw new Error('usage: build-cothe.ts a.jsonl [b.jsonl ...] [--titles]');
const raws = inputs
  .flatMap((path) => readFileSync(path, 'utf8').split('\n'))
  .filter(Boolean)
  .map((l) => JSON.parse(l) as Raw)
  .filter((r) => r.fen && r.main);
const titlesVi = JSON.parse(readFileSync(join(root, 'scripts/cothe/titles-vi.json'), 'utf8')) as Record<string, string>;

const entries: Entry[] = [];
const seen = new Set<string>();
const missing = new Map<string, string>();
const dropped: Record<string, number> = {};
const drop = (book: string) => (dropped[book] = (dropped[book] ?? 0) + 1);

for (const book of BOOKS) {
  const rows = raws
    .filter(book.match)
    .map((r) => ({ r, meta: book.parse(r) }))
    .sort((a, b) => (a.meta?.no ?? 0) - (b.meta?.no ?? 0) || a.r.file.localeCompare(b.r.file, 'zh'));
  const ids = new Set<string>();
  for (const { r, meta } of rows) {
    if (!meta) {
      drop(book.id);
      continue;
    }
    let pos: Position;
    try {
      pos = new Position(r.fen);
    } catch {
      drop(book.id);
      continue;
    }
    // A legal start: both kings, and the side that just moved is not in check.
    if (!pos.kings[RED] || !pos.kings[BLACK] || pos.isInCheck((1 - pos.turn) as Side) || !pos.hasLegalMove()) {
      drop(book.id);
      continue;
    }
    const placement = r.fen.split(' ').slice(0, 2).join(' ');
    if (seen.has(placement)) continue;

    const start = new Position(r.fen);
    // Keep the main line up to the first move our rules reject.
    const moves: string[] = [];
    for (const uci of r.main) {
      const m = uciToMove(uci);
      if (!pos.isLegal(m)) break;
      pos.play(m);
      moves.push(uci);
    }
    const mate = moves.length > 0 && !pos.hasLegalMove();
    // The side that gave mate at the end of the line, if it ends in mate.
    const mater: Side | null = mate ? ((1 - pos.turn) as Side) : null;

    const result = r.info.result;
    const resultWinner: Side | null = result === '1-0' ? RED : result === '0-1' ? BLACK : null;
    let goal: 'win' | 'draw';
    let winner: Side | null = null;
    const tag = meta.tag;
    if (tag === 'red' || tag === 'black') {
      goal = 'win';
      winner = tag === 'red' ? RED : BLACK;
    } else if (tag === 'win' && result === '1/2-1/2') {
      goal = 'draw';
    } else if (tag === 'win') {
      goal = 'win';
      winner = resultWinner ?? mater ?? start.turn;
    } else if (tag === 'draw') {
      goal = 'draw';
    } else if (resultWinner !== null) {
      goal = 'win';
      winner = resultWinner;
    } else if (result === '1/2-1/2') {
      goal = 'draw';
    } else if (mater !== null) {
      goal = 'win';
      winner = mater;
    } else {
      goal = 'draw';
    }
    if (book.skipBlackWins && winner === BLACK) {
      drop(book.id);
      continue;
    }
    // For a win the player takes the winner; for a draw, the side to move.
    const side: Side = goal === 'win' ? winner! : start.turn;
    // If the opponent moves first, the book's first move is needed to start.
    if (side !== start.turn && moves.length === 0) {
      drop(book.id);
      continue;
    }
    // A line that ends with the player mated contradicts the problem; one that ends with the
    // player mating shows a win even if the record calls it a draw.
    if (mate && mater !== side) {
      drop(book.id);
      continue;
    }
    if (mate) goal = 'win';
    // The mate collection only stores positions: keep the ones the solver could solve (this also
    // drops a stray copy of the opening position).
    if (book.id === 'sat4000' && moves.length === 0) {
      drop(book.id);
      continue;
    }
    seen.add(placement);

    const titleVi = meta.titleVi ?? titlesVi[meta.title];
    if (!titleVi) missing.set(meta.title, book.id);
    let id = meta.no ? `${book.id}-${meta.no}` : `${book.id}-${ids.size + 1}`;
    if (book.id === 'sat4000') id = `${book.id}-${r.name}`;
    for (let k = 2; ids.has(id); k++) id = `${book.id}-${meta.no ?? ids.size + 1}-${k}`;
    ids.add(id);
    const score = difficultyScore({ fen: start.fen(), moves, side, goal });
    entries.push({
      id,
      book: book.id,
      no: meta.no ?? 0,
      title: meta.title,
      titleVi: titleVi ?? meta.title,
      goal,
      side,
      fen: start.fen(),
      moves,
      mate,
      score,
      level: levelOf(score),
    });
  }
}

if (process.argv.includes('--titles')) {
  console.log(JSON.stringify([...missing].map(([title, book]) => ({ title, book }))));
} else {
  // One file per book, plus an index, so a problem page only loads its own book.
  const outDir = join(root, 'public/data/cothe');
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(outDir)) rmSync(join(outDir, f));
  rmSync(join(root, 'public/data/cothe.json'), { force: true });
  const index = { version: 2, generatedAt: new Date().toISOString(), total: entries.length, books: [] as { id: string; count: number; file: string }[] };
  for (const book of BOOKS) {
    const own = entries.filter((e) => e.book === book.id);
    if (own.length === 0) continue;
    const file = `${book.id}.json`;
    writeFileSync(
      join(outDir, file),
      JSON.stringify({
        book: book.id,
        entries: own.map((e) => [
          e.id,
          e.book,
          e.no,
          e.title,
          e.titleVi,
          e.goal === 'win' ? 1 : 0,
          e.side,
          e.fen,
          e.moves.join(' '),
          e.mate ? 1 : 0,
          e.score,
          e.level,
        ]),
      }),
    );
    index.books.push({ id: book.id, count: own.length, file });
  }
  writeFileSync(join(outDir, 'index.json'), JSON.stringify(index, null, 1));
  console.error(`Wrote ${entries.length} problems:`, Object.fromEntries(index.books.map((b) => [b.id, b.count])));
  console.error('Dropped:', dropped);
  if (missing.size) console.error(`${missing.size} titles have no Vietnamese translation yet.`);
}
