/**
 * Server chung cho mọi game live TikTok. Game riêng KHÔNG cần sửa file này,
 * trừ khi cần thêm API mới (thêm vào cuối, chỗ "API riêng của game").
 *
 * - Kết nối phòng live TikTok (tiktok-live-connector 2.x, proto v3)
 * - Đẩy sự kiện xuống trình duyệt qua SSE: /api/tiktok/events
 * - Lệnh từ trang điều khiển -> trang stage: /api/control
 * - Giọng đọc tiếng Việt: /api/tts (Edge TTS, lỗi thì Google)
 * - Giả lập sự kiện để test không cần live: /api/test/emit
 */
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import http from 'http';
import net from 'net';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Giọng đọc. MC chính (câu không ghi gì hoặc "M:") là giọng nam; câu "F:" là MC nữ HoaiMy.
// Đổi cao độ không cần sửa code: đặt biến môi trường TTS_PITCH (vd "+6%", "-4%") trong .env hoặc BAT-LIVE.bat
const TTS_VOICE = process.env.TTS_VOICE || 'vi-VN-NamMinhNeural';
const TTS_VOICE_F = 'vi-VN-HoaiMyNeural';
const TTS_PITCH = process.env.TTS_PITCH || '-4%';

// Chặn DNS rebinding: trang web lạ trỏ tên miền của nó về 127.0.0.1 thì Host/Origin sẽ khác các tên dưới đây
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', 'lvh.me']);
const hostOk = (h?: string) => !!h && LOCAL_HOSTS.has(h.replace(/:\d+$/, '').toLowerCase());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!hostOk(req.headers.host) || (origin && !hostOk(origin.replace(/^https?:\/\//, '')))) return res.status(403).end();
  next();
});

app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

// ---------- SSE ----------
interface LiveStats {
  isConnected: boolean;
  isConnecting: boolean;
  username: string;
  roomId: string;
  viewerCount: number;
  totalLikes: number;
  error?: string;
  stages: number; // số trang ?view=stage đang mở (hơn 1 là có nguy cơ 2 giọng)
}

const emptyStats = (): LiveStats => ({
  isConnected: false,
  isConnecting: false,
  username: '',
  roomId: '',
  viewerCount: 0,
  totalLikes: 0,
  error: '',
  stages: 0,
});

let liveStats = emptyStats();
let sseClients: express.Response[] = [];
// Các trang stage đang mở (theo thứ tự mở). Chỉ trang mở SAU CÙNG được phát tiếng, tránh 2 giọng đọc đè nhau
// khi lỡ có 2 nguồn Link trong LIVE Studio hoặc mở thêm ?view=stage ở trình duyệt khác.
let stageIds: string[] = [];
const speakerInfo = () => ({ id: stageIds[stageIds.length - 1] ?? null, count: stageIds.length });
function announceSpeaker() {
  liveStats.stages = stageIds.length;
  broadcast('speaker', speakerInfo());
  broadcast('status', liveStats); // trang điều khiển hiện cảnh báo khi có hơn 1 trang stage
}
let activeConn: InstanceType<typeof TikTokLiveConnection> | null = null;
let lastRateControl: { action: string; text: string } | null = null;

// Tên kênh (giọng đọc + tiêu đề) và giọng MC nam/nữ lưu ở settings.json cạnh file này, tắt server mở lại vẫn còn
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
let lastNameControl: { action: string; text: string } | null = null;
let lastVoiceControl: { action: string; text: string } | null = null;
let lastThemeControl: { action: string; text: string } | null = null; // giao diện game chọn ở trang điều khiển
let lastPrefsControl: { action: string; text: string } | null = null; // cài đặt riêng của game (chữ tùy chỉnh, nhạc nền...)
let settings: { channelName?: string; voice?: string; theme?: string; prefs?: Record<string, string> } = {};
try {
  settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) || {};
  if (typeof settings.channelName === 'string' && settings.channelName.trim()) {
    lastNameControl = { action: 'setName', text: settings.channelName.trim() };
  }
  if (settings.voice === 'M' || settings.voice === 'F') lastVoiceControl = { action: 'setVoice', text: settings.voice };
  if (typeof settings.theme === 'string' && /^[a-z0-9-]{1,40}$/.test(settings.theme)) lastThemeControl = { action: 'setTheme', text: settings.theme };
  const p = cleanPrefs(settings.prefs);
  if (p) lastPrefsControl = { action: 'setPrefs', text: JSON.stringify(p) };
} catch {
  // chưa lưu gì: dùng mặc định trong config.ts
}
/** Cài đặt game: object chữ -> chữ, tối đa 40 mục, mỗi mục 120 ký tự. Sai dạng -> null */
function cleanPrefs(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v).slice(0, 40)) {
    if (/^[a-zA-Z0-9_]{1,40}$/.test(k) && typeof val === 'string') out[k] = val.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 120);
  }
  return out;
}
function saveSettings(patch: typeof settings) {
  settings = { ...settings, ...patch };
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Không lưu được settings.json:', err);
  }
}

