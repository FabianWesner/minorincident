import type { InputFrame, Scheme, Vec2 } from '../input/InputFrame';

/**
 * Input-log codec (telemetry replays). One record per *changed* fixed-tick input sample, so an idle player costs
 * nothing. A fixed table of numeric slots mirrors every field the sim reads from an InputFrame; unchanged slots are
 * skipped through a bit mask. Encoding is exact (float64) because replay determinism is the point.
 *
 * Chunk layout (gzip is applied outside, see gzip.ts):
 *   'MIR1' u8 flags(bit0 = meta) u32 startSample u32 endSample [u32 metaLen, utf8 JSON] records...
 * Record: varint (gap << 1 | isCommand), gap = samples since the previous record (0 = same sample).
 *   frame record  : u32 mask, then per set bit a float64 (slots 0..9) or an absent-aware zigzag varint (slots 10..)
 *   command record: varint kind, then float64 (zoom) or varint (tier, phase)
 * Every chunk starts with a keyframe (all slots written), so chunks decode independently of earlier ones.
 * Steady-state encoding allocates nothing: the frame is read into a Float64Array and diffed against the previous one.
 */
export const CHUNK_MAGIC = 0x3152494d; // 'MIR1' little-endian
export const MAX_CHUNK_BYTES = 256 * 1024;
export const schemes: readonly Scheme[] = ['mouse-only', 'mouse-keyboard', 'keyboard', 'touch'];
const sources = [null, 'pointer', 'keyboard', 'touch', 'assist'] as const;
/** Optional boolean fields, two bits each in slot 20: 0 = absent, 1 = false, 2 = true. */
const optionalFlags = ['brake', 'handbrake', 'mouseAttack', 'attackInPlace', 'selectorActive', 'cancelMove', 'pointerGround', 'pointerTarget', 'navigation', 'walk', 'activeAttack', 'orderedSelection'] as const;
const FLOAT_SLOTS = 10, SLOTS = 22, ALL = 0x3fffff, HEADER = 13;
/** zoom = wheel delta (float), tier = quality tier index, phase = mission UI command index, view = width * 65536 + height. */
export type CommandKind = 'zoom' | 'tier' | 'phase' | 'view';
const commandIds: Record<CommandKind, number> = { zoom: 1, tier: 2, phase: 3, view: 4 };
const commandKinds = ['', 'zoom', 'tier', 'phase', 'view'] as const;
/** Mission UI commands that happen between ticks: begin (briefing), restore (retry), continue (result screen). */
export const phaseCommands = ['begin', 'restore', 'continue'] as const;
export const tierNames = ['high', 'low'] as const;

export interface LogCommand { at: number; kind: CommandKind; value: number }
export interface LogChunkInfo { startSample: number; endSample: number; bytes: number }
export interface DecodedLog { meta: Record<string, unknown> | null; samples: number; frames: InputFrame[]; schemes: Uint8Array; commands: LogCommand[] }

const absent = Number.NaN;
const same = (a: number, b: number): boolean => a === b || (a !== a && b !== b);

