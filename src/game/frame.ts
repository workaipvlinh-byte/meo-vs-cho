// Cầu nối tới game trong khung nhúng (public/game.html, cùng địa chỉ nên gọi thẳng được).
export interface GameStats {
  units: number;
  hp: number[];
  kills: number[];
  cmt: number[]; // số comment đã đếm cho từng phe trong trận này
  players: number;
  heart: number[];
  round: number;
  phase: 'fight' | 'result';
  time: number;
  fps: number;
}

export interface GameApi {
  event(ev: Record<string, unknown>): { side?: number | null; joined?: boolean };
  sayText(text: string, prio?: number): void;
  stopVoice(): void;
  setSpeaker(on: boolean): void;
  setMc(prefs: Record<string, string>): void;
  setLength(sec: number): void;
  jump(j: number): void;
  newMatch(): void;
  phase(): 'fight' | 'result';
  stats(): GameStats;
}

export const frame: { el: HTMLIFrameElement | null } = { el: null };

/** Game chưa tải xong thì trả về null. */
export const gameApi = (): GameApi | null =>
  ((frame.el?.contentWindow as unknown as { GAME_API?: GameApi } | null)?.GAME_API) ?? null;
