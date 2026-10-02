import { startWithLevel } from '../data/store';

const LEVELS = [
  { rating: 600, title: 'Mới chơi', desc: 'Mới biết luật, đang làm quen cách đi quân.' },
  { rating: 1000, title: 'Cơ bản', desc: 'Chơi được vài ván, nhìn được nước chiếu hết đơn giản.' },
  { rating: 1400, title: 'Trung bình', desc: 'Chơi thường xuyên, biết Mã hậu pháo, Trùng pháo.' },
  { rating: 1800, title: 'Khá', desc: 'Tính được chuỗi chiếu 3–4 nước, hay đánh với người giỏi.' },
];

export function Onboarding({ onDone }: { onDone?: () => void }) {
  return (
    <div className="mx-auto max-w-2xl py-6">
      <h1 className="mb-2 text-3xl font-extrabold">Chào mừng bạn! 帥</h1>
      <p className="mb-6 text-muted">
        Chọn trình độ gần đúng nhất để bắt đầu luyện puzzle. Rating puzzle sẽ tự điều chỉnh sau khoảng 15–20 bài, nên không cần
        chọn thật chính xác.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {LEVELS.map((l) => (
          <button
            key={l.rating}
            className="card text-left transition-colors hover:bg-panel-2"
            onClick={async () => {
              await startWithLevel(l.rating);
              onDone?.();
            }}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold">{l.title}</span>
              <span className="text-accent">~{l.rating}</span>
            </div>
            <div className="mt-1 text-sm text-muted">{l.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
