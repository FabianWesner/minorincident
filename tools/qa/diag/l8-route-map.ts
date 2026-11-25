/** Orchestrator diagnostic: top-down PNG of L8 walkable nav, arenas and the authored player route. */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { l8Route, l8YardGates, l8PlazaGates, l8ConnectorGates, l8PathWalls, l8YardWalls } from '../../../src/data/l8Bosses';
import { loadLevel } from '../../sim-runner/levels';
const world = await loadLevel('L8', 1);
const nav = world.districts!.nav;
const X0 = -110, X1 = 150, Z0 = -100, Z1 = 110, S = 4;
const W = (X1 - X0) * S, H = (Z1 - Z0) * S, px = Buffer.alloc(W * H * 3);
const set = (x: number, y: number, c: number[]) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; };
const toPx = (x: number, z: number) => [Math.round((x - X0) * S), Math.round((z - Z0) * S)];
for (let z = Z0; z < Z1; z++) for (let x = X0; x < X1; x++) {
  const ok = nav.walkable([x + .5, z + .5]);
  for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) set((x - X0) * S + a, (z - Z0) * S + b, ok ? [225, 225, 215] : [60, 60, 70]);
}
const line = (a: {x:number;z:number}, b: {x:number;z:number}, c: number[], w = 2) => {
  const [x0, y0] = toPx(a.x, a.z), [x1, y1] = toPx(b.x, b.z), n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n); for (let dx = -w; dx <= w; dx++) for (let dy = -w; dy <= w; dy++) set(x + dx, y + dy, c); }
};
const rect = (r: {x0:number;z0:number;x1:number;z1:number}, c: number[]) => { line({x:r.x0,z:r.z0},{x:r.x1,z:r.z0},c,1); line({x:r.x1,z:r.z0},{x:r.x1,z:r.z1},c,1); line({x:r.x1,z:r.z1},{x:r.x0,z:r.z1},c,1); line({x:r.x0,z:r.z1},{x:r.x0,z:r.z0},c,1); };
const gate = (g: {x:number;z:number;halfX:number;halfZ:number}, c: number[]) => rect({ x0: g.x - g.halfX, z0: g.z - g.halfZ, x1: g.x + g.halfX, z1: g.z + g.halfZ }, c);
const colors = [[230,60,60],[230,140,30],[200,180,0],[40,160,60],[40,120,220],[150,60,200]];
let total = 0, prev: {x:number;z:number} | null = null;
const rows: string[] = [];
l8Route.forEach((s, i) => {
  rect(s.zone, colors[i]!);
  if (s.entry) gate(s.entry, [0, 0, 0]); if (s.exit) gate(s.exit, [255, 255, 255]);
  const pts = [...(prev ? [prev] : []), ...s.nodes];
  let len = 0; for (let k = 1; k < pts.length; k++) { line(pts[k - 1]!, pts[k]!, colors[i]!); len += Math.hypot(pts[k]!.x - pts[k - 1]!.x, pts[k]!.z - pts[k - 1]!.z); }
  total += len; rows.push(`${s.id}: walk ${len.toFixed(0)} m to entry; zone ${JSON.stringify(s.zone)}; exit ${JSON.stringify(s.exit)}`);
  prev = s.exit ? { x: s.exit.x, z: s.exit.z } : s.nodes.at(-1)!;
});
for (const g of l8YardGates) gate(g, [255, 0, 255]);
for (const g of l8YardWalls) gate(g, [0, 100, 255]);
for (const g of l8PathWalls) gate(g, [255, 50, 160]);
for (const g of l8ConnectorGates) gate(g, [255, 110, 0]);
for (const g of Object.values(l8PlazaGates)) gate(g, [0, 200, 200]);
// The outer wall is authored in the layout with four gate gaps.
for (const [a, b] of [[{x:-116,z:-86},{x:-2.7,z:-86}], [{x:2.7,z:-86},{x:116,z:-86}], [{x:-116,z:86},{x:-2.7,z:86}], [{x:2.7,z:86},{x:116,z:86}], [{x:-116,z:-86},{x:-116,z:-2.7}], [{x:-116,z:2.7},{x:-116,z:86}], [{x:116,z:-86},{x:116,z:77.3}], [{x:116,z:82.7},{x:116,z:86}]] as const) line(a,b,[120,60,30],1);
const raw = Buffer.alloc((W * 3 + 1) * H); for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
const crc = (b: Buffer) => { let c = ~0; for (const v of b) { c ^= v; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return ~c >>> 0; };
const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(process.argv[2]!, Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(rows.join('\n')); console.log(`authored route total ${total.toFixed(2)} m; nav bounds ${nav.min} .. ${nav.max}`);
process.exit(0);
