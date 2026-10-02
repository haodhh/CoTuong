import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PIECE_NAME } from '../core/notation';
import { Position, RED, SQUARES, fileOf, rankOf, sideOf, squareAt, typeOf, type Side } from '../core/xiangqi';
import type { BoardTheme, PieceStyle } from '../data/db';

export interface Shape {
  from: number;
  to?: number;
  color?: 'green' | 'blue' | 'red' | 'yellow';
}

export interface BoardProps {
  fen: string;
  /** Side shown at the bottom. */
  orientation: Side;
  /** Side the user may move; leave undefined to make the board read-only. */
  movable?: Side;
  /** Legal destinations by origin square (mailbox squares). */
  dests?: Map<number, number[]>;
  lastMove?: [number, number];
  /** Square of a king in check. */
  check?: number;
  shapes?: Shape[];
  /** Extra highlighted squares (lessons). */
  marks?: number[];
  coordinates?: boolean;
  animation?: boolean;
  theme?: BoardTheme;
  pieceStyle?: PieceStyle;
  /** Increment to drop the selection and any drag, e.g. after a rejected move. */
  syncKey?: number;
  onMove?: (from: number, to: number) => void;
  /** Called for clicks on squares when the board is not movable (quiz steps). */
  onSquareClick?: (sq: number) => void;
}

const CELL = 100;
const MARGIN = 50;
/** Extra room above and below the board for the file numbers. */
const MARGIN_Y = 85;
const W = MARGIN * 2 + CELL * 8;
const H = MARGIN_Y * 2 + CELL * 9;
const R = 44;

const HAN = [
  ['', '帥', '仕', '相', '傌', '俥', '炮', '兵'],
  ['', '將', '士', '象', '馬', '車', '砲', '卒'],
];

const SHAPE_COLORS = { green: '#15803d', blue: '#1d4ed8', red: '#dc2626', yellow: '#ca8a04' };

function toPoint(sq: number, orientation: Side) {
  const x = fileOf(sq);
  const y = rankOf(sq);
  const col = orientation === RED ? x : 8 - x;
  const row = orientation === RED ? 9 - y : y;
  return { px: MARGIN + col * CELL, py: MARGIN_Y + row * CELL };
}

function fromPoint(px: number, py: number, orientation: Side): number {
  const col = Math.round((px - MARGIN) / CELL);
  const row = Math.round((py - MARGIN_Y) / CELL);
  if (col < 0 || col > 8 || row < 0 || row > 9) return 0;
  const x = orientation === RED ? col : 8 - col;
  const y = orientation === RED ? 9 - row : row;
  return squareAt(x, y);
}

interface Drag {
  from: number;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
}

