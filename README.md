# Cờ Tướng Luyện Tập

Ứng dụng web để chơi và luyện tập cờ tướng, chạy hoàn toàn trên trình duyệt và được host trên GitHub Pages.

**Chơi ngay:** https://haodhh.github.io/CoTuong/

## Tính năng

**Chơi**
- **Chơi với máy:** 8 cấp độ (từ Tập sự đến Đại kiện tướng), chọn cầm Đỏ/Đen, máy chấp quân (Mã, Pháo, Xe…), gợi ý nước đi, đi lại, xin thua. Ván dở được lưu để chơi tiếp.
- **Hai người:** chơi trên cùng một thiết bị, có tùy chọn tự lật bàn.
- **Ván đã chơi & Phân tích:** xem lại ván, bật máy phân tích (thanh đánh giá, biến chính), **đánh giá cả ván** (độ chính xác, các nước thiếu chính xác / sai lầm / sai nghiêm trọng, gợi ý nước tốt hơn), mở thế cờ từ FEN.

**Puzzle** (chiếu hết bắt buộc, tính rating Glicko-2)
- **Puzzle tính điểm** quanh trình độ của bạn, 3 mức Dễ / Vừa / Khó, có gợi ý và xem lời giải.
- **Theo chủ đề:** chiếu hết 1–5 nước, Mã hậu pháo, Trùng pháo, Mã ngọa tào, Bạch diện tướng, Song Xe, thí quân…
- **Puzzle Rush** (3 phút, 5 phút, Sống sót), **Ôn lỗi** bằng lặp lại ngắt quãng (FSRS), **Puzzle hằng ngày**.

**Luyện tập**
- **Tàn cuộc:** 11 thế tàn cuộc cơ bản (Xe đơn, Tốt, Mã, Pháo Sĩ thắng Tướng đơn; Xe thắng Sĩ đôi / Tượng đôi / Mã / Pháo; Song Xe, Xe Pháo, Mã Pháo…), thắng máy càng nhanh càng nhiều sao.
- **Học luật:** 12 bài tương tác – cách đi từng quân (bấm chọn các điểm quân có thể đi), chiếu hết, các thế sát kinh điển, khai cuộc cơ bản, luật thắng/thua/hòa.

Ngoài ra: thống kê (biểu đồ rating, chủ đề yếu nhất), cài đặt (4 màu bàn cờ, quân chữ Hán hoặc chữ Việt, âm thanh), sao lưu/khôi phục dữ liệu. Nước đi được ghi theo ký hiệu Việt Nam (P2-5, M8.7, X1/2…).

Tiến độ được lưu trong trình duyệt (IndexedDB). Dùng **Cài đặt → Sao lưu** để chuyển dữ liệu sang máy khác.

## Phát triển

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit test (Vitest)
npm run build    # bản build tĩnh trong dist/
```

Công nghệ: React + TypeScript + Vite, Tailwind CSS, Dexie (IndexedDB), ts-fsrs. Luật cờ, bàn cờ (SVG) và engine được viết riêng, không phụ thuộc thư viện cờ nào:

- `src/core/xiangqi.ts` – luật cờ: sinh nước, chiếu, lộ mặt tướng, FEN, lặp nước (kiểm chứng bằng perft).
- `src/engine/search.ts` – engine alpha-beta (iterative deepening, PVS, bảng chuyển vị, null move, LMR, quiescence), chạy trong Web Worker.
- `src/core/mate.ts` – bộ giải chiếu hết dùng cho puzzle; người chơi đi nước khác lời giải nhưng vẫn chiếu hết đúng hạn cũng được tính đúng.

Luật hòa/thua được đơn giản hóa: chiếu dai bị xử thua, lặp lại thế cờ 3 lần khác là hòa, 60 nước không ăn quân là hòa.

## Dữ liệu puzzle

Cờ tướng không có kho puzzle mở như Lichess, nên puzzle được **sinh tự động** bằng `scripts/generate-puzzles.ts`: máy tự đấu ở nhiều mức yếu khác nhau, tại mỗi thế cờ tìm chuỗi chiếu hết bắt buộc (tối đa 5 nước, mọi nước đều chiếu), chỉ giữ bài có **nước đầu duy nhất**, rồi gắn chủ đề và ước lượng độ khó. Kết quả nằm trong `public/data/puzzles/`, chia theo mức rating 100 điểm.

Để tạo lại dữ liệu, chạy workflow **Build puzzle data** trong tab Actions, hoặc chạy trên máy:

```bash
npm run build:puzzles -- --minutes 60 --per-band 400
```

`npm run verify:drills` cho máy tự chơi các thế tàn cuộc để kiểm tra bên tấn công thắng được.

## Deploy

Workflow **Build and deploy** chạy test, build và deploy lên GitHub Pages mỗi khi push lên nhánh mặc định. Cần bật một lần: **Settings → Pages → Source: GitHub Actions**.
