// Builds public/data/cothe.json, the classic composed problems ("cờ thế") mode.
//
// Input is a JSON-lines file with one problem per line, extracted from XQF records of the classic
// manuals with the `cchess` Python library (see README → "Dữ liệu cờ thế"):
//   {"file": "残局/烂柯神机/一夫发难 红胜.xqf", "folder": "残局/烂柯神机", "name": "一夫发难 红胜",
//    "info": {"result": "1-0", ...}, "fen": "...", "main": ["h2e2", ...]}
// Vietnamese titles come from scripts/cothe/titles-vi.json (Chinese title → Hán-Việt reading).
//
//   npx tsx scripts/build-cothe.ts raw.jsonl            # write the data
//   npx tsx scripts/build-cothe.ts raw.jsonl --titles   # list titles still missing a reading

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLACK, Position, RED, uciToMove, type Side } from '../src/core/xiangqi';

interface Raw {
  file: string;
  folder: string;
  name: string;
  info: Record<string, string>;
  fen: string;
  main: string[];
}

export interface CoTheEntry {
  id: string;
  book: string;
  /** Number in the book, when the book numbers its problems. */
  no?: number;
  title: string;
  titleVi: string;
  goal: 'win' | 'draw';
  /** Side the player takes (0 = Red, 1 = Black). */
  side: Side;
  fen: string;
  /** The book's main line from `fen`, in UCCI notation. */
  moves: string[];
  /** Whether the main line ends with the opponent unable to move (mate). */
  mate: boolean;
}

interface BookDef {
  id: string;
  match: (r: Raw) => boolean;
  parse: (r: Raw) => { no?: number; title: string; tag?: string } | null;
}

const BOOKS: BookDef[] = [
  {
    id: 'stnt',
    match: (r) => r.file.includes('适情雅趣550局'),
    parse: (r) => {
      const m = r.name.match(/第(\d+)局\s*(.+)/);
      return m ? { no: Number(m[1]), title: m[2].trim() } : null;
    },
  },
  {
    id: 'giangho',
    match: (r) => r.folder.endsWith('江湖八大排局') || r.folder.endsWith('四大名局'),
    parse: (r) => ({ title: r.name.replace(/[-(（].*$/, '').trim() }),
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
      return m ? { title: m[1], tag: m[2] } : null;
    },
  },
  {
    id: 'tuongcuc',
    match: (r) => r.folder.endsWith('象局汇存'),
    parse: (r) => {
      const m = r.name.match(/第(\d+)局\s*([^(（\d]+)\d?\s*[(（]?(红胜|正和|红先胜|红先和)?/);
      return m ? { no: Number(m[1]) + (r.file.includes('二集') ? 100 : 0), title: m[2].trim(), tag: m[3] } : null;
    },
  },
  {
    id: 'quattrung',
    match: (r) => r.file.includes('桔中秘残局谱'),
    parse: (r) => {
      const title = r.name.replace(/[（(][^)）]*[)）]/g, '').replace(/\d+$/, '').trim();
      return { title, tag: title.includes('胜') ? '红胜' : title.includes('和') ? '正和' : undefined };
    },
  },
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawPath = process.argv[2];
if (!rawPath) throw new Error('usage: build-cothe.ts raw.jsonl [--titles]');
const raws = readFileSync(rawPath, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l) as Raw)
  .filter((r) => r.fen);
const titlesVi = JSON.parse(readFileSync(join(root, 'scripts/cothe/titles-vi.json'), 'utf8')) as Record<string, string>;

const entries: CoTheEntry[] = [];
const seen = new Set<string>();
const missing = new Set<string>();
let dropped = 0;

for (const book of BOOKS) {
  const rows = raws
    .filter(book.match)
    .map((r) => ({ r, meta: book.parse(r) }))
    .sort((a, b) => (a.meta?.no ?? 0) - (b.meta?.no ?? 0) || a.r.file.localeCompare(b.r.file, 'zh'));
  for (const { r, meta } of rows) {
    if (!meta) {
      dropped++;
      continue;
    }
    let pos: Position;
    try {
      pos = new Position(r.fen);
    } catch {
      dropped++;
      continue;
    }
    // A legal start: both kings, and the side that just moved is not in check.
    if (!pos.kings[RED] || !pos.kings[BLACK] || pos.isInCheck((1 - pos.turn) as Side) || !pos.hasLegalMove()) {
      dropped++;
      continue;
    }
    const placement = r.fen.split(' ').slice(0, 2).join(' ');
    if (seen.has(placement)) continue;

    // Keep the main line up to the first move our rules reject.
    const moves: string[] = [];
    for (const uci of r.main) {
      const m = uciToMove(uci);
      if (!pos.isLegal(m)) break;
      pos.play(m);
      moves.push(uci);
    }
    const mate = moves.length > 0 && !pos.hasLegalMove();

    const result = r.info.result;
    const tag = meta.tag ?? '';
    let goal: 'win' | 'draw' | null;
    if (/胜/.test(tag)) goal = 'win';
    else if (/和/.test(tag)) goal = 'draw';
    else if (result === '1-0') goal = 'win';
    else if (result === '1/2-1/2') goal = 'draw';
    else if (result === '0-1') goal = null; // refutation lines of the street problems
    else goal = mate ? 'win' : 'draw';
    if (!goal) {
      dropped++;
      continue;
    }

    const start = new Position(r.fen);
    // For a win the player takes the winner (Red in these books); for a draw, the side to move.
    const side: Side = goal === 'win' ? RED : start.turn;
    if (goal === 'win' && start.turn !== RED && moves.length === 0) {
      dropped++;
      continue;
    }
    seen.add(placement);
    const titleVi = titlesVi[meta.title];
    if (!titleVi) missing.add(meta.title);
    entries.push({
      // Numbered books keep the book's number in the id, so links stay stable when data is rebuilt.
      id: meta.no ? `${book.id}-${meta.no}` : `${book.id}-${entries.filter((e) => e.book === book.id).length + 1}`,
      book: book.id,
      no: meta.no,
      title: meta.title,
      titleVi: titleVi ?? meta.title,
      goal,
      side,
      fen: start.fen(),
      moves,
      mate,
    });
  }
}

if (process.argv.includes('--titles')) {
  console.log(JSON.stringify([...missing], null, 0));
} else {
  const out = join(root, 'public/data/cothe.json');
  writeFileSync(
    out,
    JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      entries: entries.map((e) => [e.id, e.book, e.no ?? 0, e.title, e.titleVi, e.goal === 'win' ? 1 : 0, e.side, e.fen, e.moves.join(' '), e.mate ? 1 : 0]),
    }),
  );
  const byBook = new Map<string, number>();
  for (const e of entries) byBook.set(e.book, (byBook.get(e.book) ?? 0) + 1);
  console.error(`Wrote ${entries.length} problems (${dropped} dropped):`, Object.fromEntries(byBook));
  if (missing.size) console.error(`${missing.size} titles have no Vietnamese reading yet.`);
}
