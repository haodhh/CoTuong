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
  /** The book's main line, in UCCI notation. */
  moves: string[];
  /** Whether the main line ends in mate. */
  mate: boolean;
}

type Row = [string, string, number, string, string, number, 0 | 1, string, string, number];

let cache: Promise<CoThe[]> | undefined;

export function loadCoThe(): Promise<CoThe[]> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/cothe.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`Không tải được dữ liệu cờ thế (${res.status})`);
      return res.json() as Promise<{ entries: Row[] }>;
    })
    .then((d) => d.entries.map(parseRow))
    .catch((e) => {
      cache = undefined;
      throw e;
    });
  return cache;
}

export function parseRow([id, book, no, title, titleVi, win, side, fen, moves, mate]: Row): CoThe {
  return { id, book, no, title, titleVi, goal: win ? 'win' : 'draw', side, fen, moves: moves ? moves.split(' ') : [], mate: mate === 1 };
}

/** Moves the player makes in the book's main line. */
export function playerMoves(p: CoThe): number {
  const first = p.fen.split(' ')[1] === 'b' ? 1 : 0;
  const n = p.moves.length;
  // Player moves on the plies with the player's colour to move.
  let count = 0;
  for (let i = 0; i < n; i++) if ((first + i) % 2 === p.side) count++;
  return count;
}
