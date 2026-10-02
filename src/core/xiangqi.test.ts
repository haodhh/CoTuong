import { describe, expect, it } from 'vitest';
import { Position, REP_DRAW, REP_LOSS, REP_WIN, START_FEN, moveToUci, uciToMove } from './xiangqi';

function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of pos.generate([])) {
    if (!pos.play(m)) continue;
    n += perft(pos, depth - 1);
    pos.undo();
  }
  return n;
}

const playAll = (pos: Position, moves: string) => {
  for (const uci of moves.split(' ')) {
    const m = uciToMove(uci);
    if (!pos.isLegal(m)) throw new Error(`illegal ${uci}`);
    pos.play(m);
  }
};

describe('Position', () => {
  it('round-trips FEN', () => {
    expect(new Position(START_FEN).fen()).toBe(START_FEN);
    const fen = '3k5/4a4/9/9/9/9/9/9/4A4/4K4 b - - 3 20';
    expect(new Position(fen).fen()).toBe(fen);
  });

  it('matches known perft counts from the start position', () => {
    const pos = new Position();
    expect(perft(pos, 1)).toBe(44);
    expect(perft(pos, 2)).toBe(1920);
    expect(perft(pos, 3)).toBe(79666);
    expect(pos.fen()).toBe(START_FEN);
  });

  it('restores hash keys after undo', () => {
    const pos = new Position();
    const { keyLo, keyHi } = pos;
    playAll(pos, 'h2e2 h9g7 h0g2 i9h9');
    for (let i = 0; i < 4; i++) pos.undo();
    expect([pos.keyLo, pos.keyHi]).toEqual([keyLo, keyHi]);
    expect(pos.fen()).toBe(START_FEN);
  });

  it('detects checks by every piece and the facing kings', () => {
    expect(new Position('4k4/9/9/9/9/9/9/9/9/4R1K2 b').inCheck()).toBe(true); // rook
    expect(new Position('4k4/9/4P4/9/9/9/9/4C4/9/3K5 b').inCheck()).toBe(true); // cannon over a screen
    expect(new Position('4k4/9/9/9/9/9/9/4C4/9/3K5 b').inCheck()).toBe(false); // cannon without a screen
    expect(new Position('4k4/9/3N5/9/9/9/9/9/9/3K5 b').inCheck()).toBe(true); // horse
    expect(new Position('4k4/4a4/3N5/9/9/9/9/9/9/3K5 b').inCheck()).toBe(true); // a piece next to the king is not the leg
    expect(new Position('4k4/3a5/3N5/9/9/9/9/9/9/3K5 b').inCheck()).toBe(false); // leg blocked
    expect(new Position('4k4/4P4/9/9/9/9/9/9/9/3K5 b').inCheck()).toBe(true); // pawn in front
    expect(new Position('3Pk4/9/9/9/9/9/9/9/9/3K5 b').inCheck()).toBe(true); // pawn beside
    expect(new Position('9/4k4/4P4/9/9/9/9/9/9/3K5 b').inCheck()).toBe(true);
    expect(new Position('9/4k4/9/9/9/9/9/9/9/4K4 b').inCheck()).toBe(true); // facing kings
  });

  it('forbids moves that expose the kings to each other', () => {
    const pos = new Position('4k4/9/9/9/9/9/9/9/4A4/4K4 w');
    expect(pos.legalMoves().map(moveToUci).sort()).toEqual(['e0d0', 'e0f0']);
    expect(pos.isLegal(uciToMove('e1d2'))).toBe(false);
  });

  it('treats a position with no legal moves as lost even without check', () => {
    // d8 is covered by the pawn and e9 would face the red king.
    const pos = new Position('3k5/2P6/9/9/9/9/9/9/9/4K4 b');
    expect(pos.inCheck()).toBe(false);
    expect(pos.hasLegalMove()).toBe(false);
  });

  it('decides repetitions by the perpetual check rule', () => {
    const pos = new Position('3k5/9/9/9/9/9/9/9/9/4K3R w');
    playAll(pos, 'i0i9 d9d8 i9i8 d8d9 i8i9 d9d8 i9i8 d8d9');
    // Red has checked on every move; on Red's turn the repetition counts against Red.
    expect(pos.repetition()).toBe(REP_LOSS);
    pos.undo();
    expect(pos.repetition()).toBe(REP_WIN);
    const quiet = new Position('3k5/9/9/9/9/9/9/9/9/R3K4 w');
    playAll(quiet, 'a0a1 d9d8 a1a0 d8d9');
    expect(quiet.repetition()).toBe(REP_DRAW);
    expect(quiet.repetitionCount()).toBe(1);
  });
});