export class InputLogEncoder {
  private readonly buffer: Uint8Array; private readonly view: DataView; private pos = 0;
  private readonly cur = new Float64Array(SLOTS); private readonly prev = new Float64Array(SLOTS);
  private fresh = true; private sample = 0; private startSample = 0; private lastRecord = 0;
  private pendingMeta: Uint8Array | null = null; private chunkHasMeta = false; private headerEnd = 0;
  /** `chunkBytes` is the raw size at which a chunk is cut; gzip then keeps it far below the 256 KB upload cap. */
  constructor(private readonly onChunk: (bytes: Uint8Array, info: LogChunkInfo) => void, private readonly chunkBytes = 160 * 1024) {
    this.buffer = new Uint8Array(chunkBytes + 1024); this.view = new DataView(this.buffer.buffer);
  }
  get samples(): number { return this.sample; }
  get active(): boolean { return this.pos > 0; }
  begin(meta: object): void {
    const bytes = new TextEncoder().encode(JSON.stringify(meta));
    if (bytes.length + 64 > 1024 + this.chunkBytes / 2) throw new RangeError('Replay metadata too large');
    this.sample = 0; this.pendingMeta = bytes; this.startChunk();
  }
  private startChunk(): void {
    this.view.setUint32(0, CHUNK_MAGIC, true);
    this.chunkHasMeta = this.pendingMeta !== null; this.buffer[4] = this.chunkHasMeta ? 1 : 0;
    this.view.setUint32(5, this.sample, true); this.view.setUint32(9, 0, true); this.pos = HEADER;
    if (this.pendingMeta) { this.view.setUint32(this.pos, this.pendingMeta.length, true); this.pos += 4; this.buffer.set(this.pendingMeta, this.pos); this.pos += this.pendingMeta.length; this.pendingMeta = null; }
    this.headerEnd = this.pos; this.startSample = this.lastRecord = this.sample; this.fresh = true;
  }
  private varint(value: number): void { while (value >= 0x80) { this.buffer[this.pos++] = value % 0x80 | 0x80; value = Math.floor(value / 0x80); } this.buffer[this.pos++] = value; }
  private optional(value: number): void { this.varint(value !== value ? 0 : 1 + (value >= 0 ? value * 2 : -value * 2 - 1)); }
  private emit(): void {
    this.view.setUint32(9, this.sample, true);
    const bytes = this.buffer.slice(0, this.pos);
    this.onChunk(bytes, { startSample: this.startSample, endSample: this.sample, bytes: bytes.length });
  }
  command(kind: CommandKind, value: number): void {
    if (this.pos === 0) return;
    this.varint(((this.sample - this.lastRecord) << 1) | 1); this.lastRecord = this.sample;
    this.varint(commandIds[kind]);
    if (kind === 'zoom') { this.view.setFloat64(this.pos, value, true); this.pos += 8; } else this.varint(value);
  }
  /** Capture the frame the sim is about to consume for the next tick. */
  add(frame: InputFrame, scheme: Scheme): void {
    if (this.pos === 0) return;
    const c = this.cur, aim = frame.aim, point = frame.aimPoint, target = frame.moveTarget, drive = frame.drive, attack = frame.attackTarget, slot = frame.selectedSlot;
    c[0] = frame.move.x; c[1] = frame.move.z;
    c[2] = aim === null ? Infinity : aim.x; c[3] = aim === null ? 0 : aim.z;
    c[4] = point === undefined ? absent : point === null ? Infinity : point.x; c[5] = point ? point.z : 0;
    c[6] = target ? target.x : absent; c[7] = target ? target.z : 0;
    c[8] = drive ? drive.throttle : absent; c[9] = drive ? drive.steer : 0;
    c[10] = attack ? attack.id : absent; c[11] = attack && attack.side === 'RIGHT' ? 1 : 0;
    c[12] = sources.indexOf(frame.aimSource);
    c[13] = frame.selector;
    c[14] = frame.selectedActiveSlot ?? absent;
    c[15] = slot ? slot.index : absent; c[16] = slot && slot.side === 'RIGHT' ? 1 : 0;
    c[17] = frame.selectorSide === undefined ? absent : frame.selectorSide === 'LEFT' ? 0 : 1;
    c[18] = schemes.indexOf(scheme);
    c[19] = (frame.left.down ? 1 : 0) | (frame.left.held ? 2 : 0) | (frame.left.up ? 4 : 0) | (frame.right.down ? 8 : 0) | (frame.right.held ? 16 : 0) | (frame.right.up ? 32 : 0) | (frame.interact ? 64 : 0) | (frame.pause ? 128 : 0);
    const f = frame as unknown as Record<string, boolean | undefined>; let flags = 0;
    for (let i = 0; i < optionalFlags.length; i++) { const v = f[optionalFlags[i]]; flags |= (v === undefined ? 0 : v ? 2 : 1) << (i * 2); }
    c[20] = flags; c[21] = frame.selectedWeaponKey ?? absent;
    let mask = 0;
    if (this.fresh) mask = ALL; else for (let i = 0; i < SLOTS; i++) if (!same(c[i], this.prev[i])) mask |= 1 << i;
    this.fresh = false;
    if (mask !== 0) {
      this.varint((this.sample - this.lastRecord) << 1); this.lastRecord = this.sample;
      this.view.setUint32(this.pos, mask >>> 0, true); this.pos += 4;
      for (let i = 0; i < SLOTS; i++) {
        if (!(mask & 1 << i)) continue;
        if (i < FLOAT_SLOTS) { this.view.setFloat64(this.pos, c[i], true); this.pos += 8; } else this.optional(c[i]);
        this.prev[i] = c[i];
      }
    }
    this.sample++;
    if (this.pos >= this.chunkBytes) { this.emit(); this.startChunk(); }
  }
  /** Emit what has been recorded so far as its own chunk (periodic upload); the next chunk starts with a keyframe. */
  cut(): void {
    if (this.pos === 0 || (this.sample === this.startSample && !this.chunkHasMeta)) return;
    this.emit(); this.startChunk();
  }
  /** End the attempt and emit the tail chunk (always, so the last upload can carry the final marker). */
  end(): void {
    if (this.pos === 0) return;
    this.emit(); this.pos = 0;
  }
}

