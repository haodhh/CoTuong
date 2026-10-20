export interface CoTheBook {
  id: string;
  name: string;
  zh: string;
  group: 'classic' | 'modern';
  desc: string;
  /** Solutions were found by the app's mate solver rather than taken from the book. */
  computed?: boolean;
}

/** Books the composed and textbook problems ("cờ thế") come from. */
export const COTHE_BOOKS: CoTheBook[] = [
  {
    id: 'stnt',
    name: 'Thích tình nhã thú',
    zh: '适情雅趣',
    group: 'classic',
    desc: 'Cổ phổ đời Minh (1570) của Từ Chi và Trần Học Lễ, bản 550 cục. Phần lớn là thế "liên sát": phải chiếu liên tục cho tới khi hết cờ, vì chỉ cần chậm một nước là bị đối phương phản sát.',
  },
  {
    id: 'stnt360',
    name: 'Thích tình nhã thú (bản 360)',
    zh: '适情雅趣360局',
    group: 'classic',
    desc: 'Bản 360 cục in trong "Tượng kỳ phổ đại toàn". Chỉ giữ những thế khác bản 550 cục; nhiều thế là cách chép khác (lệch vài quân) của cùng một thế.',
  },
  {
    id: 'lankha',
    name: 'Lạn kha thần cơ',
    zh: '烂柯神机',
    group: 'classic',
    desc: 'Tuyển tập thế cờ đời Thanh, nhiều thế sát cục ngắn gọn và đẹp mắt.',
  },
  {
    id: 'tuongcuc',
    name: 'Tượng cục hối tồn',
    zh: '象局汇存',
    group: 'classic',
    desc: 'Tuyển tập thế cờ đời Thanh (hai tập), phần lớn là thế "chính hòa": hai bên đi đúng thì hòa.',
  },
  {
    id: 'quattrung',
    name: 'Quất trung bí',
    zh: '橘中秘',
    group: 'classic',
    desc: 'Cổ phổ đời Minh (1632) của Chu Tấn Trinh; đây là phần tàn cục thực dụng (thắng / hòa với lực lượng ít quân).',
  },
  {
    id: 'giangho',
    name: 'Giang hồ bài cục',
    zh: '江湖排局',
    group: 'classic',
    desc: 'Các thế cờ giang hồ nổi tiếng: Thất tinh tụ hội, Dã mã thao điền, Thiên lý độc hành, Xích dẫn hàng long, Hỏa thiêu liên doanh, Pháo đả Lưỡng Lang quan… Bề ngoài tưởng thắng dễ nhưng đi đúng chỉ hòa.',
  },
  {
    id: 'tieusong',
    name: 'Tiêu song dật phẩm',
    zh: '蕉窗逸品',
    group: 'classic',
    desc: 'Cổ phổ đời Thanh gồm các thế giang hồ kinh điển cùng lời giải chi tiết.',
  },
  {
    id: 'khuybi',
    name: 'Thực dụng tàn cục khuy bí',
    zh: '实用残局窥秘',
    group: 'modern',
    desc: 'Sách của Trịnh Đức Phong: tàn cục thực dụng chia thành thắng/hòa theo lệ và thắng/hòa khéo, cục đơn và cục phức.',
  },
  {
    id: 'thucdung1',
    name: 'Tượng kỳ thực dụng tàn cục – tập 1',
    zh: '象棋实用残局 第一集',
    group: 'modern',
    desc: 'Tàn cục thực dụng xếp theo lực lượng (Pháo Tốt, Mã Tốt, Mã Pháo, song Xe…), mỗi thế có kết luận thắng hoặc hòa.',
  },
  {
    id: 'thucdung2',
    name: 'Tượng kỳ thực dụng tàn cục – tập 2',
    zh: '象棋实用残局 第二集',
    group: 'modern',
    desc: 'Tập 2: tàn cục Xe Tốt, Xe Mã Tốt, Mã Pháo Tốt, song Xe…',
  },
  {
    id: 'tuyetsat',
    name: 'Tượng kỳ tuyệt sát dữ diệu hòa',
    zh: '象棋绝杀与妙和',
    group: 'modern',
    desc: 'Sách của Trịnh Đức Phong, Phàn Văn Triệu, Phan Dục Xuân: tàn cục thực chiến và bài cục, thắng và hòa.',
  },
  {
    id: 'phaotot',
    name: 'Pháo Tốt chuyên tập',
    zh: '炮卒专集',
    group: 'modern',
    desc: 'Chuyên đề tàn cục Pháo Tốt; phần lớn là bên Đen (Pháo Tốt) đi trước thắng.',
  },
  {
    id: 'xema',
    name: 'Xe Mã chuyên tập',
    zh: '车马专集',
    group: 'modern',
    desc: 'Chuyên đề tàn cục Xe Mã đối Xe Tốt.',
  },
  {
    id: 'tonghop',
    name: 'Tàn cục tổng hợp',
    zh: '残局',
    group: 'modern',
    desc: 'Các thế sát và bài cục sưu tầm (chưa rõ sách gốc), có cả thế sát cơ bản như Mã hậu pháo, Đối diện tiếu.',
  },
  {
    id: 'dieuthu',
    name: 'Trung cục diệu thủ 300',
    zh: '中国象棋中局妙手300',
    group: 'modern',
    desc: '300 đòn chiến thuật trung cục trích từ các ván thi đấu thực tế, xếp theo 17 loại chiến thuật (thí quân, đòn kép, ghim quân…). Tên thế ghi hai kỳ thủ của ván đấu.',
  },
  {
    id: 'sat4000',
    name: 'Tuyệt đối tinh diệu sát cục',
    zh: '绝对精妙杀局4000局',
    group: 'modern',
    desc: 'Hơn 3.700 thế sát cục (Đỏ đi trước thắng). Sách chỉ có thế cờ; lời giải do bộ giải chiếu hết của ứng dụng tìm ra.',
    computed: true,
  },
];

export const cotheBook = (id: string) => COTHE_BOOKS.find((b) => b.id === id);
