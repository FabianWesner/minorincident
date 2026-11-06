import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { megaAlpha } from '../../../src/data/megaAlpha';
import type { FixtureReceipt } from './fixtures';
import { atomicJson, reportRoot } from './report';
import { evidenceIsArchivedOrMatches } from './reviews';

type Camera = { regionScale: number; zoom: number };
type Shot = { file: string; sha256: string; label: string; zoom?: number; state: {
  tick: number; camera: Camera; finale: boolean;
  mega?: { id: number; hp: number; distance: number; special?: { move: string; stage: string; attackId: number } };
  telegraphs?: { sourceId: number; attackId: number; shape: number; radius: number }[];
} };
type Run = { stage: string; seed: { file: string; sha256: string }; setup: { tick: number; backend: string; quality: string; driverDetached: boolean };
  captures: Shot[]; result: { inputs: { tick: number; nativeDriver: boolean }[] } };
type Input = { sourceHash: string; browserHash: string; toolSha256: string; prefixSha256: string; rows: Run[]; errors: string[] };
type Review = { sourceHash: string; browserHash: string; allPersonallyReviewed: boolean; tiers: {
  tier: string; inputSha256: string; slamInputSha256: string; captures: { file: string; sha256: string; seen: string }[];
  roadEdgesVisible: boolean; nightClothingReadable: boolean; slamOnGround: boolean;
}[] };
const root = 'docs/reports/sweep-c6/L10-08';
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const read = (p: string): Input => JSON.parse(gunzipSync(readFileSync(p)).toString()) as Input;

