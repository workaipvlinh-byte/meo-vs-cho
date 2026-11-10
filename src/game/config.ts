// =====================================================
//  CẤU HÌNH GAME Mèo vs Chó
//  Luật trận, số liệu và gần hết câu MC nằm trong public/game.html (khối C = {...} và MC = {...}).
//  Ở đây chỉ là phần "người dẫn" phía khung: tên kênh, giọng MC mặc định, câu chúc theo comment.
// =====================================================

import type { WishTopic } from '../live/chatter';

export const GAME = {
  title: 'Mèo vs Chó',
  defaultChannelName: 'kênh mình',

  // MC mặc định (đổi ở trang điều khiển, server nhớ). Giọng của VieNeu-TTS; VieNeu chưa bật thì tự đọc bằng Edge.
  // Âm lượng: nhạc nền / tiếng hiệu ứng (0 tới 1.5) và giọng MC (0 tới 1). Nhạc nền mặc định một nửa cho MC rõ.
  mc: { mcOn: '1', mcVoice: 'Adam bựa', mcSpeed: '1.15', mcExpr: '0.95', musicVol: '0.5', sfxVol: '1', mcVol: '1' } as Record<string, string>,
  voices: ['Adam bựa', 'Thiện Minh', 'Hải Đăng', 'Trúc Ly', 'Mai Anh'],

  // Comment có lời cầu chúc -> đọc 1 câu chúc soạn sẵn. KHÔNG BAO GIỜ đọc nguyên văn comment.
  wishPerUserMs: 10 * 60_000,
  wishGlobalMs: 30_000,
  wishReplies: {
    exam: [(name: string) => `Chúc ${name} thi đâu đậu đó nha!`],
    health: [(name: string) => `Chúc ${name} với người nhà mau khỏe nha.`],
    love: [(name: string) => `Chúc ${name} sớm gặp người thương mình thật lòng.`],
    family: [(name: string) => `Chúc nhà ${name} lúc nào cũng vui vẻ.`],
    work: [(name: string) => `Chúc ${name} công việc thuận lợi nha.`],
    wealth: [(name: string) => `Chúc ${name} làm ăn phát đạt luôn.`],
    peace: [(name: string) => `Chúc ${name} mọi chuyện bình an.`],
  } as Record<WishTopic, ((name: string) => string)[]>,
};
