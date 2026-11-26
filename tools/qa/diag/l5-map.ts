/** Orchestrator diagnostic: top-down PNG of L5 walkable nav around the survivors (ring = green, hide = red). */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { l5Survivors } from '../../../src/data/l5';
import { loadLevel } from '../../sim-runner/levels';
const world = await loadLevel('L5', 1);
const nav = world.districts!.nav;
const [X0, X1, Z0, Z1] = (process.argv[3] ?? '-80,20,-70,30').split(',').map(Number) as [number, number, number, number];
const S = 6, W = (X1 - X0) * S, H = (Z1 - Z0) * S, px = Buffer.alloc(W * H * 3);
const set = (x: number, y: number, c: number[]) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; px[i] = c[0]!; px[i + 1] = c[1]!; px[i + 2] = c[2]!; };
for (let z = Z0; z < Z1; z += 0.5) for (let x = X0; x < X1; x += 0.5) {
  const ok = nav.walkable([x + .25, z + .25]);
  for (let a = 0; a < S / 2; a++) for (let b = 0; b < S / 2; b++) set(Math.round((x - X0) * S) + a, Math.round((z - Z0) * S) + b, ok ? [225, 225, 215] : (Math.round(x) % 10 === 0 || Math.round(z) % 10 === 0 ? [90, 90, 110] : [60, 60, 70]));
}
const dot = (p: readonly number[], c: number[]) => { const cx = Math.round((p[0]! - X0) * S), cy = Math.round((p[1]! - Z0) * S); for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) set(cx + a, cy + b, c); };
for (const s of l5Survivors) { dot(s.ringAt, [40, 180, 60]); dot(s.hideAt, [220, 50, 50]); console.log(s.key, 'ring', s.ringAt, 'walkable', nav.walkable(s.ringAt as [number, number]), 'hide', s.hideAt); }
const raw = Buffer.alloc((W * 3 + 1) * H); for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
const crc = (b: Buffer) => { let c = ~0; for (const v of b) { c ^= v; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return ~c >>> 0; };
const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(process.argv[2]!, Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
process.exit(0);