function broadcast(eventType: string, data: unknown) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      // trình duyệt đã đóng
    }
  }
}

app.get('/api/tiktok/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(`event: status\ndata: ${JSON.stringify(liveStats)}\n\n`);
  if (lastRateControl) res.write(`event: control\ndata: ${JSON.stringify(lastRateControl)}\n\n`);
  if (lastNameControl) res.write(`event: control\ndata: ${JSON.stringify(lastNameControl)}\n\n`);
  if (lastVoiceControl) res.write(`event: control\ndata: ${JSON.stringify(lastVoiceControl)}\n\n`);
  if (lastThemeControl) res.write(`event: control\ndata: ${JSON.stringify(lastThemeControl)}\n\n`);
  if (lastPrefsControl) res.write(`event: control\ndata: ${JSON.stringify(lastPrefsControl)}\n\n`);
  sseClients.push(res);
  const stageId = typeof req.query.stage === 'string' ? req.query.stage.slice(0, 40) : '';
  if (stageId) {
    stageIds = [...stageIds.filter((x) => x !== stageId), stageId];
    announceSpeaker();
  } else res.write(`event: speaker
data: ${JSON.stringify(speakerInfo())}

`);

  const heartbeat = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter((c) => c !== res);
    if (stageId) {
      stageIds = stageIds.filter((x) => x !== stageId);
      announceSpeaker();
    }
  });
});

app.get('/api/tiktok/status', (_req, res) => res.json({ success: true, data: liveStats }));

// ---------- Đọc dữ liệu TikTok (proto v3) ----------
const userOf = (data: any) => data?.user?.displayId || data?.user?.uniqueId || data?.uniqueId || 'nguoi-xem';
const nickOf = (data: any) => data?.user?.nickname || data?.nickname || data?.uniqueId || 'Bạn';
const avatarOf = (data: any) => data?.user?.avatarThumb?.urlList?.[0] || '';

