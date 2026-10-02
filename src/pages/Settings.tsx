import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Board } from '../components/Board';
import type { BoardTheme, PieceStyle } from '../data/db';
import { chooseLevelAgain, exportBackup, importBackup, resetAll, updateSettings, useProfile } from '../data/store';

const BOARD_THEMES: { id: BoardTheme; name: string; bg: string; line: string }[] = [
  { id: 'wood', name: 'Gỗ', bg: '#e9c48a', line: '#6b4423' },
  { id: 'light', name: 'Giấy', bg: '#f4e6c8', line: '#8a6a44' },
  { id: 'green', name: 'Xanh', bg: '#cfdcae', line: '#3f5a2a' },
  { id: 'dark', name: 'Tối', bg: '#4a3b30', line: '#d9c3a0' },
];

const PIECE_STYLES: { id: PieceStyle; name: string; desc: string }[] = [
  { id: 'han', name: 'Chữ Hán', desc: '帥 俥 傌 炮 – kiểu truyền thống' },
  { id: 'viet', name: 'Chữ Việt', desc: 'Tướng, Xe, Mã, Pháo – dễ đọc cho người mới' },
];

const PREVIEW_FEN = '2bak4/4a4/4b1n2/p3C3p/2p6/6P2/P3c3P/4B4/4A4/2R1KAB2 w';

export function SettingsPage() {
  const profile = useProfile();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (!profile) return null;
  const s = profile.settings;

  const download = async () => {
    const blob = new Blob([await exportBackup()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `co-tuong-sao-luu-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const restore = async (file: File) => {
    try {
      await importBackup(await file.text());
      setMessage('Đã khôi phục dữ liệu.');
    } catch (e) {
      setMessage(`Lỗi: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <h1 className="text-2xl font-extrabold">Cài đặt</h1>

      <section className="card">
        <h2 className="mb-3 font-semibold">Bàn cờ</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BOARD_THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => updateSettings({ boardTheme: t.id })}
              className={`rounded-lg p-2 text-sm ${s.boardTheme === t.id ? 'bg-accent/30 ring-2 ring-accent' : 'bg-panel-2'}`}
            >
              <div
                className="mx-auto mb-1 aspect-square w-16 rounded"
                style={{
                  background: `linear-gradient(${t.line}, ${t.line}) 50% 0 / 2px 100% no-repeat, linear-gradient(90deg, ${t.line}, ${t.line}) 0 50% / 100% 2px no-repeat, ${t.bg}`,
                }}
              />
              {t.name}
            </button>
          ))}
        </div>
        <h3 className="mt-5 mb-2 text-sm font-semibold">Kiểu quân</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {PIECE_STYLES.map((ps) => (
            <button
              key={ps.id}
              onClick={() => updateSettings({ pieceStyle: ps.id })}
              className={`rounded-lg p-3 text-left text-sm ${s.pieceStyle === ps.id ? 'bg-accent/30 ring-2 ring-accent' : 'bg-panel-2'}`}
            >
              <div className="font-semibold">{ps.name}</div>
              <div className="text-xs text-muted">{ps.desc}</div>
            </button>
          ))}
        </div>
        <div className="mx-auto mt-4 w-full max-w-[260px]">
          <Board fen={PREVIEW_FEN} orientation={0} theme={s.boardTheme} pieceStyle={s.pieceStyle} coordinates={s.coordinates} />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Toggle label="Hiện tọa độ" checked={s.coordinates} onChange={(v) => updateSettings({ coordinates: v })} />
          <Toggle label="Hiệu ứng di chuyển quân" checked={s.animation} onChange={(v) => updateSettings({ animation: v })} />
          <Toggle label="Âm thanh" checked={s.sound} onChange={(v) => updateSettings({ sound: v })} />
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">Mục tiêu</h2>
        <label className="flex items-center justify-between gap-3">
          <span>Số puzzle mỗi ngày</span>
          <select
            className="rounded-lg bg-panel-2 px-3 py-2"
            value={s.dailyGoal}
            onChange={(e) => updateSettings({ dailyGoal: Number(e.target.value) })}
          >
            {[10, 20, 30, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <h2 className="mb-1 font-semibold">Dữ liệu</h2>
        <p className="mb-3 text-sm text-muted">
          Tiến độ chỉ được lưu trong trình duyệt này. Hãy sao lưu định kỳ, hoặc khi chuyển sang máy khác.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={download}>
            ⬇ Sao lưu
          </button>
          <button className="btn" onClick={() => fileInput.current?.click()}>
            ⬆ Khôi phục
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])}
          />
          <button
            className="btn"
            onClick={async () => {
              if (confirm('Chọn lại trình độ? Rating puzzle sẽ được đặt lại (lịch sử vẫn giữ nguyên).')) {
                await chooseLevelAgain();
                navigate('/');
              }
            }}
          >
            Chọn lại trình độ
          </button>
          <button
            className="btn text-bad"
            onClick={async () => {
              if (confirm('Xóa toàn bộ dữ liệu (rating, lịch sử, ván cờ, ôn tập)? Không thể hoàn tác.')) {
                await resetAll();
                setMessage('Đã xóa dữ liệu.');
              }
            }}
          >
            Xóa toàn bộ dữ liệu
          </button>
        </div>
        {message && <p className="mt-3 text-sm">{message}</p>}
      </section>

      <section className="card text-sm text-muted">
        <h2 className="mb-2 font-semibold text-white">Giới thiệu</h2>
        <p>
          Luật cờ, máy chơi (engine alpha-beta chạy trong Web Worker) và bàn cờ đều được viết riêng cho ứng dụng này, chạy hoàn
          toàn trên trình duyệt. Puzzle được sinh tự động từ các ván máy tự đấu và được kiểm chứng là chiếu hết bắt buộc.
        </p>
        <p className="mt-2">
          Luật hòa/thua được đơn giản hóa: chiếu dai bị xử thua, lặp lại thế cờ 3 lần khác là hòa, 60 nước không ăn quân là hòa.
        </p>
      </section>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span>{label}</span>
      <input type="checkbox" className="h-5 w-5 accent-[#d64933]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