export function Board(props: BoardProps) {
  const { fen, orientation, movable, dests, lastMove, check, shapes, marks, syncKey, animation = true } = props;
  const svg = useRef<SVGSVGElement>(null);
  const pieceEls = useRef(new Map<number, SVGGElement>());
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const skipAnimation = useRef(false);

  const pieces = useMemo(() => {
    const pos = new Position(fen);
    return SQUARES.filter((s) => pos.board[s]).map((s) => ({ sq: s, piece: pos.board[s] }));
  }, [fen]);

  useEffect(() => {
    setSelected(null);
    setDrag(null);
  }, [fen, syncKey, movable]);

  // Slide the piece that just moved from its origin.
  const lastKey = lastMove ? `${lastMove[0]}-${lastMove[1]}-${fen}` : '';
  useLayoutEffect(() => {
    if (!lastMove || !animation) return;
    if (skipAnimation.current) {
      skipAnimation.current = false;
      return;
    }
    const el = pieceEls.current.get(lastMove[1]);
    if (!el || typeof el.animate !== 'function') return;
    const a = toPoint(lastMove[0], orientation);
    const b = toPoint(lastMove[1], orientation);
    el.animate([{ transform: `translate(${a.px - b.px}px, ${a.py - b.py}px)` }, { transform: 'translate(0px, 0px)' }], {
      duration: 220,
      easing: 'ease-out',
    });
  }, [lastKey]);

  const svgPoint = (e: React.PointerEvent) => {
    const el = svg.current!;
    const pt = el.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(el.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  };

  const pieceAt = (sq: number) => pieces.find((p) => p.sq === sq)?.piece ?? 0;
  const canPick = (sq: number) => {
    const p = pieceAt(sq);
    return movable !== undefined && p !== 0 && sideOf(p) === movable && (dests?.get(sq)?.length ?? 0) > 0;
  };
  const targets = selected !== null ? (dests?.get(selected) ?? []) : [];

  const tryMove = (from: number, to: number, dragged: boolean) => {
    if (dests?.get(from)?.includes(to)) {
      skipAnimation.current = dragged;
      setSelected(null);
      props.onMove?.(from, to);
      return true;
    }
    return false;
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const { x, y } = svgPoint(e);
    const sq = fromPoint(x, y, orientation);
    if (!sq) {
      setSelected(null);
      return;
    }
    if (movable === undefined) {
      props.onSquareClick?.(sq);
      return;
    }
    if (selected !== null && selected !== sq && !canPick(sq)) {
      if (!tryMove(selected, sq, false)) setSelected(null);
      return;
    }
    if (canPick(sq)) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setSelected(sq);
      setDrag({ from: sq, pointerId: e.pointerId, startX: x, startY: y, x, y, moved: false });
    } else {
      setSelected(null);
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { x, y } = svgPoint(e);
    const moved = drag.moved || Math.hypot(x - drag.startX, y - drag.startY) > 18;
    setDrag({ ...drag, x, y, moved });
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    setDrag(null);
    if (!drag.moved) return;
    const { x, y } = svgPoint(e);
    const to = fromPoint(x, y, orientation);
    if (!to || !tryMove(drag.from, to, true)) {
      if (to !== drag.from) setSelected(null);
    }
  };

  const theme = props.theme ?? 'wood';
  const style = props.pieceStyle ?? 'han';

  return (
    <div className={`board-${theme} relative w-full select-none`} style={{ aspectRatio: `${W} / ${H}` }}>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-full w-full touch-none rounded-md"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
        role="img"
        aria-label="Bàn cờ tướng"
      >
        <defs>
          <radialGradient id="piece-face" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#fffaf0" />
            <stop offset="70%" stopColor="#f3dfb6" />
            <stop offset="100%" stopColor="#d9b97f" />
          </radialGradient>
          {Object.entries(SHAPE_COLORS).map(([name, color]) => (
            <marker key={name} id={`arrow-${name}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3" markerHeight="3" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill={color} />
            </marker>
          ))}
        </defs>
        <BoardGrid coordinates={props.coordinates ?? true} style={style} />

        {lastMove &&
          lastMove.map((sq, i) => {
            const { px, py } = toPoint(sq, orientation);
            return <rect key={i} x={px - 46} y={py - 46} width={92} height={92} rx={10} className="last-move" />;
          })}
        {marks?.map((sq) => {
          const { px, py } = toPoint(sq, orientation);
          return <circle key={`m${sq}`} cx={px} cy={py} r={48} className="mark" />;
        })}

        {pieces.map(({ sq, piece }) => {
          const { px, py } = toPoint(sq, orientation);
          const dragging = drag?.moved && drag.from === sq;
          return (
            <g key={`${sq}-${piece}`} transform={`translate(${px} ${py})`} style={{ opacity: dragging ? 0.35 : 1 }}>
              <g
                ref={(el) => {
                  if (el) pieceEls.current.set(sq, el);
                  else pieceEls.current.delete(sq);
                }}
              >
                <PieceShape piece={piece} style={style} selected={selected === sq} check={check === sq} />
              </g>
            </g>
          );
        })}

        {targets.map((sq) => {
          const { px, py } = toPoint(sq, orientation);
          return pieceAt(sq) ? (
            <circle key={`t${sq}`} cx={px} cy={py} r={47} className="dest-capture" />
          ) : (
            <circle key={`t${sq}`} cx={px} cy={py} r={13} className="dest" />
          );
        })}

        {shapes?.map((s, i) => {
          const color = SHAPE_COLORS[s.color ?? 'green'];
          const a = toPoint(s.from, orientation);
          if (s.to === undefined) {
            return <circle key={`s${i}`} cx={a.px} cy={a.py} r={46} fill="none" stroke={color} strokeWidth={7} opacity={0.85} />;
          }
          const b = toPoint(s.to, orientation);
          const len = Math.hypot(b.px - a.px, b.py - a.py);
          const ex = b.px - ((b.px - a.px) / len) * 26;
          const ey = b.py - ((b.py - a.py) / len) * 26;
          return (
            <line
              key={`s${i}`}
              x1={a.px}
              y1={a.py}
              x2={ex}
              y2={ey}
              stroke={color}
              strokeWidth={14}
              strokeLinecap="round"
              opacity={0.75}
              markerEnd={`url(#arrow-${s.color ?? 'green'})`}
              pointerEvents="none"
            />
          );
        })}

        {drag?.moved && (
          <g transform={`translate(${drag.x} ${drag.y}) scale(1.1)`} pointerEvents="none">
            <PieceShape piece={pieceAt(drag.from)} style={style} />
          </g>
        )}
      </svg>
    </div>
  );
}

const PieceShape = memo(function PieceShape({
  piece,
  style,
  selected,
  check,
}: {
  piece: number;
  style: PieceStyle;
  selected?: boolean;
  check?: boolean;
}) {
  const side = sideOf(piece);
  const type = typeOf(piece);
  const color = side === RED ? '#c0161c' : '#1c1917';
  const label = style === 'han' ? HAN[side][type] : PIECE_NAME[type];
  return (
    <>
      {check && <circle r={R + 6} fill="rgba(239,68,68,0.55)" className="check-glow" />}
      <circle r={R} cy={4} fill="rgba(0,0,0,0.35)" />
      <circle r={R} fill="url(#piece-face)" stroke={selected ? '#16a34a' : '#7c5a2c'} strokeWidth={selected ? 6 : 2.5} />
      <circle r={R - 7} fill="none" stroke={color} strokeWidth={2.5} />
      {style === 'han' ? (
        <text
          y={2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={50}
          fontWeight={700}
          fill={color}
          fontFamily="'Noto Serif SC', 'KaiTi', 'STKaiti', 'Songti SC', 'SimSun', serif"
        >
          {label}
        </text>
      ) : (
        <text
          y={1}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={label.length > 3 ? 23 : 28}
          fontWeight={800}
          fill={color}
          fontFamily="system-ui, 'Segoe UI', Roboto, sans-serif"
        >
          {label}
        </text>
      )}
    </>
  );
});

/** The grid is symmetric, so it does not depend on the orientation; file numbers count from each side's right. */
const BoardGrid = memo(function BoardGrid({ coordinates, style }: { coordinates: boolean; style: PieceStyle }) {
  const lines: React.ReactNode[] = [];
  const X = (c: number) => MARGIN + c * CELL;
  const Y = (r: number) => MARGIN_Y + r * CELL;
  for (let r = 0; r < 10; r++) lines.push(<line key={`h${r}`} x1={X(0)} y1={Y(r)} x2={X(8)} y2={Y(r)} />);
  for (let c = 0; c < 9; c++) {
    if (c === 0 || c === 8) lines.push(<line key={`v${c}`} x1={X(c)} y1={Y(0)} x2={X(c)} y2={Y(9)} />);
    else {
      lines.push(<line key={`v${c}a`} x1={X(c)} y1={Y(0)} x2={X(c)} y2={Y(4)} />);
      lines.push(<line key={`v${c}b`} x1={X(c)} y1={Y(5)} x2={X(c)} y2={Y(9)} />);
    }
  }
  // Palaces.
  for (const [r0, r1] of [
    [0, 2],
    [7, 9],
  ]) {
    lines.push(<line key={`p${r0}a`} x1={X(3)} y1={Y(r0)} x2={X(5)} y2={Y(r1)} />);
    lines.push(<line key={`p${r0}b`} x1={X(5)} y1={Y(r0)} x2={X(3)} y2={Y(r1)} />);
  }
  // Position marks for cannons and pawns.
  const marks: [number, number][] = [
    [1, 2],
    [7, 2],
    [1, 7],
    [7, 7],
    ...[0, 2, 4, 6, 8].flatMap((c) => [
      [c, 3] as [number, number],
      [c, 6] as [number, number],
    ]),
  ];
  const ticks = marks.flatMap(([c, r]) => {
    const cx = X(c);
    const cy = Y(r);
    const g = 8;
    const l = 18;
    const out: React.ReactNode[] = [];
    for (const sx of [-1, 1]) {
      if ((c === 0 && sx === -1) || (c === 8 && sx === 1)) continue;
      for (const sy of [-1, 1]) {
        out.push(
          <polyline
            key={`k${c}-${r}-${sx}-${sy}`}
            points={`${cx + sx * g},${cy + sy * (g + l)} ${cx + sx * g},${cy + sy * g} ${cx + sx * (g + l)},${cy + sy * g}`}
            fill="none"
          />,
        );
      }
    }
    return out;
  });
  const river = style === 'han' ? ['楚 河', '漢 界'] : ['SÔNG', 'GIỚI HÀ'];
  return (
    <g className="grid-lines">
      <rect x={0} y={0} width={W} height={H} className="board-bg" />
      <rect x={X(0) - 8} y={Y(0) - 8} width={CELL * 8 + 16} height={CELL * 9 + 16} fill="none" strokeWidth={5} />
      {lines}
      {ticks}
      <text x={X(2)} y={Y(4.5)} className="river" textAnchor="middle" dominantBaseline="central">
        {river[0]}
      </text>
      <text x={X(6)} y={Y(4.5)} className="river" textAnchor="middle" dominantBaseline="central">
        {river[1]}
      </text>
      {coordinates &&
        Array.from({ length: 9 }, (_, c) => (
          <g key={`c${c}`} className="coords">
            <text x={X(c)} y={24} textAnchor="middle" dominantBaseline="central">
              {c + 1}
            </text>
            <text x={X(c)} y={H - 24} textAnchor="middle" dominantBaseline="central">
              {9 - c}
            </text>
          </g>
        ))}
    </g>
  );
});
