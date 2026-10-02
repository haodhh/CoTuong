export interface ThemeInfo {
  name: string;
  desc?: string;
}

export const THEMES: Record<string, ThemeInfo> = {
  mateIn1: { name: 'Chiếu hết 1 nước', desc: 'Tìm nước chiếu bí ngay lập tức.' },
  mateIn2: { name: 'Chiếu hết 2 nước', desc: 'Hai nước chiếu liên tiếp, đối phương không thoát được.' },
  mateIn3: { name: 'Chiếu hết 3 nước', desc: 'Liên hoàn chiếu 3 nước.' },
  mateIn4: { name: 'Chiếu hết 4 nước', desc: 'Liên hoàn chiếu 4 nước, cần tính sâu.' },
  mateIn5: { name: 'Chiếu hết 5 nước', desc: 'Chuỗi chiếu dài, dành cho người tính toán tốt.' },
  sacrifice: { name: 'Thí quân', desc: 'Hy sinh quân để mở đường chiếu hết.' },
  doubleCheck: { name: 'Chiếu đôi', desc: 'Nước chiếu cuối do hai quân cùng chiếu.' },
  mateRook: { name: 'Sát cục bằng Xe', desc: 'Xe là quân chiếu hết.' },
  mateHorse: { name: 'Sát cục bằng Mã', desc: 'Mã là quân chiếu hết.' },
  mateCannon: { name: 'Sát cục bằng Pháo', desc: 'Pháo chiếu qua ngòi.' },
  matePawn: { name: 'Sát cục bằng Tốt', desc: 'Tốt qua sông chiếu hết.' },
  maHauPhao: { name: 'Mã hậu pháo', desc: 'Pháo chiếu, ngòi là Mã của mình đứng sát Tướng địch.' },
  trungPhao: { name: 'Trùng pháo', desc: 'Hai Pháo cùng một đường, Pháo sau chiếu qua Pháo trước.' },
  maNgoaTao: { name: 'Mã ngọa tào', desc: 'Mã đứng ở góc cung (ô ngọa tào) chiếu hết.' },
  bachDienTuong: { name: 'Bạch diện tướng', desc: 'Lợi dụng luật hai Tướng không được đối mặt.' },
  songXe: { name: 'Song Xe', desc: 'Hai Xe phối hợp chiếu hết.' },
  xeMa: { name: 'Xe Mã phối hợp', desc: 'Xe và Mã cùng tạo thế sát.' },
  xePhao: { name: 'Xe Pháo phối hợp', desc: 'Xe và Pháo cùng tạo thế sát.' },
  maPhao: { name: 'Mã Pháo phối hợp', desc: 'Mã và Pháo cùng tạo thế sát.' },
  middlegame: { name: 'Trung cuộc' },
  endgame: { name: 'Tàn cuộc' },
};

export const THEME_GROUPS: { title: string; themes: string[] }[] = [
  { title: 'Theo số nước', themes: ['mateIn1', 'mateIn2', 'mateIn3', 'mateIn4', 'mateIn5'] },
  { title: 'Thế sát kinh điển', themes: ['maHauPhao', 'trungPhao', 'maNgoaTao', 'bachDienTuong', 'songXe'] },
  { title: 'Đòn phối hợp', themes: ['sacrifice', 'doubleCheck', 'xeMa', 'xePhao', 'maPhao'] },
  { title: 'Quân chiếu hết', themes: ['mateRook', 'mateHorse', 'mateCannon', 'matePawn'] },
  { title: 'Giai đoạn', themes: ['middlegame', 'endgame'] },
];

/** Themes that describe the puzzle rather than a skill; left out of "weakest themes". */
export const NON_SKILL_THEMES = new Set(['middlegame', 'endgame']);

export const themeName = (id: string) => THEMES[id]?.name ?? id;
