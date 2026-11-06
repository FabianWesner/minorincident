import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { l9Groups } from '../../../src/data/l9';
import type { FixtureReceipt } from './fixtures';
import { atomicJson, reportRoot } from './report';
type Point = { x: number; z: number };
export type DetourProof = { sourceHash: string; browserHash: string; toolSha256: string; physicalSeed: { file: string; sha256: string };
  rows: { tier: string; mode: string; setup: { carId: number; backend: string; quality: string }; errors: string[];
    groups: { id: string; at: [number, number] }[];
    samples: { tick: number; phase: string; position: Point; vehiclePresent: boolean; wheels: number }[];
    commands: { tick: number; keys: string[] }[];
    captures: { sha256: string; label: string; seen?: string }[]; result: { phase: string; inputs: unknown[] } }[] };
function segmentDistance(p: readonly number[], a: Point, b: Point): number {
  const dx = b.x - a.x, dz = b.z - a.z, length2 = dx * dx + dz * dz;
  const t = length2 ? Math.max(0, Math.min(1, ((p[0] - a.x) * dx + (p[1] - a.z) * dz) / length2)) : 0;
  return Math.hypot(p[0] - a.x - t * dx, p[1] - a.z - t * dz);
}
export function detourChecks(proof: DetourProof, tier: string, route: string) {
  const row = proof.rows.find(row => row.tier === tier && row.mode === route), authored = l9Groups.filter(group => group.route === route && !group.id.includes('wanderer'));
  if (!row) return { pass: false, detours: [] };
  const samples = row.samples, detours = authored.map(group => ({ id: group.id, metres: samples.length > 1 ? Math.min(...samples.slice(1).map((sample, i) => segmentDistance(group.at, samples[i].position, sample.position))) : null }));
  const complete = !row.errors.length && row.setup.backend === 'webgl' && row.setup.quality === tier && samples.length > 100 && samples[0].position.x < -540 &&
    samples.at(-1)!.position.x > 450 && samples.at(-1)!.phase === 'approach' && row.result.phase === 'approach' &&
    samples.every((sample, i) => sample.vehiclePresent && sample.wheels === 4 && (!i || sample.tick - samples[i - 1].tick === 12)) &&
    row.commands.length === samples.length - 1 && row.commands.every((command, i) => command.tick === samples[i].tick) && row.commands.some(command => command.keys.includes('KeyW')) && row.result.inputs.length >= row.commands.length;
  const groups = authored.length === ({ road: 2, countryside: 3, 'dry-shortcut': 6 } as Record<string, number>)[route] && row.groups.length === authored.length &&
    authored.every(group => row.groups.some(observed => observed.id === group.id && observed.at[0] === group.at[0] && observed.at[1] === group.at[1]));
  const reviewed = [...authored.map(group => group.id), 'final'].every(label => row.captures.some(capture => capture.label === label && /^[a-f0-9]{64}$/.test(capture.sha256) && capture.seen?.trim()));
  return { pass: complete && groups && reviewed && detours.every(detour => detour.metres !== null && detour.metres >= 20), complete, groups, reviewed, detours, samples: samples.length };
}
export function l9DetourReceipts(sourceHash: string, browserHash: string): { path: string; receipt: FixtureReceipt }[] {
  const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex'), results = [];
  for (const tier of ['low', 'high'] as const) {
    const checks: FixtureReceipt['checks'] = [];
    for (const route of ['road', 'countryside', 'dry-shortcut']) {
      const proofPath = `docs/reports/sweep-c5/L9-02/${tier}-${route}-physical.json.gz`;
      if (!existsSync(proofPath)) continue;
      const proof = JSON.parse(gunzipSync(readFileSync(proofPath)).toString()) as DetourProof;
      if (proof.sourceHash !== sourceHash || proof.browserHash !== browserHash || proof.toolSha256 !== sha(readFileSync('tools/qa/accept/sweep-c5-l9-detours.mjs')) || !existsSync(proof.physicalSeed.file) || sha(readFileSync(proof.physicalSeed.file)) !== proof.physicalSeed.sha256) continue;
      const seed = JSON.parse(gunzipSync(readFileSync(proof.physicalSeed.file)).toString()).campaign.transport.vehicle;
      if (proof.rows.length !== 1 || proof.rows[0].setup.carId !== seed.id) continue;
      const value = detourChecks(proof, tier, route);
      checks.push({ id: 'L9-02', clause: `${route} actual WASD detour around every group`, tier, policy: 'real-input-detour', status: value.pass ? 'PASS' : 'FAIL', value, target: 'full actual physical approach to bridge; all authored group anchors avoided by≥20m along every measured trajectory segment; reviewed group-point and final frames', receipt: proofPath });
    }
    if (!checks.length) continue;
    const path = `${reportRoot}/receipts/L9-${tier}-physical-detours.json`, receipt: FixtureReceipt = { version: 1, level: 'L9', tier, sourceHash, fixtureHash: sha(readFileSync(new URL(import.meta.url))), errors: [], checks };
    atomicJson(path, receipt); results.push({ path, receipt });
  }
  return results;
}