class Reader {
  pos = 0; readonly view: DataView;
  constructor(readonly bytes: Uint8Array) { this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
  get done(): boolean { return this.pos >= this.bytes.length; }
  varint(): number { let result = 0, scale = 1; for (;;) { const b = this.bytes[this.pos++]; if (b === undefined) throw new RangeError('Truncated replay chunk'); result += (b & 0x7f) * scale; if (b < 0x80) return result; scale *= 0x80; } }
  optional(): number { const v = this.varint(); if (v === 0) return absent; const n = v - 1; return n % 2 === 0 ? n / 2 : -(n + 1) / 2; }
  f64(): number { const v = this.view.getFloat64(this.pos, true); this.pos += 8; return v; }
}

function frameFrom(c: Float64Array): InputFrame {
  const vec = (x: number, z: number): Vec2 => ({ x, z });
  const bits = c[19], flags = c[20];
  const frame: InputFrame = {
    move: vec(c[0], c[1]), aim: c[2] === Infinity ? null : vec(c[2], c[3]), aimSource: sources[c[12]],
    left: { down: !!(bits & 1), held: !!(bits & 2), up: !!(bits & 4) }, right: { down: !!(bits & 8), held: !!(bits & 16), up: !!(bits & 32) },
    selector: c[13] as -1 | 0 | 1, interact: !!(bits & 64), pause: !!(bits & 128),
  };
  if (c[4] === c[4]) frame.aimPoint = c[4] === Infinity ? null : vec(c[4], c[5]);
  if (c[6] === c[6]) frame.moveTarget = vec(c[6], c[7]);
  if (c[8] === c[8]) frame.drive = { throttle: c[8], steer: c[9] };
  if (c[10] === c[10]) frame.attackTarget = { id: c[10], side: c[11] === 0 ? 'LEFT' : 'RIGHT' };
  if (c[21] === c[21]) frame.selectedWeaponKey = c[21];
  if (c[14] === c[14]) frame.selectedActiveSlot = c[14];
  if (c[15] === c[15]) frame.selectedSlot = { side: c[16] === 0 ? 'LEFT' : 'RIGHT', index: c[15] };
  if (c[17] === c[17]) frame.selectorSide = c[17] === 0 ? 'LEFT' : 'RIGHT';
  const out = frame as unknown as Record<string, boolean>;
  for (let i = 0; i < optionalFlags.length; i++) { const v = flags >> (i * 2) & 3; if (v) out[optionalFlags[i]] = v === 2; }
  return frame;
}

/** Decode chunks (already gunzipped, in order) into one frame per sample plus the command stream. */
export function decodeLog(chunks: Uint8Array[]): DecodedLog {
  let meta: Record<string, unknown> | null = null; const frames: InputFrame[] = []; const schemeList: number[] = []; const commands: LogCommand[] = [];
  const cur = new Float64Array(SLOTS).fill(absent); let last: InputFrame | null = null; let scheme = 0;
  for (const bytes of chunks) {
    const r = new Reader(bytes);
    // Older MIR1 keyframes stop at slot 20; the appended weapon key stays absent.
    cur.fill(absent);
    if (bytes.length < HEADER || r.view.getUint32(0, true) !== CHUNK_MAGIC) throw new Error('Not a replay chunk');
    const hasMeta = bytes[4] & 1, start = r.view.getUint32(5, true), end = r.view.getUint32(9, true); r.pos = HEADER;
    if (start !== frames.length) throw new Error(`Replay chunk gap: expected sample ${frames.length}, chunk starts at ${start}`);
    if (hasMeta) { const length = r.view.getUint32(r.pos, true); r.pos += 4; meta = JSON.parse(new TextDecoder().decode(bytes.subarray(r.pos, r.pos + length))); r.pos += length; }
    const fill = (until: number): void => { while (frames.length < until) { frames.push(last!); schemeList.push(scheme); } };
    let at = start;
    while (!r.done) {
      const head = r.varint(); at += Math.floor(head / 2); fill(at);
      if (head % 2 === 1) {
        const kind = commandKinds[r.varint()]; if (!kind) throw new Error('Unknown replay command');
        commands.push({ at, kind, value: kind === 'zoom' ? r.f64() : r.varint() });
      } else {
        const mask = r.view.getUint32(r.pos, true); r.pos += 4;
        for (let i = 0; i < SLOTS; i++) if (mask & 1 << i) cur[i] = i < FLOAT_SLOTS ? r.f64() : r.optional();
        last = frameFrom(cur); scheme = cur[18];
        frames.push(last); schemeList.push(scheme);
      }
    }
    fill(end);
  }
  return { meta, samples: frames.length, frames, schemes: Uint8Array.from(schemeList), commands };
}
