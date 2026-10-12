/** Anonymous event batching (docs/tools/telemetry.md). No DOM here: the transport and clock are injected so it is unit-tested in Node. */
export interface TelemetryContext { d: 'desktop' | 'phone' | 'tablet'; q: 'high' | 'low'; b: 'webgl' | 'webgpu'; v: string; vp: string }
export type EventFields = { l?: string; k?: number; x?: number; z?: number; d?: Record<string, string | number | boolean> };
export interface WireEvent extends EventFields { t: string; ts: number }
/** ok = stored; retry = keep and try later; drop = the server refused this batch for good; stop = endpoint missing, switch telemetry off. */
export type SendResult = 'ok' | 'retry' | 'drop' | 'stop';
export interface Transport { send(url: string, body: string, final: boolean): Promise<SendResult> }

export const batchLimits = { perRequest: 100, perSession: 5500, queue: 400, intervalMs: 30_000, maxBackoffMs: 5 * 60_000 } as const;

export class EventClient {
  private queue: WireEvent[] = [];
  private accepted = 0;
  private fails = 0;
  private retryAt = 0;
  private visible = true;
  private visibleSince: number;
  private activeMs = 0;
  readonly startedAt: number;
  stopped = false;
  constructor(private readonly options: { playerId: string; sessionId: string; context: () => TelemetryContext; transport: Transport; now?: () => number }) {
    this.startedAt = this.visibleSince = this.now();
  }
  private now(): number { return this.options.now?.() ?? Date.now(); }
  get queued(): number { return this.queue.length; }
  /** Seconds the page was visible (play time proxy), and wall seconds since session start. */
  get activeSeconds(): number { return Math.round((this.activeMs + (this.visible ? this.now() - this.visibleSince : 0)) / 1000); }
  get durationSeconds(): number { return Math.round((this.now() - this.startedAt) / 1000); }
  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    const now = this.now();
    if (this.visible) this.activeMs += now - this.visibleSince; else this.visibleSince = now;
    this.visible = visible;
  }
  push(type: string, fields: EventFields = {}): void {
    if (this.stopped || this.accepted >= batchLimits.perSession) return;
    if (this.queue.length >= batchLimits.queue) this.queue.shift();
    this.queue.push({ t: type, ts: this.now(), ...fields }); this.accepted++;
  }
  /** Send what is queued. `final` (page hide) ignores the back-off and uses the beacon path. */
  async flush(final = false): Promise<boolean> {
    if (this.stopped) return false;
    if (!final && this.now() < this.retryAt) return false;
    if (!this.queue.length && !final) return true;
    do {
      const batch = this.queue.splice(0, batchLimits.perRequest);
      const body = JSON.stringify({ v: 1, p: this.options.playerId, s: this.options.sessionId, c: this.options.context(), dur: this.durationSeconds, act: this.activeSeconds, e: batch });
      let result: SendResult;
      try { result = await this.options.transport.send('/api/t', body, final); } catch { result = 'retry'; }
      if (result === 'stop') { this.stopped = true; this.queue.length = 0; return false; }
      if (result === 'retry') {
        this.queue.unshift(...batch); if (this.queue.length > batchLimits.queue) this.queue.length = batchLimits.queue;
        this.fails++; this.retryAt = this.now() + Math.min(batchLimits.maxBackoffMs, batchLimits.intervalMs * 2 ** this.fails);
        return false;
      }
      this.fails = 0; this.retryAt = 0;
    } while (this.queue.length && !final);
    return true;
  }
}

export function classifyDevice(input: { userAgent: string; touchPoints: number; coarse: boolean; shortSide: number }): TelemetryContext['d'] {
  if (/iPad|Tablet/i.test(input.userAgent) || (/Macintosh/.test(input.userAgent) && input.touchPoints > 1)) return 'tablet';
  if (/Mobi|iPhone|iPod/i.test(input.userAgent)) return 'phone';
  if (/Android/i.test(input.userAgent)) return input.shortSide >= 600 ? 'tablet' : 'phone';
  return input.touchPoints > 0 && input.coarse && input.shortSide < 600 ? 'phone' : 'desktop';
}
/** Coarse viewport bucket (rounded to 160 px) so layouts can be compared without fingerprinting exact sizes. */
export const viewportBucket = (w: number, h: number): string => `${Math.max(160, Math.round(w / 160) * 160)}x${Math.max(160, Math.round(h / 160) * 160)}`;
export const uuid = (random: () => number = Math.random): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => { const r = Math.floor(random() * 16); return (ch === 'x' ? r : r & 3 | 8).toString(16); });
};
