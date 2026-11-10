import { useEffect, useRef, useState } from 'react';
import { useLiveEvents } from '../live/useLiveEvents';
import type { LiveStatus } from '../live/types';
import { speakableName, voice } from '../live/voice';
import { containsBanned } from '../live/bannedWords';
import { detectWish, makePicker, WishLimiter } from '../live/chatter';
import { IS_STAGE } from '../live/page';
import { GAME } from './config';
import { gameApi } from './frame';

const pick = makePicker();

/**
 * Nhận sự kiện TikTok từ server và chuyển NGUYÊN VẸN vào game (public/game.html).
 * Game tự đếm comment / tim / quà cho từng phe và tự lo MC (một hàng đọc duy nhất, không bao giờ 2 giọng).
 * Ở đây chỉ: làm sạch tên, câu chúc theo comment, lệnh từ trang điều khiển, và báo game trang nào được nói.
 */
export function useGame() {
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [channelName, setChannelName] = useState(GAME.defaultChannelName);
  const prefs = useRef<Record<string, string>>({ ...GAME.mc });
  const [wishes] = useState(() => new WishLimiter(GAME.wishPerUserMs, GAME.wishGlobalMs));

  // Tên an toàn để hiện (tên có từ cấm thì dùng username) và tên đọc được cho MC
  const who = (nickname: string, username: string) => {
    const name = containsBanned(nickname) ? username : nickname;
    return { user: username, name, spoken: speakableName(name) };
  };

  useLiveEvents({
    onStatus: setStatus,
    // Comment nào cũng vào game: game đếm cho phe, kể cả "1111", chữ thường, gõ nhanh liên tục
    onChat: (e) => {
      const p = who(e.nickname, e.username);
      gameApi()?.event({ type: 'comment', text: e.comment, ...p });
      const topic = containsBanned(e.comment) ? null : detectWish(e.comment);
      const reply = topic && pick(GAME.wishReplies[topic] ?? []);
      if (reply && p.spoken !== 'bạn' && wishes.allow(e.username)) gameApi()?.sayText(reply(p.spoken), 1);
    },
    onGift: (e) => gameApi()?.event({ type: 'gift', coin: e.diamondCount, count: e.repeatCount, ...who(e.nickname, e.username) }),
    onLike: (e) => gameApi()?.event({ type: 'like', count: e.likeCount, ...who(e.nickname, e.username) }),
    onShare: (e) => gameApi()?.event({ type: 'share', ...who(e.nickname, e.username) }),
    onFollow: (e) => gameApi()?.event({ type: 'follow', ...who(e.nickname, e.username) }),

    onControl: (c) => {
      if (c.action === 'setName' && c.text) setChannelName(c.text);
      if (c.action === 'setPrefs' && c.text) {
        try {
          prefs.current = { ...prefs.current, ...JSON.parse(c.text) };
          gameApi()?.setMc(prefs.current);
        } catch {
          // bỏ qua JSON hỏng
        }
      }
      // Lệnh trận: chạy ở cả xem trước lẫn stage cho khớp nhau
      if (c.action === 'custom' && c.text) {
        const [cmd, arg] = c.text.split(':');
        if (cmd === 'match') gameApi()?.newMatch();
        if (cmd === 'len') gameApi()?.setLength(Number(arg));
        if (cmd === 'jump') gameApi()?.jump(Number(arg));
      }
      if (c.action === 'speak' && c.text) gameApi()?.sayText(c.text, 3); // game chỉ đọc ở trang stage
      if (c.action === 'reset') {
        gameApi()?.stopVoice();
        gameApi()?.newMatch();
        wishes.reset();
      }
    },
  });

  // Game tải xong thì nạp cài đặt MC; trên stage báo game có được nói không (server chỉ cho trang stage mở sau cùng nói)
  // Game trong khung luôn im cho tới khi được báo "trang này được nói"; game tải lại thì báo lại từ đầu.
  useEffect(() => {
    let seen: unknown = null;
    let lastSpeaker: boolean | null = null;
    const t = setInterval(() => {
      const api = gameApi();
      if (!api) return;
      if (api !== seen) {
        seen = api;
        lastSpeaker = null;
        api.setMc(prefs.current);
      }
      const may = IS_STAGE && voice.enabled;
      if (may !== lastSpeaker) {
        lastSpeaker = may;
        api.setSpeaker(may);
      }
    }, 500);
    return () => clearInterval(t);
  }, []);

  return { status, channelName };
}

export type GameState = ReturnType<typeof useGame>;
