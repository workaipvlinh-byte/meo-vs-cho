import { useState } from 'react';
import { IS_STAGE } from './live/page';
import { StageFrame } from './live/StageFrame';
import { Dashboard } from './live/Dashboard';
import { sendControl } from './live/page';
import { useGame } from './game/useGame';
import { GameStage } from './game/GameStage';
import { GameControls, ViewSwitch, type ViewMode } from './game/GameControls';

// Live tự động 10/50/100 người: comment đủ kiểu như người thật, chạy 1 trận 5 phút
const AUTO_COMMENTS = ['1111', '1 nha', 'hay quá', 'mèo đâu', 'cố lên'];
const AUTO = {
  durationMs: 300_000,
  comment: (i: number) => (Math.random() < 0.7 ? String((i % 2) + 1) : AUTO_COMMENTS[Math.floor(Math.random() * AUTO_COMMENTS.length)]),
  onStart: () => void sendControl('custom', 'len:300'),
};

export default function App() {
  const game = useGame();
  const [mode, setMode] = useState<ViewMode>(() => (localGet('viewMode') as ViewMode) || 'both');
  const choose = (m: ViewMode) => {
    setMode(m);
    localSet('viewMode', m);
  };

  // Trang cho TikTok LIVE Studio: chỉ có màn hình game, DUY NHẤT trang này phát tiếng
  if (IS_STAGE) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <StageFrame>
          <GameStage />
        </StageFrame>
      </div>
    );
  }

  // Trang điều khiển (im lặng): 3 chế độ xem
  const switcher = (
    <div className="fixed right-3 top-3 z-50">
      <ViewSwitch mode={mode} onChange={choose} />
    </div>
  );
  if (mode === 'game') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        {switcher}
        <StageFrame>
          <GameStage />
        </StageFrame>
      </div>
    );
  }
  return (
    <>
      {switcher}
      <div className="pt-12">
        <Dashboard
          status={game.status}
          channelName={game.channelName}
          preview={
            mode === 'both' ? (
              <StageFrame maxHeight={720}>
                <GameStage />
              </StageFrame>
            ) : null
          }
          top={<OpenStage />}
          extra={<GameControls prefs={game.mcPrefs} />}
          autoLive={AUTO}
        />
      </div>
    </>
  );
}

// Mở tab chỉ có màn hình game (đúng trang đưa vào LIVE Studio): tự co vừa cửa sổ theo tỉ lệ 1080x1920, có tiếng + MC.
function OpenStage() {
  return (
    <section className="space-y-2 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
      <button
        onClick={() => window.open('/?view=stage', 'meo-vs-cho-stage')}
        className="w-full rounded-xl bg-amber-500 px-4 py-3 text-base font-bold text-slate-950 hover:bg-amber-400"
      >
        🖥 Mở tab chỉ có game (1080×1920, có tiếng + MC)
      </button>
      <p className="text-xs text-slate-400">
        Tab này giống hệt trang trong TikTok LIVE Studio. Chỉ trang game mở sau cùng được nói, nên nếu LIVE Studio đang mở game thì đừng mở thêm tab này (sẽ cướp giọng).
      </p>
    </section>
  );
}

function localGet(k: string) {
  try {
    return localStorage.getItem(k) || '';
  } catch {
    return '';
  }
}
function localSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    // bỏ qua
  }
}
