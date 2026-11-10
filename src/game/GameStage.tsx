import { IS_STAGE } from '../live/page';
import { frame } from './frame';

/**
 * Màn hình game 1080x1920. Toàn bộ trận đấu (PixiJS, hiệu ứng, âm thanh, MC giọng VieNeu) nằm trong public/game.html,
 * ở đây chỉ nhúng vào. Trang stage có tiếng; xem trước ở trang điều khiển thì im lặng (&mute=1).
 */
export function GameStage() {
  return (
    <iframe
      ref={(el) => {
        frame.el = el;
      }}
      src={`/game.html?embed=1${IS_STAGE ? '' : '&mute=1'}`}
      title="Mèo vs Chó"
      className="block h-full w-full border-0"
      allow="autoplay"
    />
  );
}
