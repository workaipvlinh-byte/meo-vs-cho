import { useEffect, useRef, useState, type ReactNode } from 'react';
import { emitTest, sendControl } from '../live/page';
import { GAME } from './config';
import { gameApi } from './frame';

// Nút riêng của Mèo vs Chó ở trang điều khiển. Sự kiện giả đi qua server nên stage nhận y như live thật.
const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi'];
const TEN = ['Lan Anh', 'Minh Tuấn', 'Thu Hà', 'Quốc Bảo', 'Ngọc Mai', 'Hoàng Long', 'Gia Huy', 'Khánh Vy', 'Bé Na 🌸', 'duyanh99'];
let uid = 0;
const who = () => {
  uid++;
  const nickname = uid % 7 === 0 ? TEN[uid % TEN.length] : `${HO[uid % HO.length]} ${TEN[(uid * 3) % TEN.length]}`;
  return { nickname, username: `test${Date.now().toString(36)}${uid}` };
};
const GIFTS = [
  { diamondCount: 1, giftName: 'Hoa hồng', label: '🌹 1 xu · thêm lính' },
  { diamondCount: 10, giftName: 'Quà 10 xu', label: '10 xu · +60 lính' },
  { diamondCount: 20, giftName: 'Quà 20 xu', label: '🐟 20 xu · chiêu 1' },
  { diamondCount: 50, giftName: 'Quà 50 xu', label: '⚡ 50 xu · chiêu 2' },
  { diamondCount: 100, giftName: 'Quà 100 xu', label: '👑 100 xu · con chúa' },
  { diamondCount: 199, giftName: 'Quà 199 xu', label: '199 xu · chúa + chiêu 2' },
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function GameControls({ prefs }: { prefs: Record<string, string> }) {
  const [side, setSide] = useState<'1' | '2'>('1');
  const [count, setCount] = useState('');
  const [mc, setMc] = useState<Record<string, string>>({ ...GAME.mc, ...prefs });
  useEffect(() => setMc((m) => ({ ...m, ...prefs })), [prefs]); // server gửi lại cài đặt đã lưu
  const sim = useRef<(() => void) | null>(null);
  const [simInfo, setSimInfo] = useState('');

  // một người giả chọn phe rồi làm việc gì đó (tim/quà phải có phe trước)
  const asPlayer = async (s: string, then?: (u: ReturnType<typeof who>) => Promise<void>) => {
    const u = who();
    await emitTest('chat', { ...u, comment: s });
    await then?.(u);
  };

  // ---- Kiểm tra đếm comment: gửi đủ kiểu comment, so với số game đếm được ----
  const testCount = async () => {
    const api = gameApi();
    if (!api) return setCount('Game chưa tải xong, thử lại sau vài giây.');
    if (api.phase() !== 'fight') return setCount('Đang màn kết quả, chờ trận mới rồi thử (comment lúc này vẫn được tính vào trận sau).');
    const before = api.stats().cmt;
    const forms = ['1', '2', '1111', '2222', '1 nha', '2❤️', 'hay quá', 'cố lên', 'mèo ơi', 'chó đâu', '１'];
    const people = Array.from({ length: 40 }, who);
    let sent = 0;
    setCount('Đang gửi...');
    for (let i = 0; i < 200; i++) {
      const u = people[i % people.length];
      // cùng 1 người gõ liên tục, sát nhau (nhanh hơn 1,5 giây) vẫn phải được đếm
      await emitTest('chat', { ...u, comment: forms[i % forms.length] });
      sent++;
    }
    await sleep(1500);
    const after = gameApi()?.stats().cmt ?? before;
    const got = after[0] - before[0] + (after[1] - before[1]);
    setCount(`Gửi ${sent} comment, game đếm ${got}. ${got === sent ? '✅ Khớp, không sót comment nào.' : '❌ Lệch, báo Claude kiểm tra.'} (Mèo +${after[0] - before[0]}, Chó +${after[1] - before[1]})`);
  };

  // ---- Mô phỏng trọn trận 30 phút (người vào từ từ, 3 đợt dồn dập) / live ít khách ----
  const startSim = (kind: 'full' | 'low') => {
    sim.current?.();
    const SCRIPT: [number, number, number, number, number, string][] =
      kind === 'full'
        ? [
            [0, 12, 120, 0.5, 0, 'Mở live, người vào lác đác'],
            [2, 30, 360, 0.5, 0, 'Người vào đều đều'],
            [8, 60, 40, 0.65, 60, 'DỒN DẬP 1: lên đề xuất'],
            [11, 15, 240, 0.5, 0, 'Lắng xuống'],
            [15, 45, 30, 0.3, 75, 'DỒN DẬP 2: Vua Chuột, phe Chó dồn quân'],
            [19, 20, 300, 0.5, 0, 'Đều đều'],
            [27, 150, 60, 0.5, 180, 'DỒN DẬP 3: 3 phút cuối'],
          ]
        : [
            [0, 2, 240, 0.5, 0, 'Vắng: 1-2 người'],
            [6, 3, 480, 0.5, 0, 'Vẫn vắng'],
            [16, 3, 360, 0.5, 0, 'Thêm vài người'],
            [26, 6, 120, 0.5, 45, 'Cuối trận thêm chút người'],
          ];
    void sendControl('custom', 'len:1800');
    const t0 = Date.now();
    const crowd: { u: ReturnType<typeof who>; side: string; at: number; until: number; next: number }[] = [];
    const rushes: [number, number][] = [];
    const fired = new Set<number>();
    let label = '';
    const timer = setInterval(() => {
      const el = (Date.now() - t0) / 1000;
      if (el > 1800) return stop();
      SCRIPT.forEach(([min, n, over, share, rush, lb], i) => {
        if (fired.has(i) || el < min * 60) return;
        fired.add(i);
        label = lb;
        if (rush) rushes.push([el, el + rush]);
        for (let j = 0; j < n; j++)
          crowd.push({ u: who(), side: Math.random() < share ? '1' : '2', at: el + Math.random() * over, until: min >= 27 ? 1e9 : el + 180 + Math.random() * 720, next: 0 });
      });
      const busy = rushes.some(([a, b]) => el >= a && el <= b) ? 3 : 1;
      let active = 0;
      for (const p of crowd) {
        if (el < p.at || el > p.until) continue;
        active++;
        if (el < p.next) continue;
        p.next = el + (6 + Math.random() * 14) / busy;
        void emitTest('chat', { ...p.u, comment: Math.random() < 0.7 ? p.side : ['hay', 'cố lên', '❤️', 'đánh đi'][Math.floor(Math.random() * 4)] });
        if (Math.random() < (busy > 1 ? 0.8 : 0.35)) void emitTest('like', { ...p.u, likeCount: busy > 1 ? 20 + Math.floor(Math.random() * 60) : 5 + Math.floor(Math.random() * 25) });
        const r = Math.random() / busy;
        const g = r < 0.02 ? GIFTS[0] : r < 0.023 ? GIFTS[1] : r < 0.025 ? GIFTS[2] : r < 0.0258 ? GIFTS[3] : r < 0.0261 ? GIFTS[4] : null;
        if (g) void emitTest('gift', { ...p.u, giftName: g.giftName, giftId: g.diamondCount, diamondCount: g.diamondCount, repeatCount: 1 });
      }
      setSimInfo(`Phút ${(el / 60).toFixed(1)}/30 · ${active} người đang xem · ${busy > 1 ? '🔥 ' : ''}${label}`);
    }, 250);
    const stop = () => {
      clearInterval(timer);
      sim.current = null;
      setSimInfo('Đã dừng mô phỏng.');
    };
    sim.current = stop;
  };
  useEffect(() => () => sim.current?.(), []);

  const saveMc = (patch: Record<string, string>) => {
    const next = { ...mc, ...patch };
    setMc(next);
    void sendControl('setPrefs', JSON.stringify(patch));
  };

  return (
    <section className="space-y-4 rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
      <h2 className="font-semibold">Mèo vs Chó</h2>

      <Row title="Trận đấu">
        <B onClick={() => sendControl('custom', 'match')}>⚔️ Trận mới</B>
        <B onClick={() => sendControl('custom', 'len:1800')}>30 phút</B>
        <B onClick={() => sendControl('custom', 'len:300')}>5 phút (thử)</B>
        <B onClick={() => sendControl('custom', 'len:90')}>90 giây (thử)</B>
        <span className="self-center text-xs text-slate-500">Nhảy tới:</span>
        <B onClick={() => sendControl('custom', 'jump:1')}>Hiệp 2</B>
        <B onClick={() => sendControl('custom', 'jump:1.5')}>Vua Chuột</B>
        <B onClick={() => sendControl('custom', 'jump:2')}>Hiệp 3</B>
        <B onClick={() => sendControl('custom', 'jump:3')}>3 phút cuối</B>
      </Row>

      <Row title="Đếm comment (cái quyết định thắng thua)">
        <B onClick={testCount}>🧮 Kiểm tra đếm comment (gửi 200 comment đủ kiểu)</B>
        {count && <div className="w-full text-sm text-amber-300">{count}</div>}
      </Row>

      <Row title="Người xem giả">
        <B onClick={() => asPlayer('1')}>Gõ "1"</B>
        <B onClick={() => asPlayer('2')}>Gõ "2"</B>
        <B onClick={() => asPlayer('1111')}>Gõ "1111" (không chọn phe)</B>
        <B onClick={() => asPlayer('hay quá')}>Comment thường (chưa chọn phe)</B>
        <B onClick={() => asPlayer('1', (u) => emitTest('like', { ...u, likeCount: 1000 }))}>+1k tim phe Mèo</B>
        <B onClick={() => asPlayer('2', (u) => emitTest('like', { ...u, likeCount: 1000 }))}>+1k tim phe Chó</B>
        <B onClick={() => asPlayer('1', (u) => emitTest('share', u))}>↗ Chia sẻ</B>
        <B onClick={() => asPlayer('2', (u) => emitTest('follow', u))}>➕ Theo dõi</B>
      </Row>

      <Row title="Quà">
        <B onClick={() => setSide('1')} on={side === '1'}>
          Phe Mèo
        </B>
        <B onClick={() => setSide('2')} on={side === '2'}>
          Phe Chó
        </B>
        {GIFTS.map((g) => (
          <B key={g.diamondCount} onClick={() => asPlayer(side, (u) => emitTest('gift', { ...u, giftName: g.giftName, giftId: g.diamondCount, diamondCount: g.diamondCount, repeatCount: 1 }))}>
            {g.label}
          </B>
        ))}
      </Row>

      <Row title="Mô phỏng trọn trận 30 phút (chạy thật 30 phút, stage nhận như live)">
        <B onClick={() => startSim('full')}>▶ Live đông (3 đợt dồn dập)</B>
        <B onClick={() => startSim('low')}>▶ Live ít khách</B>
        <B onClick={() => sim.current?.()}>■ Dừng</B>
        {simInfo && <div className="w-full text-sm text-amber-300">{simInfo}</div>}
      </Row>

      <Row title="Âm lượng trên live (đổi ngay, server nhớ cho lần sau)">
        <Vol label="🎵 Nhạc nền" value={mc.musicVol} max={1.5} onChange={(v) => saveMc({ musicVol: v })} />
        <Vol label="💥 Tiếng hiệu ứng" value={mc.sfxVol} max={1.5} onChange={(v) => saveMc({ sfxVol: v })} />
        <Vol label="🗣 Giọng MC" value={mc.mcVol} max={1} onChange={(v) => saveMc({ mcVol: v })} />
      </Row>

      <Row title="MC: Nam Minh / Hoài My dùng được ngay; Adam bựa và các giọng khác cần cài VieNeu-TTS (chưa bật thì tự đọc Nam Minh)">
        <B onClick={() => saveMc({ mcOn: mc.mcOn === '0' ? '1' : '0' })} on={mc.mcOn !== '0'}>
          {mc.mcOn === '0' ? '🔇 MC đang tắt' : '🗣 MC đang bật'}
        </B>
        <select value={mc.mcVoice} onChange={(e) => saveMc({ mcVoice: e.target.value })} className="rounded-lg bg-slate-800 px-2 py-2 text-sm">
          {GAME.voices.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          tốc độ
          <input type="range" min="0.9" max="1.5" step="0.05" value={mc.mcSpeed} onChange={(e) => saveMc({ mcSpeed: e.target.value })} />
          {Number(mc.mcSpeed).toFixed(2)}x
        </label>
        <label className="flex items-center gap-2 text-sm">
          biểu cảm
          <input type="range" min="0.6" max="1.3" step="0.05" value={mc.mcExpr} onChange={(e) => saveMc({ mcExpr: e.target.value })} />
          {Number(mc.mcExpr).toFixed(2)}
        </label>
        <B onClick={() => sendControl('speak', '[cười] Mèo với Chó lại chạm mặt rồi bà con ơi! Gõ 1 theo Mèo, gõ 2 theo Chó nha!')}>▶ Nghe thử trên stage</B>
      </Row>
    </section>
  );
}

/** 3 chế độ xem của trang điều khiển */
export type ViewMode = 'game' | 'both' | 'panel';
export function ViewSwitch({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const opts: [ViewMode, string][] = [
    ['game', 'Chỉ game'],
    ['both', 'Game + bảng điều khiển'],
    ['panel', 'Chỉ bảng điều khiển'],
  ];
  return (
    <div className="flex gap-1 rounded-xl bg-slate-900/90 p-1 ring-1 ring-slate-700 backdrop-blur">
      {opts.map(([m, label]) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${mode === m ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// thanh kéo âm lượng: 0 = tắt hẳn, hiện theo phần trăm
function Vol({ label, value, max, onChange }: { label: string; value: string; max: number; onChange: (v: string) => void }) {
  return (
    <label className="flex w-full items-center gap-3 text-sm">
      <span className="w-36 shrink-0">{label}</span>
      <input type="range" min="0" max={max} step="0.05" value={value} onChange={(e) => onChange(e.target.value)} className="flex-1" />
      <span className="w-12 text-right tabular-nums">{Math.round(Number(value) * 100)}%</span>
    </label>
  );
}

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs text-slate-400">{title}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
function B({ children, onClick, on }: { children: ReactNode; onClick: () => void; on?: boolean }) {
  return (
    <button onClick={onClick} className={`rounded-lg px-3 py-2 text-sm font-medium ${on ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 hover:bg-slate-700'}`}>
      {children}
    </button>
  );
}