app.post('/api/tiktok/connect', async (req, res) => {
  const cleanUser = String(req.body?.username || '').replace(/^@/, '').trim();
  if (!cleanUser) return res.status(400).json({ success: false, error: 'Chưa nhập username TikTok' });

  if (activeConn) {
    try {
      activeConn.disconnect();
    } catch {
      // bỏ qua
    }
    activeConn = null;
  }

  liveStats = { ...emptyStats(), isConnecting: true, username: cleanUser, stages: stageIds.length };
  broadcast('status', liveStats);

  const conn = new TikTokLiveConnection(cleanUser, {
    processInitialData: true,
    // Lấy danh sách quà cần gói trả phí Euler Stream; sự kiện quà đã có tên và kim cương
    enableExtendedGiftInfo: false,
  });

  conn.on(ControlEvent.CONNECTED, (state: { roomId?: string }) => {
    console.log(`[TikTok] Đã kết nối @${cleanUser}, room ${state?.roomId}`);
    liveStats = { ...liveStats, isConnected: true, isConnecting: false, roomId: state?.roomId || '', error: '' };
    broadcast('status', liveStats);
  });

  conn.on(ControlEvent.DISCONNECTED, () => {
    console.log(`[TikTok] Mất kết nối @${cleanUser}`);
    liveStats = { ...liveStats, isConnected: false, isConnecting: false };
    broadcast('status', liveStats);
  });

  conn.on(WebcastEvent.STREAM_END, () => {
    liveStats = { ...liveStats, isConnected: false, isConnecting: false, error: 'Phiên live đã kết thúc' };
    broadcast('status', liveStats);
  });

  conn.on(WebcastEvent.CHAT, (data: any) => {
    broadcast('chat', {
      username: userOf(data),
      nickname: nickOf(data),
      comment: data?.content || data?.comment || '', // proto v3: chữ nằm ở `content`
      avatar: avatarOf(data),
      timestamp: Date.now(),
    });
  });

  // TikTok gửi lại quà combo với repeatCount cộng dồn; chỉ chuyển phần mới
  const streakCounts = new Map<string, number>();
  conn.on(WebcastEvent.GIFT, (data: any) => {
    const username = userOf(data);
    const giftId = data?.giftId || 0;
    const key = `${username}_${giftId}`;
    const total = data?.repeatCount || 1;
    const delta = total - (streakCounts.get(key) || 0);
    const isStreakable = (data?.gift?.type ?? data?.giftDetails?.giftType ?? data?.giftType) === 1;
    if (isStreakable && !data?.repeatEnd) streakCounts.set(key, total);
    else streakCounts.delete(key);
    if (delta <= 0) return;

    broadcast('gift', {
      username,
      nickname: nickOf(data),
      giftName: data?.gift?.name || data?.giftDetails?.giftName || data?.giftName || 'Quà',
      giftId,
      diamondCount: data?.gift?.diamondCount || data?.diamondCount || data?.giftDetails?.diamondCount || 1,
      repeatCount: delta,
      avatar: avatarOf(data),
      timestamp: Date.now(),
    });
  });

  conn.on(WebcastEvent.MEMBER, (data: any) => {
    broadcast('member', { username: userOf(data), nickname: nickOf(data), avatar: avatarOf(data), timestamp: Date.now() });
  });

  conn.on(WebcastEvent.FOLLOW, (data: any) => {
    broadcast('follow', { username: userOf(data), nickname: nickOf(data), avatar: avatarOf(data), timestamp: Date.now() });
  });

  conn.on(WebcastEvent.SHARE, (data: any) => {
    broadcast('share', { username: userOf(data), nickname: nickOf(data), avatar: avatarOf(data), timestamp: Date.now() });
  });

  conn.on(WebcastEvent.ROOM_USER, (data: any) => {
    if (typeof data?.viewerCount === 'number') {
      liveStats.viewerCount = data.viewerCount;
      broadcast('roomUser', { viewerCount: data.viewerCount });
    }
  });

  conn.on(WebcastEvent.LIKE, (data: any) => {
    if (typeof data?.totalLikeCount === 'number') liveStats.totalLikes = data.totalLikeCount;
    broadcast('like', {
      username: userOf(data),
      nickname: nickOf(data),
      likeCount: data?.likeCount || 1,
      totalLikes: liveStats.totalLikes,
    });
  });

  conn.on(ControlEvent.ERROR, (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[TikTok] Lỗi @${cleanUser}:`, msg);
    liveStats.error = msg;
    broadcast('status', liveStats);
  });

  activeConn = conn;

  try {
    // Chưa LIVE thì thư viện có thể treo mãi ở "Đang kết nối": hỏi TikTok trước, báo lỗi ngay
    const live = await conn.fetchIsLive().catch(() => true); // hỏi lỗi thì cứ thử kết nối
    if (!live) throw new Error('TikTok báo tài khoản này CHƯA LIVE. Bấm Phát trực tiếp trong LIVE Studio trước rồi mới kết nối');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const state = await Promise.race([
      conn.connect(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('quá 30 giây không vào được phòng live')), 30_000);
      }),
    ]).finally(() => clearTimeout(timer));
    return res.json({ success: true, roomId: state?.roomId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // chỉ dọn nếu chưa có lần bấm Kết nối mới hơn thay chỗ
    if (activeConn === conn) {
      try {
        conn.disconnect();
      } catch {
        // bỏ qua
      }
      activeConn = null;
      liveStats = { ...liveStats, isConnected: false, isConnecting: false, error: msg };
      broadcast('status', liveStats);
    }
    return res.status(400).json({
      success: false,
      error: `Không kết nối được @${cleanUser}: ${msg}`,
    });
  }
});

app.post('/api/tiktok/disconnect', (_req, res) => {
  try {
    activeConn?.disconnect();
  } catch {
    // bỏ qua
  }
  activeConn = null;
  liveStats = { ...emptyStats(), stages: stageIds.length };
  broadcast('status', liveStats);
  res.json({ success: true });
});

// ---------- Lệnh từ trang điều khiển (chỉ trang stage làm theo) ----------
const CONTROL_ACTIONS = ['speak', 'setRate', 'reset', 'setName', 'setVoice', 'setTheme', 'setPrefs', 'custom'];
app.post('/api/control', (req, res) => {
  const { action, text } = req.body || {};
  if (!CONTROL_ACTIONS.includes(action)) return res.status(400).json({ success: false, error: 'Lệnh không hợp lệ' });
  if (action === 'speak' && (typeof text !== 'string' || !text.trim())) {
    return res.status(400).json({ success: false, error: 'Chưa nhập nội dung cần đọc' });
  }
  const payload = { action, text: typeof text === 'string' ? text.trim().slice(0, 1000) : undefined };
  if (action === 'setRate' && payload.text) lastRateControl = { action, text: payload.text };
  if (action === 'setName') {
    // Chỉ chữ thường, tối đa 40 ký tự
    const name = (payload.text || '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 40);
    if (!name) return res.status(400).json({ success: false, error: 'Chưa nhập tên kênh' });
    payload.text = name;
    lastNameControl = { action, text: name };
    saveSettings({ channelName: name });
  }
  if (action === 'setVoice') {
    // 'M' giọng nam NamMinh, 'F' giọng nữ HoaiMy
    if (payload.text !== 'M' && payload.text !== 'F') return res.status(400).json({ success: false, error: 'Giọng không hợp lệ' });
    lastVoiceControl = { action, text: payload.text };
    saveSettings({ voice: payload.text });
  }
  if (action === 'setTheme') {
    // mã giao diện do game tự định nghĩa: chữ thường, số, gạch nối
    if (!payload.text || !/^[a-z0-9-]{1,40}$/.test(payload.text)) return res.status(400).json({ success: false, error: 'Giao diện không hợp lệ' });
    lastThemeControl = { action, text: payload.text };
    saveSettings({ theme: payload.text });
  }
  if (action === 'setPrefs') {
    // gửi cả bộ cài đặt (JSON), server gộp với bộ cũ rồi phát lại bộ đầy đủ
    let incoming: unknown = null;
    try {
      incoming = JSON.parse(payload.text || '');
    } catch {
      // sai JSON
    }
    const p = cleanPrefs(incoming);
    if (!p) return res.status(400).json({ success: false, error: 'Cài đặt không hợp lệ' });
    const merged = { ...(cleanPrefs(settings.prefs) ?? {}), ...p };
    payload.text = JSON.stringify(merged);
    lastPrefsControl = { action, text: payload.text };
    saveSettings({ prefs: merged });
  }
  broadcast('control', payload);
  res.json({ success: true, pages: sseClients.length });
});

// ---------- Giả lập sự kiện (test không cần live) ----------
const TEST_EVENTS = ['chat', 'gift', 'member', 'follow', 'share', 'like'];
app.post('/api/test/emit', (req, res) => {
  const { type, data } = req.body || {};
  if (!TEST_EVENTS.includes(type)) return res.status(400).json({ success: false, error: 'Loại sự kiện không hợp lệ' });
  const event = { timestamp: Date.now(), avatar: '', ...(data || {}) };
  if (type === 'like') {
    liveStats.totalLikes += Number(event.likeCount) || 1;
    event.totalLikes = liveStats.totalLikes;
  }
  broadcast(type, event);
  res.json({ success: true });
});

// ---------- Giọng đọc ----------
const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function splitText(text: string, max = 190): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const win = rest.slice(0, max + 1);
    let cut = Math.max(win.lastIndexOf('. '), win.lastIndexOf('! '), win.lastIndexOf('? '));
    if (cut < max / 2) cut = Math.max(win.lastIndexOf(', '), win.lastIndexOf('; '));
    if (cut < max / 2) cut = win.lastIndexOf(' ');
    if (cut <= 0) cut = max - 1;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function edgeTts(text: string, rate: number, voiceName: string, hype: boolean): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(escapeXml(text), {
      rate: `${rate >= 1 ? '+' : ''}${Math.round((rate - 1) * 100)}%`,
      pitch: TTS_PITCH,
      volume: hype ? '+40%' : '+0%', // "^" hô to: chỉ to hơn, không đổi cao độ
    });
    const chunks: Buffer[] = [];
    const read = (async () => {
      for await (const c of audioStream) chunks.push(c as Buffer);
    })();
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Edge TTS timeout')), 20000));
    await Promise.race([read, timeout]);
    if (chunks.length === 0) throw new Error('Edge TTS không trả âm thanh');
    return Buffer.concat(chunks);
  } finally {
    tts.close();
  }
}

async function googleTts(text: string): Promise<Buffer> {
  const parts: Buffer[] = [];
  for (const chunk of splitText(text)) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(chunk)}`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://translate.google.com/',
      },
    });
    if (!r.ok) throw new Error(`Google TTS lỗi ${r.status}`);
    parts.push(Buffer.from(await r.arrayBuffer()));
  }
  return Buffer.concat(parts);
}

