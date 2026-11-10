import { AnimatePresence, motion } from 'motion/react';
import type { GameState } from './useGame';
import { GAME } from './config';
import { topPlayers } from '../live/scoreboard';

/**
 * Màn hình game trên live, vẽ theo khung 1080x1920.
 * Đây là phần thay đổi nhiều nhất giữa các game.
 */
export function GameStage({ game }: { game: GameState }) {
  const top = topPlayers(game.players, 5);
  const likePct = Math.min(100, (game.likeProgress / GAME.likesPerBoost) * 100);

  return (
    <div className={`relative h-full w-full overflow-hidden ${game.boosting ? 'stage-boost' : ''}`}>
      {/* Tiêu đề */}
      <div className="absolute inset-x-0 top-24 text-center">
        <h1 className="text-[88px] font-extrabold tracking-tight text-white drop-shadow-lg">{GAME.title}</h1>
        <p className="mt-2 text-[44px] text-amber-200">{GAME.subtitle}</p>
      </div>

      {/* Bảng xếp hạng */}
      <div className="absolute left-12 top-[360px] w-[520px] rounded-[36px] bg-black/45 p-8 backdrop-blur">
        <div className="mb-4 text-[38px] font-bold text-amber-300">🏆 Top</div>
        {top.length === 0 && <div className="text-[32px] text-white/60">Chưa có ai</div>}
        {top.map((p, i) => (
          <div key={p.username} className="flex items-center gap-4 py-2 text-[34px] text-white">
            <span className="w-10 font-bold text-amber-300">{i + 1}</span>
            {p.avatar ? (
              <img src={p.avatar} className="h-14 w-14 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-white/20" />
            )}
            <span className="flex-1 truncate">{p.nickname}</span>
            <span className="font-bold">{p.score}</span>
          </div>
        ))}
      </div>

      {/* Người đã tham gia */}
      <div className="absolute right-12 top-[360px] w-[400px] rounded-[36px] bg-black/45 p-8 text-white backdrop-blur">
        <div className="text-[38px] font-bold text-emerald-300">Đã tham gia</div>
        <div className="mt-2 text-[96px] font-extrabold leading-none">{game.joined.length}</div>
      </div>

      {/* Dòng sự kiện */}
      <div className="absolute bottom-[300px] left-12 right-12 flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {game.feed.slice(-6).map((f) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-4 self-start rounded-full bg-black/50 px-6 py-3 text-[32px] text-white"
            >
              <span className={f.kind === 'gift' ? 'font-bold text-pink-300' : 'font-bold text-sky-300'}>{f.name}</span>
              <span className="max-w-[640px] truncate">{f.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Thanh tim */}
      <div className="absolute bottom-[160px] left-12 right-12">
        <div className="mb-2 flex justify-between text-[32px] text-white">
          <span>❤️ Thả tim</span>
          <span>
            {game.likeProgress}/{GAME.likesPerBoost}
          </span>
        </div>
        <div className="h-8 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-pink-500 transition-all duration-500" style={{ width: `${likePct}%` }} />
        </div>
      </div>

      {/* Banner quà */}
      <AnimatePresence>
        {game.lastGift && (
          <motion.div
            key={game.lastGift.timestamp}
            initial={{ opacity: 0, scale: 0.6, y: 60 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute left-1/2 top-[900px] -translate-x-1/2 rounded-[40px] bg-gradient-to-r from-pink-500 to-amber-400 px-14 py-8 text-center text-white shadow-2xl"
          >
            <div className="text-[48px] font-extrabold">{game.lastGift.nickname}</div>
            <div className="text-[40px]">
              tặng {game.lastGift.repeatCount} × {game.lastGift.giftName} 🎁
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
