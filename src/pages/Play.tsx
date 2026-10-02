import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { GameView } from '../components/GameView';
import { sideName } from '../core/game';
import { HANDICAPS, handicapFen } from '../core/setups';
import { BLACK, RED, START_FEN, type Side } from '../core/xiangqi';
import type { GameRecord } from '../data/db';
import { getGame, saveGame, unfinishedGame, useProfile } from '../data/store';
import { BOT_LEVELS, botLevel } from '../engine/levels';

const PREFS_KEY = 'cotuong-play-prefs';

interface Prefs {
  level: number;
  side: 'red' | 'black' | 'random';
  handicap: string;
}

function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Prefs | null;
    if (p) return p;
  } catch {
    // Storage can be unavailable (private mode); fall back to defaults.
  }
  return { level: 2, side: 'red', handicap: 'none' };
}

function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // Not important if it cannot be saved.
  }
}

/** Loads the game from ?game=ID, if any. */
function useGameParam(): [GameRecord | null | undefined, (r: GameRecord | null) => void] {
  const [params] = useSearchParams();
  const id = Number(params.get('game'));
  const [record, setRecord] = useState<GameRecord | null | undefined>(id ? undefined : null);
  useEffect(() => {
    if (id) void getGame(id).then((g) => setRecord((cur) => (cur?.id === id ? cur : (g ?? null))));
    else setRecord(null);
  }, [id]);
  return [record, setRecord];
}

export function PlayBot() {
  const profile = useProfile();
  const navigate = useNavigate();
  const [record, setRecord] = useGameParam();
  const [prefs, setPrefs] = useState(loadPrefs);
  const [resume, setResume] = useState<GameRecord | undefined>();

  useEffect(() => {
    void unfinishedGame('bot').then(setResume);
  }, [record]);

  if (!profile || record === undefined) return null;

  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    savePrefs(next);
  };

  const start = async () => {
    const playerSide: Side = prefs.side === 'random' ? (Math.random() < 0.5 ? RED : BLACK) : prefs.side === 'red' ? RED : BLACK;
    const botSide = (1 - playerSide) as Side;
    const handicap = HANDICAPS.find((h) => h.id === prefs.handicap);
    const now = Date.now();
    const r: GameRecord = {
      ts: now,
      updatedAt: now,
      mode: 'bot',
      level: prefs.level,
      playerSide,
      startFen: handicapFen(prefs.handicap, botSide),
      moves: [],
      title: handicap && handicap.id !== 'none' ? `Máy ${handicap.name.toLowerCase()}` : undefined,
    };
    r.id = await saveGame(r);
    setRecord(r);
    navigate(`/play?game=${r.id}`, { replace: true });
  };

  if (record) {
    const level = botLevel(record.level ?? 3);
    return (
      <GameView
        key={record.id}
        record={record}
        settings={profile.settings}
        onChange={(r) => void saveGame(r)}
        header={
          <div className="card text-sm">
            <div className="font-semibold">
              Chơi với máy · {level.name} (cấp {level.level})
            </div>
            <div className="text-muted">
              Bạn cầm quân {sideName(record.playerSide ?? RED)}
              {record.title && ` · ${record.title}`}
            </div>
          </div>
        }
        endActions={
          <>
            <button
              className="btn btn-primary"
              onClick={() => {
                setRecord(null);
                navigate('/play', { replace: true });
              }}
            >
              Ván mới
            </button>
            <Link className="btn" to={`/analysis?game=${record.id}`}>
              🔍 Phân tích ván
            </Link>
          </>
        }
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <h1 className="text-2xl font-extrabold">Chơi với máy</h1>
      {resume && (
        <div className="card flex flex-wrap items-center gap-3 border border-warn/40">
          <div className="flex-1">
            <div className="font-semibold">Bạn có một ván đang dở</div>
            <div className="text-sm text-muted">
              Cấp {resume.level} · {resume.moves.length} nước · {new Date(resume.updatedAt).toLocaleString('vi-VN')}
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              setRecord(resume);
              navigate(`/play?game=${resume.id}`, { replace: true });
            }}
          >
            Tiếp tục
          </button>
        </div>
      )}

      <section className="card">
        <h2 className="mb-3 font-semibold">Độ khó</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BOT_LEVELS.map((l) => (
            <button
              key={l.level}
              onClick={() => update({ level: l.level })}
              className={`rounded-lg p-3 text-left transition-colors ${prefs.level === l.level ? 'bg-accent/25 ring-2 ring-accent' : 'bg-panel-2 hover:bg-white/10'}`}
            >
              <div className="text-xs text-muted">Cấp {l.level}</div>
              <div className="font-bold">{l.name}</div>
              <div className="mt-1 text-xs text-muted">{l.desc}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">Bạn cầm quân</h2>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['red', '🔴 Đỏ (đi trước)'],
              ['black', '⚫ Đen'],
              ['random', '🎲 Ngẫu nhiên'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} className={`chip ${prefs.side === id ? 'chip-on' : ''}`} onClick={() => update({ side: id })}>
              {label}
            </button>
          ))}
        </div>
        <h2 className="mt-5 mb-1 font-semibold">Máy chấp quân</h2>
        <p className="mb-3 text-xs text-muted">Máy bỏ bớt quân khi bắt đầu, giúp bạn luyện với cấp cao hơn.</p>
        <div className="flex flex-wrap gap-2">
          {HANDICAPS.map((h) => (
            <button key={h.id} className={`chip ${prefs.handicap === h.id ? 'chip-on' : ''}`} onClick={() => update({ handicap: h.id })}>
              {h.name}
            </button>
          ))}
        </div>
      </section>

      <button className="btn btn-primary py-4 text-xl" onClick={start}>
        ▶ Bắt đầu
      </button>
    </div>
  );
}

