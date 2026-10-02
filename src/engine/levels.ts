export interface BotLevel {
  level: number;
  name: string;
  desc: string;
  /** Fixed depth; weaker levels score every root move and pick one at random, weighted by score. */
  depth?: number;
  temperature?: number;
  timeMs?: number;
}

export const BOT_LEVELS: BotLevel[] = [
  { level: 1, name: 'Tập sự', desc: 'Mới học luật, hay để mất quân.', depth: 1, temperature: 160 },
  { level: 2, name: 'Mới chơi', desc: 'Biết ăn quân, chưa nhìn xa.', depth: 2, temperature: 90 },
  { level: 3, name: 'Nghiệp dư', desc: 'Tính được 2–3 nước, thỉnh thoảng sai.', depth: 3, temperature: 45 },
  { level: 4, name: 'Khá', desc: 'Ít khi bỏ quân, biết phối hợp.', depth: 4, temperature: 18 },
  { level: 5, name: 'Giỏi', desc: 'Suy nghĩ khoảng nửa giây mỗi nước.', timeMs: 500 },
  { level: 6, name: 'Cao thủ', desc: 'Suy nghĩ khoảng 1,5 giây mỗi nước.', timeMs: 1500 },
  { level: 7, name: 'Kiện tướng', desc: 'Suy nghĩ khoảng 3 giây mỗi nước.', timeMs: 3000 },
  { level: 8, name: 'Đại kiện tướng', desc: 'Dùng tối đa sức máy (khoảng 6 giây).', timeMs: 6000 },
];

export const botLevel = (level: number) => BOT_LEVELS.find((l) => l.level === level) ?? BOT_LEVELS[2];
