// Interactive lessons. Positions are checked by src/content/content.test.ts.

export type LessonStep =
  /** Text with a position, optional arrows (UCCI moves) and highlighted squares. */
  | { type: 'explain'; fen: string; text: string; arrows?: string[]; marks?: string[] }
  /** Click every square the piece on `square` can move to. */
  | { type: 'dests'; fen: string; text: string; square: string }
  /** Play one of the `solution` moves (or any legal move with `anyLegal`); `reply` is then played for the opponent. */
  | { type: 'move'; fen: string; text: string; solution: string[]; anyLegal?: boolean; reply?: string; success?: string }
  /** Find a move that checkmates at once. */
  | { type: 'mate'; fen: string; text: string; success?: string };

export interface Lesson {
  id: string;
  title: string;
  icon: string;
  summary: string;
  steps: LessonStep[];
}

const START = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

export const LESSONS: Lesson[] = [
  {
    id: 'ban-co',
    title: 'Bàn cờ và quân cờ',
    icon: '🀄',
    summary: 'Sông, cửu cung, cách bày quân và cách ghi nước đi.',
    steps: [
      {
        type: 'explain',
        fen: START,
        text: 'Bàn cờ tướng có 9 đường dọc và 10 đường ngang; quân cờ đặt trên các giao điểm. Khoảng trống ở giữa là sông (Sở hà – Hán giới) chia bàn cờ thành hai nửa. Mỗi bên có 16 quân: 1 Tướng, 2 Sĩ, 2 Tượng, 2 Xe, 2 Pháo, 2 Mã và 5 Tốt. Bên Đỏ luôn đi trước.',
      },
      {
        type: 'explain',
        fen: START,
        text: 'Hai ô vuông có đường chéo ở hai đầu bàn cờ gọi là cửu cung (9 điểm). Tướng và Sĩ chỉ được đi trong cung của mình.',
        marks: ['d0', 'e0', 'f0', 'd1', 'e1', 'f1', 'd2', 'e2', 'f2', 'd7', 'e7', 'f7', 'd8', 'e8', 'f8', 'd9', 'e9', 'f9'],
      },
      {
        type: 'explain',
        fen: START,
        text: 'Đường dọc được đánh số 1–9 từ phải sang trái theo phía của mỗi người (số in ở mép bàn cờ). Nước đi ghi theo dạng: tên quân + đường đang đứng + hướng đi + đích. Dấu "." là tiến, "/" là thoái (lùi), "-" là bình (đi ngang). Ví dụ mũi tên là P2-5: Pháo ở đường 2 bình sang đường 5 – nước "Pháo đầu" rất phổ biến.',
        arrows: ['h2e2'],
      },
      {
        type: 'explain',
        fen: START,
        text: 'Với Xe, Pháo, Tốt, Tướng khi tiến/thoái thì số cuối là số bước đi (X1.1: Xe đường 1 tiến 1 bước). Với Mã, Tượng, Sĩ thì số cuối là đường đích (M2.3: Mã đường 2 tiến sang đường 3). Ký hiệu quân: Tg (Tướng), S (Sĩ), T (Tượng), X (Xe), P (Pháo), M (Mã), B (Tốt/Binh).',
        arrows: ['i0i1', 'h0g2'],
      },
    ],
  },
  {
    id: 'tuong',
    title: 'Tướng',
    icon: '帥',
    summary: 'Đi từng bước trong cung; hai Tướng không được đối mặt.',
    steps: [
      {
        type: 'explain',
        fen: '3k5/9/9/9/9/9/9/9/4K4/9 w - - 0 1',
        text: 'Tướng (帥/將) là quân quan trọng nhất: mất Tướng là thua. Tướng đi từng bước một theo chiều dọc hoặc ngang, và không được ra khỏi cửu cung.',
        marks: ['e1'],
      },
      { type: 'dests', fen: '3k5/9/9/9/9/9/9/9/4K4/9 w - - 0 1', square: 'e1', text: 'Bấm vào tất cả các điểm Tướng Đỏ có thể đi tới.' },
      {
        type: 'explain',
        fen: '3k5/9/9/9/9/9/9/9/9/4K4 w - - 0 1',
        text: 'Luật "lộ mặt tướng": hai Tướng không được đứng đối mặt nhau trên cùng một đường dọc mà không có quân nào ở giữa. Vì vậy Tướng Đỏ không được sang đường của Tướng Đen.',
        arrows: ['e0d0'],
      },
      { type: 'dests', fen: '3k5/9/9/9/9/9/9/9/9/4K4 w - - 0 1', square: 'e0', text: 'Tướng Đỏ có thể đi những điểm nào? (Nhớ luật lộ mặt tướng.)' },
    ],
  },
  {
    id: 'si',
    title: 'Sĩ',
    icon: '仕',
    summary: 'Đi chéo một bước, chỉ trong cung.',
    steps: [
      {
        type: 'explain',
        fen: '3k5/9/9/9/9/9/9/9/4A4/4K4 w - - 0 1',
        text: 'Sĩ (仕/士) đi chéo một bước và chỉ được ở trong cung, nên chỉ có 5 điểm để đứng. Sĩ là quân bảo vệ Tướng.',
        marks: ['d0', 'f0', 'e1', 'd2', 'f2'],
      },
      { type: 'dests', fen: '3k5/9/9/9/9/9/9/9/4A4/4K4 w - - 0 1', square: 'e1', text: 'Bấm vào tất cả các điểm Sĩ ở giữa cung có thể đi tới.' },
      { type: 'dests', fen: '3k5/9/9/9/9/9/9/9/9/3AK4 w - - 0 1', square: 'd0', text: 'Còn Sĩ ở góc cung thì sao?' },
    ],
  },
  {
    id: 'tuong-voi',
    title: 'Tượng',
    icon: '相',
    summary: 'Đi chéo hai bước, bị cản mắt, không qua sông.',
    steps: [
      {
        type: 'explain',
        fen: '3k5/9/9/9/9/9/5n3/4B4/9/4K4 w - - 0 1',
        text: 'Tượng (相/象) đi chéo đúng hai bước (đường chéo hình vuông 2×2). Nếu điểm ở giữa (mắt tượng) có quân đứng thì Tượng không đi hướng đó được – gọi là "cản tượng". Ở đây Mã Đen đang cản một hướng.',
        marks: ['f3'],
      },
      { type: 'dests', fen: '3k5/9/9/9/9/9/5n3/4B4/9/4K4 w - - 0 1', square: 'e2', text: 'Bấm vào các điểm Tượng có thể đi tới.' },
      {
        type: 'dests',
        fen: '3k5/9/9/9/9/2B6/9/9/9/4K4 w - - 0 1',
        square: 'c4',
        text: 'Tượng không được qua sông, nên chỉ có 7 điểm để đứng. Tượng đứng ở bờ sông đi được những đâu?',
      },
    ],
  },
  {
    id: 'ma',
    title: 'Mã',
    icon: '傌',
    summary: 'Đi chữ "nhật", bị cản chân.',
    steps: [
      {
        type: 'explain',
        fen: '3k5/9/9/9/9/4N4/9/9/9/4K4 w - - 0 1',
        text: 'Mã (傌/馬) đi theo hình chữ "nhật": một bước thẳng rồi một bước chéo. Mã ở giữa bàn cờ có tới 8 điểm để đi.',
      },
      { type: 'dests', fen: '3k5/9/9/9/9/4N4/9/9/9/4K4 w - - 0 1', square: 'e4', text: 'Bấm vào tất cả 8 điểm Mã có thể đi tới.' },
      {
        type: 'explain',
        fen: '3k5/9/9/9/4p4/4N4/9/9/9/4K4 w - - 0 1',
        text: 'Nếu điểm sát Mã theo hướng đi thẳng có quân đứng thì Mã không đi hướng đó được – gọi là "cản mã" (chặn chân mã). Tốt Đen đang chặn chân Mã ở phía trên.',
        marks: ['e5'],
      },
      { type: 'dests', fen: '3k5/9/9/9/4p4/4N4/9/9/9/4K4 w - - 0 1', square: 'e4', text: 'Bây giờ Mã còn đi được những điểm nào?' },
    ],
  },
  {
    id: 'xe',
    title: 'Xe',
    icon: '俥',
    summary: 'Đi thẳng bao xa cũng được – quân mạnh nhất.',
    steps: [
      {
        type: 'explain',
        fen: '3k5/9/4P4/9/1n2R4/9/9/9/9/4K4 w - - 0 1',
        text: 'Xe (俥/車) đi theo đường dọc hoặc ngang, bao nhiêu bước cũng được, miễn là không có quân cản đường. Xe ăn quân đối phương đầu tiên nằm trên đường đi. Xe là quân mạnh nhất bàn cờ.',
      },
      { type: 'dests', fen: '3k5/9/4P4/9/1n2R4/9/9/9/9/4K4 w - - 0 1', square: 'e5', text: 'Bấm vào tất cả các điểm Xe có thể đi tới (kể cả điểm ăn quân).' },
      {
        type: 'move',
        fen: '3k5/9/4P4/9/1n2R4/9/9/9/9/4K4 w - - 0 1',
        text: 'Mã Đen không được bảo vệ. Hãy dùng Xe ăn Mã.',
        solution: ['e5b5'],
        success: 'Chính xác! Luôn để ý những quân đối phương không được bảo vệ.',
      },
    ],
  },
  {
    id: 'phao',
    title: 'Pháo',
    icon: '炮',
    summary: 'Đi như Xe, ăn quân phải có ngòi.',
    steps: [
      {
        type: 'explain',
        fen: '3k5/4n4/9/9/4P4/9/4C4/9/9/4K4 w - - 0 1',
        text: 'Pháo (炮/砲) đi giống Xe khi không ăn quân. Nhưng khi ăn quân, Pháo phải nhảy qua đúng một quân (gọi là "ngòi", của bên nào cũng được) để ăn quân đối phương phía sau.',
        arrows: ['e3e8'],
      },
      { type: 'dests', fen: '3k5/4n4/9/9/4P4/9/4C4/9/9/4K4 w - - 0 1', square: 'e3', text: 'Bấm vào tất cả các điểm Pháo có thể đi tới.' },
      {
        type: 'move',
        fen: '3k5/4n4/9/9/4P4/9/4C4/9/9/4K4 w - - 0 1',
        text: 'Dùng Tốt làm ngòi, cho Pháo ăn Mã Đen.',
        solution: ['e3e8'],
        success: 'Đúng rồi! Pháo nhảy qua ngòi để ăn quân.',
      },
    ],
  },
  {
    id: 'tot',
    title: 'Tốt',
    icon: '兵',
    summary: 'Chỉ tiến; qua sông được đi ngang.',
    steps: [
      {
        type: 'explain',
        fen: '3k5/9/9/9/9/9/4P4/9/9/4K4 w - - 0 1',
        text: 'Tốt (兵/卒) mỗi lần đi một bước và không bao giờ được lùi. Khi chưa qua sông, Tốt chỉ được tiến thẳng.',
      },
      { type: 'dests', fen: '3k5/9/9/9/9/9/4P4/9/9/4K4 w - - 0 1', square: 'e3', text: 'Tốt chưa qua sông đi được đâu?' },
      { type: 'dests', fen: '3k5/9/9/9/4P4/9/9/9/9/4K4 w - - 0 1', square: 'e5', text: 'Tốt đã qua sông được đi thêm sang ngang. Bấm vào các điểm Tốt có thể đi.' },
    ],
  },
  {
    id: 'chieu-het',
    title: 'Chiếu và chiếu hết',
    icon: '⚔️',
    summary: 'Chiếu, tránh chiếu, chiếu hết và hết nước đi.',
    steps: [
      {
        type: 'explain',
        fen: '4k4/9/9/9/9/9/9/9/9/3K4R w - - 0 1',
        text: 'Khi một quân đe dọa ăn Tướng đối phương ở nước tiếp theo, ta gọi là "chiếu tướng". Bên bị chiếu bắt buộc phải tránh: di chuyển Tướng, ăn quân đang chiếu, hoặc chặn đường chiếu.',
        arrows: ['i0i9'],
      },
      {
        type: 'move',
        fen: '4k3R/9/9/9/9/9/9/9/9/3K5 b - - 0 1',
        text: 'Xe Đỏ đang chiếu Tướng Đen. Hãy đưa Tướng Đen thoát khỏi nước chiếu.',
        solution: [],
        anyLegal: true,
        success: 'Tốt! Bị chiếu thì nước đi nào cũng phải giải được nước chiếu.',
      },
      {
        type: 'mate',
        fen: '4k4/R8/9/9/9/9/9/9/9/3K4R w - - 0 1',
        text: 'Chiếu hết là khi bị chiếu mà không còn cách nào tránh – bên đó thua. Một Xe đã khóa hàng thứ hai. Hãy chiếu hết bằng Xe còn lại!',
        success: 'Song Xe chiếu hết! Tướng Đen không còn đường thoát.',
      },
      {
        type: 'mate',
        fen: '3aka3/9/4P4/1N7/9/9/9/9/9/3K5 w - - 0 1',
        text: 'Tướng Đen bị hai Sĩ của mình chặn hai bên, Tốt Đỏ khống chế phía trước. Chiếu hết bằng Mã!',
        success: 'Tuyệt! Tướng bị chính quân của mình chặn đường thoát.',
      },
      {
        type: 'mate',
        fen: '4k4/3P5/4P4/9/9/9/9/9/9/3K1R3 w - - 0 1',
        text: 'Chiếu hết bằng Tốt. Để ý xem Tốt nào được bảo vệ.',
        success: 'Đúng! Tốt được Tốt khác bảo vệ nên Tướng không ăn được.',
      },
      {
        type: 'explain',
        fen: '3k5/2P6/9/9/9/9/9/9/9/4K4 b - - 0 1',
        text: 'Trong cờ tướng, bên đến lượt mà không còn nước đi hợp lệ nào cũng bị xử thua, kể cả khi không bị chiếu. Ở đây Đen không thể lên vì Tốt Đỏ khống chế, không thể sang phải vì sẽ lộ mặt tướng – Đen thua.',
        marks: ['d8', 'e9'],
      },
    ],
  },
  {
    id: 'the-sat',
    title: 'Các thế sát kinh điển',
    icon: '🎯',
    summary: 'Mã hậu pháo, Trùng pháo, Bạch diện tướng, Mã ngọa tào.',
    steps: [
      {
        type: 'mate',
        fen: '4k4/9/4N4/9/9/9/9/7C1/9/3K5 w - - 0 1',
        text: 'Mã hậu pháo: Mã đứng trước Tướng địch khống chế hai điểm hai bên, Pháo đứng phía sau trên cùng đường dọc chiếu với Mã làm ngòi. Hãy đưa Pháo vào vị trí!',
        success: 'Mã hậu pháo! Một thế sát rất hay gặp trong thực chiến.',
      },
      {
        type: 'mate',
        fen: '3aka3/4C4/9/3N5/9/9/9/1C7/9/3K5 w - - 0 1',
        text: 'Trùng pháo: hai Pháo cùng một đường, Pháo trước làm ngòi cho Pháo sau. Mã đang bảo vệ Pháo trước. Chiếu hết!',
        success: 'Trùng pháo sát! Sĩ không thể ăn Pháo vì Pháo sau vẫn chiếu.',
      },
      {
        type: 'mate',
        fen: '3k5/9/9/9/9/9/9/9/R8/4K4 w - - 0 1',
        text: 'Bạch diện tướng: Tướng Đỏ chiếm đường giữa nên Tướng Đen không được sang. Chiếu hết bằng Xe!',
        success: 'Tướng cũng là một quân tấn công nhờ luật lộ mặt tướng.',
      },
      {
        type: 'mate',
        fen: '3ak4/4a4/9/7N1/9/9/9/9/9/3K1R3 w - - 0 1',
        text: 'Mã ngọa tào: Mã đứng ở điểm cạnh góc cung chiếu Tướng, Xe khóa đường thoát còn lại. Chiếu hết!',
        success: 'Mã ngọa tào! Hai Sĩ chặn chính Tướng của mình.',
      },
    ],
  },
  {
    id: 'khai-cuoc',
    title: 'Khai cuộc cơ bản',
    icon: '📖',
    summary: 'Pháo đầu, Bình phong mã, Thuận pháo, Phi tượng.',
    steps: [
      {
        type: 'explain',
        fen: START,
        text: 'Nguyên tắc khai cuộc: nhanh chóng đưa Xe, Mã, Pháo ra hoạt động, kiểm soát trung tâm và giữ Tướng an toàn. Hãy cùng đi một khai cuộc phổ biến nhất: Pháo đầu.',
      },
      {
        type: 'move',
        fen: START,
        text: 'Đi Pháo đầu: P2-5 (Pháo đường 2 bình sang đường 5, nhắm vào Tốt đầu của Đen).',
        solution: ['h2e2'],
        reply: 'h9g7',
        success: 'Pháo đầu! Đen đáp M8.7 – lên Mã bảo vệ Tốt đầu.',
      },
      {
        type: 'move',
        fen: 'rnbakab1r/9/1c4nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR w - - 2 2',
        text: 'Lên Mã cho Xe ra: M2.3.',
        solution: ['h0g2'],
        reply: 'b9c7',
        success: 'Đen lên nốt Mã còn lại: thế "Bình phong mã" – hai Mã che chắn trung tâm.',
      },
      {
        type: 'move',
        fen: 'r1bakab1r/9/1cn3nc1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C1N2/9/RNBAKAB1R w - - 4 3',
        text: 'Đưa Xe ra đường 2: X1-2.',
        solution: ['i0h0'],
        reply: 'i9h9',
        success: 'Xe đã ra trận. Đây là thế Pháo đầu đối Bình phong mã.',
      },
      {
        type: 'explain',
        fen: 'rnbakabnr/9/1c2c4/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR w - - 2 2',
        text: 'Nếu Đen cũng đưa Pháo cùng phía vào giữa (P8-5) thì gọi là "Thuận pháo"; dùng Pháo phía bên kia thì gọi là "Nghịch pháo". Hai bên đều có Pháo đầu, ván cờ thường rất sắc nét.',
        arrows: ['h7e7'],
      },
      {
        type: 'move',
        fen: START,
        text: 'Một khai cuộc vững chắc khác: Phi tượng (T3.5) – đưa Tượng lên giữa, củng cố phòng thủ.',
        solution: ['g0e2', 'c0e2'],
        success: 'Phi tượng cục: khai cuộc mềm dẻo, phù hợp lối chơi chắc chắn. (Ở đây T3.5 hay T7.5 đều được.)',
      },
      {
        type: 'move',
        fen: START,
        text: 'Tiên nhân chỉ lộ: tiến Tốt đường 3 (B3.1) hoặc đường 7 (B7.1) để mở đường cho Mã.',
        solution: ['g3g4', 'c3c4'],
        success: 'Tiên nhân chỉ lộ – "tiên nhân chỉ đường", thăm dò ý đồ của đối phương.',
      },
    ],
  },
  {
    id: 'luat',
    title: 'Thắng, thua và hòa',
    icon: '⚖️',
    summary: 'Chiếu dai, lặp lại nước đi, luật 60 nước.',
    steps: [
      {
        type: 'explain',
        fen: '3k5/9/9/9/9/9/9/9/9/4K3R w - - 0 1',
        text: 'Một bên thắng khi chiếu hết Tướng đối phương, khi đối phương hết nước đi, hoặc khi đối phương xin thua.',
      },
      {
        type: 'explain',
        fen: '3k5/9/9/9/9/9/9/9/9/4K3R w - - 0 1',
        text: 'Chiếu dai: không được chiếu liên tục mãi bằng cùng một cách để kéo dài ván cờ. Trong ứng dụng này, nếu thế cờ lặp lại lần thứ ba mà một bên đã chiếu ở mọi nước trong vòng lặp, bên đó bị xử thua.',
        arrows: ['i0i9', 'd9d8'],
      },
      {
        type: 'explain',
        fen: '3k5/9/9/9/9/9/9/9/9/4K3R w - - 0 1',
        text: 'Các trường hợp hòa: thế cờ lặp lại lần thứ ba (không phải do chiếu dai), 60 nước liền không bên nào ăn quân, hai bên không còn quân tấn công (Xe, Mã, Pháo, Tốt), hoặc hai bên đồng ý hòa. (Luật thi đấu thật còn có luật "đuổi dai" phức tạp hơn; ứng dụng dùng bản đơn giản.)',
      },
    ],
  },
];