export function l10FramingReceipts(sourceHash: string, browserHash: string): { path: string; receipt: FixtureReceipt }[] {
  if (!existsSync(`${root}/review.json`)) return [];
  const review = JSON.parse(readFileSync(`${root}/review.json`, 'utf8')) as Review;
  const camera = JSON.parse(readFileSync(`${root}/camera-capability.json`, 'utf8')) as { sourceHash: string; toolSha256: string; rows: {
    tier: string; position: { id: string; x: number }; weapon: string; regionScale: number; playerZoom: number; combined: number;
  }[] };
  const rows = [];
  for (const tier of ['low', 'high'] as const) {
    const file = `${root}/${tier}-physical.json.gz`, slamFile = `${root}/${tier}-slam-physical.json.gz`;
    if (!existsSync(file) || !existsSync(slamFile)) continue;
    const a = read(file), b = read(slamFile), v = review.tiers.find(r => r.tier === tier);
    const metadata = (x: Input, producer: string, prefix: string) => x.sourceHash === sourceHash && x.browserHash === browserHash &&
      x.toolSha256 === sha(readFileSync(`${root}/${producer}`)) && x.prefixSha256 === sha(readFileSync(`${root}/${prefix}`));
    const valid = metadata(a, 'framing-producer.mjs', 'prefix-proof.json') && metadata(b, 'slam-producer.mjs', 'close-prefix-proof.json') &&
      a.errors.every(e => e === 'No naturally scheduled slam telegraph witnessed') && !b.errors.length;
    const physical = (r: Run) => r.setup.backend === 'webgl' && r.setup.quality === tier && r.setup.driverDetached &&
      r.result.inputs.length > 0 && r.result.inputs.every((f, i) => f.tick === r.setup.tick + i && !f.nativeDriver) &&
      sha(readFileSync(r.seed.file)) === r.seed.sha256;
    const roads = ['road1', 'road2', 'road3', 'road4', 'road5'].map(stage => a.rows.find(r => r.stage === stage));
    const roadMatrix = roads.every(r => r && physical(r) && r.result.inputs.length === 12 &&
      ['initial', 'move-12'].every(label => [.5, 1.5].every(zoom => r.captures.some(c => c.label === label && c.zoom === zoom &&
        Math.abs(c.state.camera.zoom - zoom) < 1e-8 && Math.abs(c.state.camera.regionScale - 1.3) < 1e-8 && !c.state.finale))) &&
      r.captures.some(c => c.label === 'max-user-zoom' && c.state.camera.regionScale * c.state.camera.zoom <= 2 + 1e-8));
    const rig = camera.rows.filter(r => r.tier === tier);
    const cap = camera.sourceHash === sourceHash && camera.toolSha256 === sha(readFileSync('tools/qa/accept/sweep-c6-l10-camera.ts')) && rig.length === 14 &&
      [600, 980, 1500, 2100, 2630].every(x => ['weapon.pistol', 'weapon.rocket-launcher'].every(weapon => rig.some(r => r.position.x === x && r.weapon === weapon))) &&
      rig.every(r => Math.abs(r.regionScale - (r.position.id === 'road' ? 1.3 : 1)) < 1e-8 &&
        Math.abs(r.combined - r.regionScale * r.playerZoom) < 1e-8 && r.combined <= 2 + 1e-8);
    const finale = b.rows.find(r => r.stage === 'charge'), first = finale?.captures.find(c => c.label === 'slam-0');
    const slam = !!finale && physical(finale) && !!first?.state.mega?.special && ['slam-0', 'slam-6', 'slam-12'].every((label, i) =>
      [.5, 1.5].every(zoom => finale.captures.some(c => c.label === label && c.zoom === zoom && c.state.tick === first.state.tick + i * 6 &&
        c.state.finale && Math.abs(c.state.camera.regionScale - 1) < 1e-8 && c.state.mega?.hp &&
        c.state.mega.special?.move === 'alpha.ground-slam' && c.state.mega.special.stage === 'telegraph' &&
        c.state.mega.special.attackId === first.state.mega?.special?.attackId && c.state.telegraphs?.some(t =>
          t.sourceId === c.state.mega?.id && t.attackId === c.state.mega.special?.attackId && t.shape === 1 && t.radius === megaAlpha.moves['alpha.ground-slam'].radius))));
    const seen = review.sourceHash === sourceHash && review.browserHash === browserHash && review.allPersonallyReviewed &&
      v?.inputSha256 === sha(readFileSync(file)) && v?.slamInputSha256 === sha(readFileSync(slamFile)) &&
      [...a.rows.flatMap(r => r.captures), ...b.rows.flatMap(r => r.captures)].every(c => v.captures.some(r =>
        r.file === c.file && r.sha256 === c.sha256 && r.seen.trim()) && evidenceIsArchivedOrMatches(c.file, c.sha256));
    const path = `${reportRoot}/receipts/L10-${tier}-framing-browser.json`;
    const receipt: FixtureReceipt = { version: 1, level: 'L10', tier, sourceHash, fixtureHash: sha(readFileSync(new URL(import.meta.url))), errors: [],
      observations: { root, file, slamFile }, checks: [
        { id: 'L10-08', clause: 'physical five-region road framing matrix', tier, policy: 'physical-framing', status: valid && roadMatrix ? 'PASS' : 'NOT CHECKED',
          value: { valid, roadMatrix }, target: 'Five current native progressed saves; actual WASD and camera0.5/1.5 plus max request; road base1.3, combined≤2.', receipt: file },
        { id: 'L10-08', clause: 'production road and finale maximal zoom clamp', tier, policy: 'physical-framing', status: cap ? 'PASS' : 'NOT CHECKED',
          value: { cap, cells: rig.length, maximum: Math.max(...rig.map(r => r.combined)) }, target: 'Actual View, both gun and rocket, all five roads/corridor/finale; base1.3 roads,1 elsewhere, base×maxzoom≤2.', receipt: `${root}/camera-capability.json` },
        { id: 'L10-08', clause: 'reviewed night road verges clothing and natural ground-slam telegraph', tier, policy: 'physical-framing',
          status: valid && slam && seen && v?.roadEdgesVisible && v.nightClothingReadable && v.slamOnGround ? 'PASS' : 'NOT CHECKED',
          value: { slam, seen, firstSlamTick: first?.state.tick, startDistance: first?.state.mega?.distance },
          target: 'Every actual frame personally reviewed; verges/fields, night clothing, native ground-slam six/twelve-tick strip, exact same attack ID/ground-ring shape and normal finale base.', receipt: `${root}/review.json` },
      ] };
    atomicJson(path, receipt); rows.push({ path, receipt });
  }
  return rows;
}
