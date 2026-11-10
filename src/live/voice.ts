import { IS_STAGE } from './page';

/**
 * Hàng đợi giọng đọc. Chỉ phát trên trang stage (và chỉ trang stage mở sau cùng).
 *   voice.say('Chào bạn A')              -> hàng phụ: chờ quá 30 giây thì bỏ (chuyện đã cũ)
 *   voice.say('Cảm ơn quà', true)        -> hàng ưu tiên, chen lên đầu (quà); chờ tối đa 60 giây
 *   voice.say('Trời ơi! | ^Hoan hô!')    -> "|" tách đoạn; "^" ở đầu đoạn = hô to hơn (chỉ to hơn, không đổi giọng)
 *   voice.say('M: Anh nói | F: Em nói')  -> 2 MC: "M:" nam NamMinh, "F:" nữ HoaiMy (giữ tới khi đổi).
 *                                           Không ghi gì = giọng nam, mặc định game chỉ 1 MC.
 */
interface Line {
  text: string;
  at: number;
}

type Who = 'M' | 'F';
interface Part {
  who: Who;
  hype: boolean;
  text: string;
}

const MAX_WAIT_PRIORITY_MS = 60_000;
const MAX_WAIT_NORMAL_MS = 30_000;
const MAX_QUEUE = 30;
const START_TIMEOUT_MS = 8000; // tải 8 giây chưa phát được thì bỏ câu
const OVERRUN_MS = 4000; // đang phát quá độ dài câu + 4 giây thì cắt

class Voice {
  private normal: Line[] = [];
  private priority: Line[] = [];
  private playing = false;
  private current: HTMLAudioElement | null = null;
  private lastSpokeAt = Date.now();
  private fetched = new Set<string>();
  rate = 1;
  volume = 1;
  /** Giọng khi câu không ghi M:/F: ('M' nam NamMinh, 'F' nữ HoaiMy). Mặc định theo GAME.voice; chọn ở trang điều khiển (server nhớ trong settings.json) */
  defaultWho: VoiceWho = 'M';
  enabled = IS_STAGE;

  /** Server báo trang stage này có phải trang được phát tiếng không (trang mở sau cùng) */
  setSpeaker(mine: boolean) {
    if (!mine && this.enabled) this.stop();
    this.enabled = IS_STAGE && mine;
  }

  say(text: string, priority = false) {
    if (!this.enabled || !text.trim()) return;
    const q = priority ? this.priority : this.normal;
    q.push({ text: text.trim(), at: Date.now() });
    if (q.length > MAX_QUEUE) q.shift();
    if (priority) this.prefetch(text); // quà: tạo giọng sẵn, tới lượt là phát liền
    void this.next();
  }

  stop() {
    this.normal = [];
    this.priority = [];
    this.current?.pause();
    this.current = null;
    this.playing = false;
  }

  get busy() {
    return this.playing || this.normal.length + this.priority.length > 0;
  }

  /** Số câu thường đang chờ (không tính câu đang đọc) */
  get waiting() {
    return this.normal.length;
  }

  /** Số câu ưu tiên (quà) đang chờ */
  get waitingPriority() {
    return this.priority.length;
  }

  /** Giọng đã im bao lâu (0 khi đang đọc hoặc còn câu chờ) */
  quietForMs(now = Date.now()) {
    return this.busy ? 0 : now - this.lastSpokeAt;
  }

  /** Nhờ server tạo giọng trước (server giữ trong bộ nhớ), tới lượt đọc thì phát ngay */
  prefetch(text: string) {
    for (const p of this.parts(text)) {
      const url = this.urlOf(p);
      if (this.fetched.has(url)) continue;
      if (this.fetched.size > 300) this.fetched.clear();
      this.fetched.add(url);
      fetch(url)
        .then((r) => r.arrayBuffer())
        .catch(() => this.fetched.delete(url));
    }
  }

  private parts(text: string): Part[] {
    let who: Who = this.defaultWho;
    const out: Part[] = [];
    for (let raw of text.split('|')) {
      raw = raw.trim();
      const sp = /^(M|F):\s*/.exec(raw);
      if (sp) {
        who = sp[1] as Who;
        raw = raw.slice(sp[0].length);
      }
      const t = raw.replace(/^\^+\s*/, '');
      if (t) out.push({ who, hype: raw.startsWith('^'), text: t });
    }
    return out;
  }

  private urlOf(p: Part) {
    return `/api/tts?rate=${this.rate}${p.hype ? '&hype=1' : ''}${p.who === 'F' ? '&v=f' : ''}&text=${encodeURIComponent(p.text)}`;
  }

  private takeNext(): Line | undefined {
    const now = Date.now();
    let line: Line | undefined;
    while ((line = this.priority.shift())) if (now - line.at < MAX_WAIT_PRIORITY_MS) return line;
    while ((line = this.normal.shift())) if (now - line.at < MAX_WAIT_NORMAL_MS) return line;
    return undefined;
  }

  private async next() {
    if (this.playing) return;
    const line = this.takeNext();
    if (!line) return;
    this.playing = true;
    // trong lúc đọc câu này thì tạo sẵn giọng câu kế tiếp, đọc xong là nối liền
    const upcoming = this.priority[0] ?? this.normal[0];
    if (upcoming) this.prefetch(upcoming.text);
    try {
      for (const part of this.parts(line.text)) {
        const audio = new Audio(this.urlOf(part));
        audio.volume = this.volume;
        this.current = audio;
        await playSafe(audio);
        if (this.current !== audio) break; // stop() giữa chừng
      }
    } finally {
      this.current = null;
      this.playing = false;
      this.lastSpokeAt = Date.now();
      void this.next();
    }
  }
}

/**
 * Phát 1 đoạn và luôn kết thúc: 1 câu treo (không tải xong, không báo lỗi) sẽ làm MC im cả buổi live.
 * Bỏ câu là huỷ HẲN (dừng tải), để câu bỏ không tự phát đè lên câu sau thành 2 giọng.
 */
function playSafe(audio: HTMLAudioElement) {
  return new Promise<void>((resolve) => {
    let over = false;
    let guard = setTimeout(finish, START_TIMEOUT_MS);
    function finish() {
      if (over) return;
      over = true;
      clearTimeout(guard);
      audio.pause();
      if (!audio.ended) {
        audio.removeAttribute('src');
        audio.load(); // dừng tải
      }
      resolve();
    }
    audio.onplaying = () => {
      if (over) return audio.pause(); // câu đã bỏ mà vẫn kịp phát: tắt ngay
      clearTimeout(guard);
      const ms = Number.isFinite(audio.duration) ? audio.duration * 1000 + OVERRUN_MS : 40_000;
      guard = setTimeout(finish, ms);
    };
    audio.onended = finish;
    audio.onerror = finish;
    // trình duyệt chặn tự phát tiếng (chưa ai bấm vào trang): thử lại vài lần thay vì bỏ câu ngay
    const tryPlay = (left: number) => {
      if (over) return;
      audio.play().catch(() => (left > 0 ? setTimeout(() => tryPlay(left - 1), 1500) : finish()));
    };
    tryPlay(4);
  });
}

export const voice = new Voice();
export type VoiceWho = Who;

export { speakableName } from './names';
