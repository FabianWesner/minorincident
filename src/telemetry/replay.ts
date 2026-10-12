import { InputLogEncoder, type CommandKind, type LogChunkInfo } from './codec';
import type { SendResult } from './client';
import type { InputFrame, Scheme } from '../input/InputFrame';

export interface ChunkTransport { post(url: string, body: Uint8Array, final: boolean): Promise<SendResult> }
export type ReplayOutcome = 'complete' | 'restart' | 'home' | 'close' | 'next' | 'open';
export interface ReplayContext { playerId: string; sessionId: string; build: string }
export const replayLimits = { queueBytes: 3 * 1024 * 1024, retries: 3 } as const;

/**
 * Records the input log of one level attempt and uploads it in gzip chunks (periodic cuts plus a final marker).
 * Nothing here allocates per tick besides the encoder's reused buffers; chunks are produced a few times a minute.
 */
export class ReplayRecorder {
  private readonly encoder: InputLogEncoder;
  private attempt: { id: string; level: string; seq: number; ticks: number } | null = null;
  private closing: { outcome: ReplayOutcome; ticks: number } | null = null;
  private queue: Promise<void> = Promise.resolve();
  private queuedBytes = 0;
  dropped = 0;
  /** Chunks produced for the current attempt (raw, before gzip): tests and the replay tool read them in record-only mode. */
  readonly kept: { bytes: Uint8Array; info: LogChunkInfo }[] = [];
  stopped = false;
  constructor(private readonly context: ReplayContext, private readonly transport: ChunkTransport, private readonly compress: (bytes: Uint8Array) => Promise<Uint8Array>, private readonly options: { keep?: boolean; chunkBytes?: number; id?: () => string } = {}) {
    this.encoder = new InputLogEncoder((bytes, info) => this.chunk(bytes, info), options.chunkBytes);
  }
  get active(): boolean { return this.attempt !== null; }
  get attemptId(): string | null { return this.attempt?.id ?? null; }
  get samples(): number { return this.encoder.samples; }
  begin(level: string, meta: object, id: string): void {
    if (this.attempt) this.end('open', 0);
    this.kept.length = 0; this.attempt = { id, level, seq: 0, ticks: 0 }; this.closing = null;
    this.encoder.begin({ ...meta, attempt: id, level, build: this.context.build, v: 1 });
  }
  sample(frame: InputFrame, scheme: Scheme): void { this.encoder.add(frame, scheme); }
  command(kind: CommandKind, value: number): void { this.encoder.command(kind, value); }
  /** Periodic cut: lose at most one interval of play if the tab dies. */
  cut(ticks: number): void { if (this.attempt) { this.attempt.ticks = ticks; this.encoder.cut(); } }
  end(outcome: ReplayOutcome, ticks: number): void {
    if (!this.attempt) return;
    this.closing = { outcome, ticks }; this.encoder.end(); this.attempt = null; this.closing = null;
  }
  private chunk(bytes: Uint8Array, info: LogChunkInfo): void {
    const attempt = this.attempt!, seq = attempt.seq++, closing = this.closing;
    if (this.options.keep) this.kept.push({ bytes, info });
    if (this.stopped) return;
    const params = new URLSearchParams({ a: attempt.id, p: this.context.playerId, s: this.context.sessionId, n: String(seq), l: attempt.level, b: this.context.build, t: String(closing?.ticks ?? attempt.ticks), m: String(info.endSample) });
    if (closing) { params.set('f', '1'); params.set('o', closing.outcome); }
    const url = `/api/replay?${params}`, final = closing !== null;
    if (this.queuedBytes + bytes.length > replayLimits.queueBytes) { this.dropped++; return; }
    this.queuedBytes += bytes.length;
    this.queue = this.queue.then(async () => {
      try {
        if (this.stopped) return;
        const body = await this.compress(bytes);
        for (let attempts = 0; attempts <= replayLimits.retries; attempts++) {
          let result: SendResult;
          try { result = await this.transport.post(url, body, final); } catch { result = 'retry'; }
          if (result === 'stop') { this.stopped = true; return; }
          if (result !== 'retry') return;
          await new Promise(resolve => setTimeout(resolve, 1000 * 4 ** attempts));
        }
        this.dropped++;
      } finally { this.queuedBytes -= bytes.length; }
    });
  }
  /** Resolves when every chunk produced so far has been sent (tests). */
  idle(): Promise<void> { return this.queue; }
}