// ---------- Giọng VieNeu (MC "Adam bựa"), chạy riêng ở E:\02_AI\VieNeu-TTS cổng 8000 ----------
// Game gọi /api/tts?eng=vn&voice=...&temp=...&text=...; VieNeu chưa bật hoặc lỗi thì tự đọc bằng Edge như cũ.
const VIENEU_URL = process.env.VIENEU_URL || 'http://127.0.0.1:8000';
async function vieneuTts(text: string, voice: string, temperature: number): Promise<Buffer> {
  const r = await fetch(`${VIENEU_URL}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'vieneu', input: text, voice, response_format: 'wav', temperature }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`VieNeu ${r.status}`);
  const wav = Buffer.from(await r.arrayBuffer());
  // VieNeu gửi WAV kiểu "chưa biết độ dài"; ghi lại độ dài thật để trình duyệt đọc chuẩn
  const di = wav.indexOf('data', 12);
  if (wav.toString('ascii', 0, 4) === 'RIFF' && di > 0) {
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.writeUInt32LE(wav.length - di - 8, di + 4);
  }
  return wav;
}

const ttsCache = new Map<string, Buffer>();
app.get('/api/tts', async (req, res) => {
  try {
    const text = String(req.query.text || '').trim().slice(0, 1500);
    if (!text) return res.status(400).send('Thiếu text');
    if (req.query.eng === 'vn') {
      // tên giọng chỉ gồm chữ/số/khoảng trắng (VieNeu tự từ chối tên không có)
      const voice = String(req.query.voice || 'Adam bựa').replace(/[^\p{L}\p{N} ]/gu, '').slice(0, 40) || 'Adam bựa';
      const temp = Math.min(1.5, Math.max(0.3, Number(req.query.temp) || 0.95));
      try {
        const wav = await vieneuTts(text.slice(0, 400), voice, temp);
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Cache-Control', 'no-store');
        return res.send(wav);
      } catch (err) {
        console.warn('VieNeu lỗi, đọc bằng Edge:', err instanceof Error ? err.message : err);
      }
    }
    const rate = Math.min(1.5, Math.max(0.5, Number(req.query.rate) || 1));
    const hype = req.query.hype === '1';
    // chỉ nhận 2 giọng này, không cho truyền tên giọng tuỳ ý
    const voiceName = req.query.v === 'f' ? TTS_VOICE_F : TTS_VOICE;
    const key = `${voiceName}|${rate}|${hype}|${text}`;
    let audio = ttsCache.get(key);
    if (!audio) {
      try {
        audio = await edgeTts(text, rate, voiceName, hype);
      } catch (err) {
        console.warn('Edge TTS lỗi, chuyển Google:', err instanceof Error ? err.message : err);
        audio = await googleTts(text);
      }
      ttsCache.set(key, audio);
      if (ttsCache.size > 200) ttsCache.delete(ttsCache.keys().next().value!);
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(audio);
  } catch (err) {
    console.error('TTS lỗi:', err);
    res.status(500).json({ error: 'TTS failed' });
  }
});

// ---------- API riêng của game: thêm bên dưới ----------

// ---------- Khởi động ----------
const PORT_TRIES = 20; // cổng bận (game khác đang chạy) thì thử cổng kế tiếp, tối đa 20 lần

// Có chương trình nào đang nghe cổng này trên máy không. Cần hỏi kiểu này vì trên Windows, chương trình khác
// nghe 0.0.0.0 thì ta vẫn mở được 127.0.0.1 cùng cổng, rồi cướp mất kết nối của nó (vd Vite của Đi Chùa).
function inUse(port: number) {
  return new Promise<boolean>((resolve) => {
    const sock = net.connect(port, '127.0.0.1');
    sock.setTimeout(500);
    sock.once('connect', () => (sock.destroy(), resolve(true)));
    sock.once('timeout', () => (sock.destroy(), resolve(false)));
    sock.once('error', () => resolve(false));
  });
}

// Mở cổng THẬT rồi giữ luôn (2 server bật cùng lúc mở trùng cổng thì 1 bên báo bận, thử cổng kế).
// Chỉ nghe 127.0.0.1: API không có đăng nhập, người cùng Wi-Fi không điều khiển được.
async function listenFree(server: http.Server, port: number, what: string): Promise<number> {
  for (let p = port; p < port + PORT_TRIES; p++) {
    const ok =
      !(await inUse(p)) &&
      (await new Promise<boolean>((resolve, reject) => {
        const onError = (err: NodeJS.ErrnoException) => (err.code === 'EADDRINUSE' ? resolve(false) : reject(err));
        server.once('error', onError);
        server.listen(p, '127.0.0.1', () => {
          server.off('error', onError);
          resolve(true);
        });
      }));
    if (ok) return p;
    console.log(`${what}: cổng ${p} đang bận, thử ${p + 1}...`);
  }
  throw new Error(`${what}: cổng ${port} tới ${port + PORT_TRIES - 1} đều bận`);
}

async function start() {
  // giữ cổng chính TRƯỚC, rồi mới chọn cổng tự tải lại: 2 game bật cùng lúc không giành nhau
  const port = await listenFree(http.createServer(app), PORT, 'Server');
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const live = process.env.LIVE_MODE === '1';
    // Lúc sửa code: kênh tự tải lại dùng cổng riêng từ 24680 (Đi Chùa giữ 24678), bận thì lùi sang cổng kế.
    // Live (LIVE_MODE=1, BAT-LIVE.bat): tắt hẳn tự tải lại, sửa code không làm trang stage reset giữa live.
    const hmrServer = http.createServer();
    const hmrPort = live ? 0 : await listenFree(hmrServer, 24680, 'Tự tải lại (HMR)');
    const vite = await createServer({
      server: live
        ? { middlewareMode: true, hmr: false, ws: false }
        : { middlewareMode: true, ws: { server: hmrServer, clientPort: hmrPort } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    if (!live) console.log(`Cổng tự tải lại (HMR): ${hmrPort}`);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
  }

  const dashboard = `http://localhost:${port}`;
  console.log('');
  console.log(`  Trang điều khiển : ${dashboard}`);
  console.log(`  Link LIVE Studio : http://lvh.me:${port}/?view=stage   (1080 x 1920)`);
  if (port !== PORT) console.log(`  Chú ý: cổng ${PORT} đang bận nên dùng cổng ${port}. Link trong LIVE Studio phải đúng cổng này.`);
  console.log('');
  // BAT-LIVE.bat đặt OPEN_DASHBOARD=1: tự mở đúng trang điều khiển của cổng vừa chọn
  if (process.env.OPEN_DASHBOARD === '1' && process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', dashboard], { detached: true, stdio: 'ignore' }).unref();
  }
}

start().catch((err) => {
  console.error('Không bật được server:', err);
  process.exit(1);
});