export function PlayLocal() {
  const profile = useProfile();
  const navigate = useNavigate();
  const [record, setRecord] = useGameParam();
  const [resume, setResume] = useState<GameRecord | undefined>();

  useEffect(() => {
    void unfinishedGame('local').then(setResume);
  }, [record]);

  if (!profile || record === undefined) return null;

  const start = async () => {
    const now = Date.now();
    const r: GameRecord = { ts: now, updatedAt: now, mode: 'local', startFen: START_FEN, moves: [] };
    r.id = await saveGame(r);
    setRecord(r);
    navigate(`/local?game=${r.id}`, { replace: true });
  };

  if (record) {
    return (
      <GameView
        key={record.id}
        record={record}
        settings={profile.settings}
        onChange={(r) => void saveGame(r)}
        header={
          <div className="card text-sm">
            <div className="font-semibold">Hai người chơi trên cùng máy</div>
            <div className="text-muted">Đỏ đi trước. Có thể đi lại không giới hạn.</div>
          </div>
        }
        endActions={
          <>
            <button className="btn btn-primary" onClick={start}>
              Ván mới
            </button>
            <Link className="btn" to={`/analysis?game=${record.id}`}>
              🔍 Phân tích ván
            </Link>
          </>
        }
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <h1 className="text-2xl font-extrabold">Hai người chơi</h1>
      <p className="text-muted">Chơi với bạn bè trên cùng một thiết bị. Ván cờ được lưu lại để xem và phân tích sau.</p>
      {resume && (
        <div className="card flex flex-wrap items-center gap-3 border border-warn/40">
          <div className="flex-1">
            <div className="font-semibold">Ván đang dở</div>
            <div className="text-sm text-muted">
              {resume.moves.length} nước · {new Date(resume.updatedAt).toLocaleString('vi-VN')}
            </div>
          </div>
          <button
            className="btn"
            onClick={() => {
              setRecord(resume);
              navigate(`/local?game=${resume.id}`, { replace: true });
            }}
          >
            Tiếp tục
          </button>
        </div>
      )}
      <button className="btn btn-primary py-4 text-xl" onClick={start}>
        ▶ Ván mới
      </button>
    </div>
  );
}
