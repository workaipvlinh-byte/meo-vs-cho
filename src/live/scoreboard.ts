// Bảng điểm người xem. Hàm thuần (không React) để dễ test và dùng lại.

export interface Player {
  username: string;
  nickname: string;
  avatar: string;
  score: number;
  diamonds: number;
  lastActive: number;
}

export type Players = Record<string, Player>;

export function addScore(
  players: Players,
  p: { username: string; nickname: string; avatar?: string },
  points: number,
  diamonds = 0,
): Players {
  const old = players[p.username];
  return {
    ...players,
    [p.username]: {
      username: p.username,
      nickname: p.nickname || old?.nickname || p.username,
      avatar: p.avatar || old?.avatar || '',
      score: (old?.score ?? 0) + points,
      diamonds: (old?.diamonds ?? 0) + diamonds,
      lastActive: Date.now(),
    },
  };
}

export function topPlayers(players: Players, n = 10): Player[] {
  return Object.values(players)
    .sort((a, b) => b.score - a.score || b.diamonds - a.diamonds)
    .slice(0, n);
}

/**
 * Gom tên người mới vào để chào theo lượt, không đọc từng người (live đông là nghẽn giọng).
 *   const g = new NameBatcher(6000, 3, (names) => voice.say(`Chào ${names.join(', ')}`), () => voice.waiting >= 2);
 *   g.add('an123', 'An');
 * - Mỗi người chỉ được chào 1 lần trong buổi (ra vào lại không chào nữa). reset() để chào lại từ đầu.
 * - `isBusy`: giọng còn nhiều câu chờ thì để lượt sau, tên vẫn giữ.
 * - Đông (chờ nhiều hơn 1 lượt): đọc `perBatch` tên mới nhất + "và N bạn nữa" (flush nhận N ở tham số 2), rồi xoá hàng chờ.
 */
export class NameBatcher {
  private names: { key: string; name: string }[] = [];
  private dropped = 0; // người bị đẩy khỏi hàng chờ khi đông, vẫn đếm vào "và N bạn nữa"
  private seen = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  constructor(
    private everyMs: number,
    private perBatch: number,
    private flush: (names: string[], more: number) => void,
    private isBusy: () => boolean = () => false,
    private maxWaiting = 30,
  ) {}
  /** key = username (không đổi), name = tên để đọc */
  add(key: string, name = key) {
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.names.push({ key, name });
    if (this.names.length > this.maxWaiting) {
      this.names.shift();
      this.dropped++;
    }
    if (!this.timer) this.timer = setInterval(() => this.tick(), this.everyMs);
  }
  reset() {
    this.names = [];
    this.dropped = 0;
    this.seen.clear();
  }
  private tick() {
    if (this.names.length && this.isBusy()) return;
    // đông: gộp hết vào 1 câu, đọc mấy tên mới nhất (người vừa vào còn đang xem)
    const crowded = this.names.length > this.perBatch * 2;
    const batch = crowded ? this.names.slice(-this.perBatch) : this.names.splice(0, this.perBatch);
    const more = crowded ? this.names.length - this.perBatch + this.dropped : 0;
    if (crowded) this.names = [];
    this.dropped = 0;
    if (batch.length) this.flush(batch.map((b) => b.name), more);
    if (!this.names.length && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

/** Mỗi người chỉ được làm 1 việc mỗi X giây (chống spam) */
export function makeCooldown(ms: number) {
  const last = new Map<string, number>();
  return (key: string, now = Date.now()) => {
    if (now - (last.get(key) ?? 0) < ms) return false;
    last.set(key, now);
    return true;
  };
}
