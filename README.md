# Mèo vs Chó

Game PK hai phe cho TikTok LIVE. Người xem gõ `1` vào phe Mèo, gõ `2` vào phe Chó. Mỗi comment thả lính ra sân, hai đạo quân đánh nhau giữa màn hình. Thả tim đủ mốc thì phe tung chiêu, tặng quà thì chiêu ra ngay. Một trận dài 30 phút và càng về cuối càng căng.

Màn hình dọc 1080×1920, chạy bằng PixiJS. Thử với khoảng 2.000 nhân vật trên sân vẫn được 58–59 fps (đo trên máy dev, chưa đo lúc đang stream).

## Cách chơi

- **Chọn phe:** `1`, `1111`, `mèo` vào Mèo; `2`, `2222`, `chó` vào Chó. Ai chưa chọn mà comment, thả tim hay tặng quà thì được xếp vào phe đang ít người. Đổi phe được, 20 giây đổi 1 lần.
- **Comment:** comment nào cũng được cộng cho phe, kể cả gõ liên tục. Mỗi người thả tối đa 1 đội 5 lính mỗi 1,5 giây.
- **Tim:** mỗi phe 1 thanh. 5.000 tim ra chiêu 1 (Mưa cá khô / Mưa xương), 15.000 ra chiêu 2 (Cào băng / Sủa chấn động), 50.000 gọi Mèo chúa / Chó chúa.
- **Quà:** 1–9 xu +20 lính, 10–19 xu +60 lính, 20 xu chiêu 1, 50 xu chiêu 2, 100 xu con chúa, 199 xu con chúa kèm chiêu 2.
- **Trận 30 phút:** 3 hiệp và 3 phút cuối. Hiệp 3 tim tính x1,5, 3 phút cuối x2. Phe thua nhiều được tim x1,3.
- **Thành:** mỗi bên 4 căn nhà, mất 1/4 máu thì sập 1 căn. Nhà có khiên theo hiệp nên chỉ vỡ hẳn trong 3 phút cuối.
- **Vua Chuột:** phút 15 rơi xuống giữa sân, phe đánh nó nhiều hơn được mạnh thêm 1 phút.

## Có gì trên màn hình

- Top 5 mỗi phe ngay dưới nút chọn phe: top 1 to có vương miện, top 2–5 chữ nhỏ.
- Số comment của từng phe dưới sân.
- Con chúa rơi xuống có cận cảnh, chậm hình, mặt đất nứt, hào quang. Chiêu có ánh sáng và rung màn hình.
- Comment, tim, quà gửi lúc đang hiện màn kết quả vẫn được giữ lại, sang trận mới tính đủ.

## MC

- Đọc bằng giọng VieNeu-TTS ("Adam bựa") chạy trên máy. Không có VieNeu thì tự chuyển sang giọng Edge.
- Lúc ít khách thì gọi tên người chơi, hỏi han cho họ comment. Lúc đông thì bình luận trận bằng số liệu thật. Thỉnh thoảng rủ chia sẻ live.
- Không bao giờ đọc nguyên văn comment, không xin quà. Tên bậy được thay bằng tên tài khoản.

## Âm thanh

Nhạc nền, tiếng chiêu, tiếng va chạm, tiếng mèo kêu chó sủa. Ở trang điều khiển có 3 thanh âm lượng riêng: nhạc nền, hiệu ứng, giọng MC.

## Chạy

1. Bấm đúp `BAT-LIVE.bat`. File tự bật VieNeu (nếu có ở `E:\02_AI\VieNeu-TTS`) và mở trang điều khiển.
2. Trang điều khiển: `http://localhost:3000`. Cổng bận thì dùng cổng kế tiếp, xem cửa sổ đen in ra.
3. Trong TikTok LIVE Studio thêm nguồn Link `http://lvh.me:3000/?view=stage`, khổ 1080×1920.
4. Gõ tên TikTok vào ô Kết nối.

Trang điều khiển có nút giả lập (gõ 1/2, tim, quà theo mức xu), live tự động 10/50/100 người, mô phỏng trọn trận 30 phút, và nút kiểm tra đếm comment (gửi 200 comment đủ kiểu rồi so số đếm).

## Cấu trúc

- `public/game.html`: toàn bộ trận đấu (luật, hiệu ứng, âm thanh, MC).
- `public/img/game/`, `public/sound/`: hình và tiếng.
- `src/game/`: nối sự kiện TikTok vào game, nút điều khiển.
- `src/live/`, `server.ts`: phần dùng chung (kết nối TikTok, giọng đọc, trang điều khiển).

## Lưu ý

- Kết nối TikTok qua thư viện không chính thức `tiktok-live-connector`. Đây là cách TikTok không hỗ trợ, có rủi ro với tài khoản.
- Hình nhân vật tạo bằng Gemini. Tiếng hiệu ứng tải từ Pixabay.
