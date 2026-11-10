# {TÊN GAME}: ghi chú cho Claude

> File này mô tả RIÊNG game này. Luật chung cho mọi game nằm ở `E:\VibeCode\CLAUDE.md` (Claude tự đọc cả hai).
> Khi chủ kênh chốt một quyết định (câu đọc, màu, font, luật chơi), ghi vào mục "Quyết định của chủ kênh".

## Ý tưởng

{Mô tả game trong 2–3 câu: người xem làm gì, quà làm gì, tim làm gì.}

## Luật chơi

- Tham gia: gõ {từ khóa}
- Comment: {…}
- Quà: {…}
- Tim: đủ {số} tim thì {…}

## File của game này

- `src/game/config.ts`: số liệu, câu đọc, từ khóa. Sửa nhỏ thì sửa ở đây trước.
- `src/game/useGame.ts`: luật chơi (xử lý chat, quà, tim, người vào).
- `src/game/GameStage.tsx`: màn hình trên live, khung 1080×1920.
- `src/game/…`: thêm component riêng của game ở đây.
- `src/live/`, `server.ts`: phần chung lấy từ `_base`, hạn chế sửa.

## Phần live dùng chung (có sẵn từ `_base`, game không cần làm lại)

- **Chống 2 giọng:** mỗi trang `?view=stage` có mã riêng (`STAGE_ID` trong `page.ts`), server giữ danh sách trang stage đang mở và báo qua sự kiện SSE `speaker`. Chỉ trang mở **sau cùng** phát tiếng, trang cũ tự im; đóng trang mới thì trang cũ nói lại. Trang điều khiển hiện cảnh báo đỏ khi có hơn 1 trang stage (`status.stages`).
- **MC tự gỡ kẹt:** đoạn nào 8 giây chưa phát được thì bỏ; đang phát quá độ dài đoạn + 4 giây thì cắt. Trình duyệt chặn tự phát tiếng thì thử lại 4 lần, mỗi lần cách 1,5 giây.
- **MC nói liền mạch:** đang đọc câu này thì tạo sẵn giọng câu kế; câu quà (ưu tiên) tạo sẵn ngay khi xếp hàng. Hàng ưu tiên (`voice.say(text, true)`) chờ tối đa 60 giây, hàng phụ (câu thường) 30 giây, quá thì bỏ.
- **Ký hiệu trong câu đọc** (viết trong `config.ts`):
  - `|` tách đoạn, ví dụ `'Trời ơi! | Bạn A lên top rồi'`
  - `^` ở đầu đoạn để hô to hơn (chỉ tăng âm lượng, không đổi cao độ), ví dụ `'^Hoan hô!'`
  - `M:` / `F:` cho 2 MC, nam NamMinh và nữ HoaiMy (`/api/tts?v=f`). Giọng giữ nguyên tới khi đổi. **Mặc định chỉ dùng 1 giọng nam**: câu không ghi gì là giọng nam.
- **Chọn giọng nam/nữ:** trang điều khiển có nút "Giọng MC" (lệnh `setVoice` M/F). Server nhớ trong `settings.json` và gửi lại cho trang mới mở. `GAME.voice` trong config.ts là giọng mặc định khi chưa chọn. Câu ghi `M:`/`F:` vẫn ép đúng giọng đó.
- **Giọng dự phòng:** Edge (NamMinh/HoaiMy) lỗi thì `/api/tts` tự chuyển sang giọng Google.
- **Live tự động** (`src/live/autoLive.ts`, khung Giả lập): chạy trọn 1 vòng với 10 / 50 / 100 người giả: vào phòng rải rác (có người vào muộn), comment, tim, quà nhỏ/vừa, 2 quà to, follow, share, 1 comment bậy. Game truyền `autoLive={{ durationMs, comment, onStart }}` vào `<Dashboard>` để comment đúng luật chơi và bắt đầu từ đầu vòng.
- **Cao độ giọng:** đặt biến môi trường `TTS_PITCH` (mặc định `-4%`) trong `.env` hoặc `BAT-LIVE.bat`, không cần sửa code.
- **Cổng tự lùi:** cổng 3000 bận (đang chạy game khác) thì server tự thử 3001, 3002… (tối đa 20 lần) và in rõ link điều khiển + link LIVE Studio đúng cổng vừa chọn. Cổng tự tải lại (HMR) từ 24680 cũng lùi như vậy. `BAT-LIVE.bat` để server tự mở đúng trang điều khiển. Nhớ: link trong LIVE Studio phải khớp cổng in ra.
- **Kết nối TikTok không treo:** hỏi TikTok xem tài khoản có đang live không trước, chưa live thì báo lỗi ngay; quá 30 giây chưa vào được phòng thì báo lỗi.

## Quyết định của chủ kênh

- {ví dụ: Font Lora. Nền public/assets/bg/xxx.webp.}
- {ví dụ: Câu chào: "..." giữ nguyên chữ.}
