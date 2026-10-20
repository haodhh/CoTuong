export interface CoTheBook {
  id: string;
  name: string;
  zh: string;
  desc: string;
}

/** Classic manuals the composed problems ("cờ thế") come from. */
export const COTHE_BOOKS: CoTheBook[] = [
  {
    id: 'stnt',
    name: 'Thích tình nhã thú',
    zh: '适情雅趣',
    desc: 'Cổ phổ đời Minh (1570) của Từ Chi và Trần Học Lễ. Phần lớn là thế "liên sát": bên Đỏ phải chiếu liên tục cho tới khi hết cờ, vì chỉ cần chậm một nước là bị Đen phản sát.',
  },
  {
    id: 'lankha',
    name: 'Lạn kha thần cơ',
    zh: '烂柯神机',
    desc: 'Tuyển tập thế cờ đời Thanh, nhiều thế sát cục ngắn gọn và đẹp mắt.',
  },
  {
    id: 'tuongcuc',
    name: 'Tượng cục hối tồn',
    zh: '象局汇存',
    desc: 'Tuyển tập thế cờ đời Thanh (hai tập), phần lớn là thế "chính hòa": hai bên đi đúng thì hòa.',
  },
  {
    id: 'quattrung',
    name: 'Quất trung bí',
    zh: '橘中秘',
    desc: 'Cổ phổ đời Minh (1632) của Chu Tấn Trinh; đây là phần tàn cục thực dụng (thắng / hòa với lực lượng ít quân).',
  },
  {
    id: 'giangho',
    name: 'Giang hồ bài cục',
    zh: '江湖排局',
    desc: 'Các thế cờ giang hồ nổi tiếng: Thất tinh tụ hội, Dã mã thao điền, Thiên lý độc hành, Xích dẫn hàng long, Hỏa thiêu liên doanh, Pháo đả lưỡng lang quan… Bề ngoài tưởng thắng dễ nhưng đi đúng chỉ hòa.',
  },
  {
    id: 'tieusong',
    name: 'Tiêu song dật phẩm',
    zh: '蕉窗逸品',
    desc: 'Cổ phổ đời Thanh gồm các thế giang hồ kinh điển cùng lời giải chi tiết.',
  },
];

export const cotheBook = (id: string) => COTHE_BOOKS.find((b) => b.id === id);
