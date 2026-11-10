# Mèo vs Chó: ghi chú cho Claude

> Luật chung cho mọi game ở `E:\01_Projects\VibeCode\CLAUDE.md`. File này chỉ nói riêng game này.

## Ý tưởng

Game PK 2 phe trên TikTok LIVE. Người xem gõ 1 vào phe Mèo (trái, nền băng), gõ 2 vào phe Chó (phải, nền lửa). Mỗi comment thả lính ra sân, hai đạo quân lao vào đánh nhau giữa sân. Thả tim đủ mốc thì phe tung chiêu, tặng quà thì ra chiêu ngay. Trận 30 phút, càng về cuối càng dồn dập.

## Luật chơi

- Chỉ comment đúng `1` → phe Mèo, đúng `2` → phe Chó (`1111`, `1 nha`, `mèo` không chọn phe). Ai chưa chọn mà comment, thả tim hay tặng quà thì được xếp vào phe đang ít người hơn. Đổi phe được, tối đa 20 giây 1 lần.
- **Comment nào cũng được đếm** cho phe (số 💬 dưới sân). Lính: mỗi người tối đa 1 đội 5 con / 1,5 giây.
- Tim: mỗi phe 1 thanh. 5.000 tim ra chiêu 1 (Mưa cá khô / Mưa xương), 15.000 ra chiêu 2 (Cào băng / Sủa chấn động), 50.000 gọi Mèo chúa / Chó chúa rồi thanh về 0. Hiệp 3 tim x1,5, 3 phút cuối tim x2. Phe đang thua nhiều được tim x1,3 (dấu ⚡).
- Quà: 1–9 xu +20 lính · 10–19 xu +60 lính · 20–49 xu chiêu 1 · 50–99 xu chiêu 2 · 100–198 xu con chúa · 199+ con chúa kèm chiêu 2. Quà cộng thêm 10 tim/xu vào thanh.
- Trận 30 phút, 3 hiệp + 3 phút cuối. Mỗi thành 40.000 máu = 4 căn nhà, mất 1/4 máu sập 1 căn. Khiên: hiệp 1 không tụt dưới 75%, hiệp 2 dưới 50%, hiệp 3 dưới 25% → thành chỉ vỡ hẳn trong 3 phút cuối. Hết giờ thì phe còn nhiều máu hơn thắng.
- Phút 15 có Vua Chuột (boss chung) xuống giữa sân; phe đánh nó nhiều hơn được mạnh thêm 1 phút.
- Comment, tim, quà lúc đang hiện màn kết quả không mất: giữ lại, trận mới mở là tính.

## 6 câu hỏi thiết kế

1. Vào comment 1 câu: lính của mình chạy ra, tên mình đi đầu đội 5 giây, MC chào gộp tên.
2. 500 người: tối đa 1.200 lính/phe, 5 bảng tên/phe, hiệu ứng có trần, MC gom tên và bỏ câu cũ quá 20 giây. Đo 58–59 fps (máy dev).
3. Không lên hình vẫn góp: comment nào cũng cộng 💬 cho phe, tim cộng thanh chiêu chung.
4. Top 1 mỗi phe hiện to có 👑, top 2–3 chữ nhỏ ké bên dưới (ngay dưới nút chọn phe).
5. Người vào sau: 3 hiệp, Vua Chuột phút 15, 3 phút cuối tim x2, phe thua có ⚡.
6. Quà: chiêu ra ngay + băng rôn tên người tặng + MC cảm ơn đúng tên; con chúa có cận cảnh, rơi cái rầm, tên "Mèo chúa · Tên người tặng".

## File của game này

- `public/game.html`: TOÀN BỘ trận (PixiJS 7 từ cdnjs, luật, hiệu ứng, âm thanh, MC). Khối `C = {...}` là số liệu, `MC = {...}` là câu MC (nhiều bản mỗi lúc, không lặp liền). Mở thẳng `/game.html` (không `?embed`) có bảng thử riêng: mô phỏng 30 phút, tua x5, nghe thử giọng.
- `public/img/game/`: ảnh đã cắt nền (lính, con chúa, nhà, Vua Chuột). Ảnh gốc Gemini ở `_prototype/img/`, cắt lại bằng script `cut.py` (xóa nền caro giả, đổi giáp phe Chó sang đỏ cam, Vua Chuột sang tím).
- `public/sound/`: tiếng của chủ kênh (Pixabay). Tiếng "póc" khi lính va nhau tự tạo bằng code.
- `src/game/useGame.ts`: chuyển nguyên comment/tim/quà/chia sẻ/follow vào game, câu chúc theo comment, lệnh từ trang điều khiển, báo game trang stage nào được nói.
- `src/game/GameControls.tsx`: nút riêng ở trang điều khiển (trận, nhảy hiệp, **🧮 Kiểm tra đếm comment**, quà theo mức xu, mô phỏng 30 phút đông/ít khách, cài đặt MC).
- `server.ts`: thêm `/api/tts?eng=vn&voice=&temp=` gọi VieNeu ở `127.0.0.1:8000`, lỗi thì đọc Edge.

## MC

- Giọng VieNeu-TTS "Adam bựa" (`E:\02_AI\VieNeu-TTS`, chạy `.venv\Scripts\python -m apps.openai_speech`). `BAT-LIVE.bat` tự bật nếu chưa chạy. Chỉnh giọng/tốc độ/biểu cảm ở trang điều khiển (server nhớ trong settings.json).
- MC nằm trong game.html, 1 hàng đọc: ít khách (≤5 người) thì gọi tên hỏi han; đông (≥15) thì bình luận trận bằng số thật mỗi ~30 giây; ~75 giây rủ chia sẻ/rủ bạn nuôi chó mèo vào chơi. Không bao giờ đọc nguyên văn comment, không xin quà.
- Thẻ `[cười] [hắng giọng] [thở dài]` là tính năng thử nghiệm của VieNeu v3.

## Quyết định của chủ kênh

- 10/11/2026: 2 phe trái–phải (không trên–dưới). Tên phe Mèo vs Chó (bỏ Lửa/Băng, bỏ Đỏ/Đen để tránh dính cờ bạc). Nền vẫn băng/lửa cho dễ nhận diện.
- 10/11/2026: Có tính quà để ra chiêu nhanh hơn (chủ kênh chọn, khác skill tiktok-live-game). Mốc tim 5k / 15k / 50k cố định, không tính theo phút.
- 10/11/2026: Ảnh lính, con chúa, nhà, Vua Chuột do chủ kênh tạo bằng Gemini, phong cách sticker chibi nét dày.
- 10/11/2026: Trận 30 phút, cao trào dồn về cuối; boss rơi cái rầm có hào quang; có cận cảnh cho quà to.
- 10/11/2026: MC giọng Adam bựa (VieNeu), hài, có biểu cảm, chỉnh được tốc độ.
- 10/11/2026: Top 1 mỗi phe hiện to, top 2–3 ké nhỏ, đặt ngay dưới nút chọn phe.
- 10/11/2026: Đếm comment là quan trọng nhất: comment nào cũng phải tính (có nút kiểm tra 200 comment ở trang điều khiển).
- 10/11/2026: Chỉ nhận đúng "1" / "2" để chọn phe; gõ dãy "1111…" không chọn phe (vẫn tính 1 comment cho phe người đó đang ở).
- Chưa chốt: ô quà ghi "20 xu" hay đổi sang hình món quà (như Đại Chiến Con Giáp) cho an toàn chính sách TikTok.
