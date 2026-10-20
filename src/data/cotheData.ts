export interface CoThe {
  id: string;
  book: string;
  /** Number in the book (0 when the book does not number its problems). */
  no: number;
  title: string;
  titleVi: string;
  goal: 'win' | 'draw';
  /** Side the player takes (0 = Red, 1 = Black). */
  side: 0 | 1;
  fen: string;
  /** The main line, in UCCI notation. */
  moves: string[];
  /** Whether the main line ends in mate. */
  mate: boolean;
}

export interface CoTheIndex {
  total: number;
  books: { id: string; count: number; file: string }[];
}

type Row = [string, string, number, string, string, number, 0 | 1, string, string, number];

const url = (file: string) => `${import.meta.env.BASE_URL}data/cothe/${file}`;
let indexCache: Promise<CoTheIndex> | undefined;
const bookCache = new Map<string, Promise<CoThe[]>>();

async function fetchJson<T>(file: string): Promise<T> {
  const res = await fetch(url(file));
  if (!res.ok) throw new Error(`Không tải được dữ liệu cờ thế (${res.status})`);
  return res.json() as Promise<T>;
}

export function loadCoTheIndex(): Promise<CoTheIndex> {
  indexCache ??= fetchJson<CoTheIndex>('index.json').catch((e) => {
    indexCache = undefined;
    throw e;
  });
  return indexCache;
}

export function loadCoTheBook(book: string): Promise<CoThe[]> {
  let cached = bookCache.get(book);
  if (!cached) {
    cached = (async () => {
      const index = await loadCoTheIndex();
      const meta = index.books.find((b) => b.id === book);
      if (!meta) return [];
      const d = await fetchJson<{ entries: Row[] }>(meta.file);
      return d.entries.map(parseRow);
    })();
    cached.catch(() => bookCache.delete(book));
    bookCache.set(book, cached);
  }
  return cached;
}

export async function loadAllCoThe(): Promise<CoThe[]> {
  const index = await loadCoTheIndex();
  return (await Promise.all(index.books.map((b) => loadCoTheBook(b.id)))).flat();
}

/** Book id of a problem id such as "stnt-12". */
export const bookOfId = (id: string) => id.split('-')[0];

export function parseRow([id, book, no, title, titleVi, win, side, fen, moves, mate]: Row): CoThe {
  return { id, book, no, title, titleVi, goal: win ? 'win' : 'draw', side, fen, moves: moves ? moves.split(' ') : [], mate: mate === 1 };
}

/** Moves the player makes in the main line. */
export function playerMoves(p: CoThe): number {
  const first = p.fen.split(' ')[1] === 'b' ? 1 : 0;
  let count = 0;
  for (let i = 0; i < p.moves.length; i++) if ((first + i) % 2 === p.side) count++;
  return count;
}
