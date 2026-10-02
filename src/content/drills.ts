export interface Drill {
  id: string;
  group: string;
  title: string;
  desc: string;
  /** Start position; the player has the side to move and must win. */
  fen: string;
  /** Moves for three stars (a little above what the engine needs against itself). */
  par: number;
  /** The drill fails after this many of the player's moves. */
  limit: number;
}

export const DRILLS: Drill[] = [
  {
    id: 'xe-don',
    group: 'Sát cục cơ bản',
    title: 'Xe đơn thắng Tướng đơn',
    desc: 'Dùng Xe ép Tướng đối phương lên góc, nhờ Tướng mình khống chế đường mặt.',
    fen: '4k4/9/9/9/9/9/9/9/9/R2K5 w - - 0 1',
    par: 4,
    limit: 25,
  },
  {
    id: 'tot-don',
    group: 'Sát cục cơ bản',
    title: 'Tốt thắng Tướng đơn',
    desc: 'Tốt đã qua sông phối hợp với Tướng (luật lộ mặt tướng) để chiếu hết.',
    fen: '4k4/9/9/2P6/9/9/9/9/9/3K5 w - - 0 1',
    par: 6,
    limit: 30,
  },
  {
    id: 'ma-don',
    group: 'Sát cục cơ bản',
    title: 'Mã thắng Tướng đơn',
    desc: 'Mã một mình vẫn chiếu hết được nếu Tướng mình chiếm đường mặt.',
    fen: '4k4/9/9/9/9/9/9/9/9/3K1N3 w - - 0 1',
    par: 9,
    limit: 35,
  },
  {
    id: 'phao-si',
    group: 'Sát cục cơ bản',
    title: 'Pháo Sĩ thắng Tướng đơn',
    desc: 'Pháo cần ngòi: dùng Sĩ làm ngòi và Tướng khống chế.',
    fen: '4k4/9/9/9/9/9/9/9/4A4/3K1C3 w - - 0 1',
    par: 9,
    limit: 35,
  },
  {
    id: 'xe-si',
    group: 'Tàn cuộc Xe',
    title: 'Xe thắng Sĩ đôi',
    desc: 'Phá thế song Sĩ: ép Tướng, bắt Sĩ hoặc chiếu hết.',
    fen: '3aka3/9/9/9/9/9/9/9/9/R2K5 w - - 0 1',
    par: 8,
    limit: 40,
  },
  {
    id: 'xe-tuong',
    group: 'Tàn cuộc Xe',
    title: 'Xe thắng Tượng đôi',
    desc: 'Dùng Xe và Tướng tách hai Tượng rồi bắt từng con.',
    fen: '2b1k1b2/9/9/9/9/9/9/9/9/R2K5 w - - 0 1',
    par: 23,
    limit: 40,
  },
  {
    id: 'xe-phao',
    group: 'Tàn cuộc Xe',
    title: 'Xe thắng Pháo',
    desc: 'Pháo không có ngòi thì yếu; dồn Tướng và bắt Pháo.',
    fen: '4k4/9/4c4/9/9/9/9/9/9/R2K5 w - - 0 1',
    par: 9,
    limit: 40,
  },
  {
    id: 'xe-ma',
    group: 'Tàn cuộc Xe',
    title: 'Xe thắng Mã',
    desc: 'Tách Mã khỏi Tướng rồi bắt Mã hoặc chiếu hết.',
    fen: '4k4/9/4n4/9/9/9/9/9/9/R2K5 w - - 0 1',
    par: 6,
    limit: 45,
  },
  {
    id: 'song-xe',
    group: 'Phối hợp',
    title: 'Song Xe thắng Sĩ Tượng toàn',
    desc: 'Hai Xe thay phiên chiếu, phá Sĩ Tượng để chiếu hết.',
    fen: '2bakab2/9/9/9/9/9/9/9/9/RR1K5 w - - 0 1',
    par: 13,
    limit: 30,
  },
  {
    id: 'xe-phao-full',
    group: 'Phối hợp',
    title: 'Xe Pháo thắng Sĩ Tượng toàn',
    desc: 'Xe Pháo phối hợp, dùng quân phòng thủ của địch làm ngòi.',
    fen: '2bakab2/9/9/9/9/9/9/9/9/RC1K5 w - - 0 1',
    par: 16,
    limit: 40,
  },
  {
    id: 'ma-phao-si',
    group: 'Phối hợp',
    title: 'Mã Pháo thắng Sĩ đôi',
    desc: 'Mã khống chế, Pháo chiếu qua ngòi – thế Mã hậu pháo.',
    fen: '3aka3/9/9/9/9/9/9/9/9/1NC2K3 w - - 0 1',
    par: 10,
    limit: 45,
  },
];
