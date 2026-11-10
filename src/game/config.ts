// =====================================================
//  CẤU HÌNH GAME - phần lớn thay đổi nhỏ chỉ cần sửa file này
//  Câu đọc: `name` = tên người xem (đã làm sạch), `kenh` = tên kênh (ô "Tên kênh" ở trang điều khiển)
//  Muốn tắt tính năng nào thì để số thời gian = 0 hoặc danh sách câu rỗng [].
// =====================================================

import type { WishTopic } from '../live/chatter';

export const GAME = {
  title: 'TÊN GAME',
  subtitle: 'Gõ "join" để tham gia',

  // Tên kênh mặc định, tới khi chủ kênh lưu tên ở trang điều khiển
  defaultChannelName: 'kênh mình',

  // Giọng MC mặc định khi chưa chọn ở trang điều khiển: 'M' = nam NamMinh, 'F' = nữ HoaiMy
  voice: 'M' as 'M' | 'F',

  // Từ khóa trong comment để tham gia (so sánh không dấu, không hoa thường)
  joinKeywords: ['join', 'thamgia'],

  // Điểm
  pointsPerComment: 1,
  pointsPerCoin: 10, // 1 xu quà = 10 điểm

  // Thanh tim: đủ số tim này thì kích hoạt hiệu ứng
  likesPerBoost: 500,
  boostSeconds: 30,

  // ---------- Chào người vào ----------
  greetEveryMs: 6000, // gom người mới, 6 giây chào 1 lượt
  namesPerGreeting: 3, // 3 tên mỗi câu
  // more > 0: phòng đông, gộp "chào bạn A, bạn B, bạn C và 25 bạn nữa"
  greeting: (names: string, kenh: string, more = 0) =>
    more > 0 ? `${kenh} chào ${names} và ${more} bạn nữa vừa vào chơi.` : `${kenh} chào ${names} vừa vào chơi.`,

  // ---------- Cảm ơn quà ----------
  // Cùng 1 người tặng liên tục / combo: chỉ cảm ơn 1 lần mỗi 30 giây. Quà từ 99 xu luôn được cảm ơn.
  giftThanksCooldownMs: 30_000,
  bigGiftCoins: 99,
  thankGift: (name: string, gift: string, kenh: string) => `${kenh} cảm ơn bạn ${name} đã tặng ${gift}.`,
  // Đọc thêm 1 câu chúc ngẫu nhiên sau lời cảm ơn quà ([] = không đọc)
  giftWishes: [
    'Chúc bạn một ngày thật vui.',
    'Chúc bạn làm gì cũng suôn sẻ nha.',
    'Chúc cả nhà bạn mạnh khỏe, bình an.',
    'Chúc bạn may mắn cả tuần luôn.',
  ],

  // ---------- Theo dõi kênh (mỗi người cảm ơn 1 lần) ----------
  thankFollow: (name: string, kenh: string) => `${kenh} cảm ơn bạn ${name} đã theo dõi kênh nha.`,

  // ---------- Comment có lời cầu chúc ----------
  // Ai comment kiểu "mong mai thi được điểm cao" thì đọc 1 câu chúc đúng chủ đề.
  // KHÔNG BAO GIỜ đọc nguyên văn comment. Mỗi người 1 lần / 10 phút, cả phòng tối đa 1 lần / 20 giây.
  wishPerUserMs: 10 * 60_000,
  wishGlobalMs: 20_000,
  wishReplies: {
    exam: [
      (name: string) => `Chúc bạn ${name} ôn bài vô đầu, vào phòng thi thật bình tĩnh, điểm cao như mong muốn.`,
      (name: string) => `Chúc bạn ${name} học đâu nhớ đó, thi đâu đậu đó.`,
    ],
    health: [
      (name: string) => `Chúc bạn ${name} với người nhà mau khỏe, ăn ngon ngủ yên.`,
      (name: string) => `Chúc nhà bạn ${name} ai cũng khỏe, người đang mệt thì sớm bình phục.`,
    ],
    love: [
      (name: string) => `Chúc bạn ${name} sớm gặp người thương mình thật lòng.`,
      (name: string) => `Chúc bạn ${name} chuyện tình cảm êm đẹp, thương ai người đó cũng thương lại.`,
    ],
    family: [
      (name: string) => `Chúc nhà bạn ${name} luôn êm ấm, cha mẹ khỏe, con cái ngoan.`,
      (name: string) => `Chúc gia đình bạn ${name} lúc nào cũng vui vẻ, thương nhau.`,
    ],
    work: [
      (name: string) => `Chúc bạn ${name} công việc thuận lợi, sớm được như ý.`,
      (name: string) => `Chúc bạn ${name} tìm được việc ưng ý, làm đâu thuận đó.`,
    ],
    wealth: [
      (name: string) => `Chúc bạn ${name} làm ăn phát đạt, buôn may bán đắt.`,
      (name: string) => `Chúc bạn ${name} tiền vô đều tay, nợ nần sớm xong.`,
    ],
    peace: [
      (name: string) => `Chúc bạn ${name} mọi chuyện bình an, thuận lợi.`,
      (name: string) => `Chúc bạn ${name} gặp nhiều may mắn, đi đâu cũng bình an.`,
    ],
  } as Record<WishTopic, ((name: string) => string)[]>,

  // ---------- Nhắc chia sẻ live ----------
  // Mỗi 5 phút; có người vừa tương tác thì cảm ơn tối đa 3 tên trước.
  shareReminderEveryMs: 5 * 60_000,
  shareWithNames: (names: string, kenh: string) =>
    `${kenh} cảm ơn ${names} đã ghé chơi. Mọi người nhớ bấm chia sẻ live cho bạn bè cùng vào nha.`,
  shareLines: [
    'Mọi người thấy vui thì bấm chia sẻ live cho bạn bè cùng vào chơi nha.',
    'Thêm người là thêm vui, cả nhà bấm chia sẻ live giúp kênh nhé.',
  ],

  // ---------- Live im quá lâu ----------
  // Giọng im quá 90 giây thì đọc 1 câu cho đỡ trống.
  idleAfterMs: 90_000,
  idleLines: [
    'Ai mới vào thì gõ join để tham gia nha.',
    'Cả nhà thả tim cho đầy thanh, đủ tim là có bất ngờ.',
  ],

  boostLine: 'Đủ tim rồi, bùng nổ thôi!',
};
