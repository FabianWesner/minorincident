import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { FixtureReceipt } from './fixtures';
import { atomicJson, reportRoot } from './report';
import { evidenceIsArchivedOrMatches } from './reviews';

type Hashed = { file: string; sha256: string };
type Capture = Hashed & { label: string; zoom: number; kind?: string; camera?: { zoom: number }; state?: { tick: number } };
type Cell = { label: string; zoom: number; afterTick: number; state: { tick: number; quality: string; backend: string; camera: { zoom: number }; alphas: { id: number; hp: number; distance: number }[] }; normal: Hashed; hidden: Hashed; mask: Hashed };
type Physical = {
  sourceHash: string; browserHash: string; toolSha256: string; seed: Hashed;
  setup: { quality: string; backend: string; driverDetached: boolean };
  result: { tick?: number; endTick?: number; inputs: { tick: number; nativeDriver: boolean }[] };
  commands: { keys: string[] }[];
  cells?: Cell[]; captures: Capture[]; errors: string[];
};
type Contrast = { tier: string; label: string; zoom: number; tick: number; sourceHash: string; courierMaskPixels: number; courierP90: number; ringMedian: number; contrast02: number; contrast05: number; ringSamples: unknown[]; captures: { normal: Hashed; hidden: Hashed; mask: Hashed } };
type Review = { sourceHash: string; browserHash: string; inputSha256: string; cityInputSha256: string; allPersonallyReviewed: boolean; alphaHuman: boolean; cityDestruction: boolean; captures: (Hashed & { seen: string })[] };
const root = 'docs/reports/sweep-c6/L7-12';
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const ratio = (a: number, b: number, offset: number) => (Math.max(a, b) + offset) / (Math.min(a, b) + offset);
const physical = (a: Physical) => a.setup.driverDetached && a.result.inputs.length === (a.result.tick ?? a.result.endTick) &&
  a.result.inputs.every((f, i) => f.tick === i && !f.nativeDriver) && a.commands.some(c => c.keys.length > 0) &&
  existsSync(a.seed.file) && sha(readFileSync(a.seed.file)) === a.seed.sha256;

export function l7ReadabilityReceipts(sourceHash: string, browserHash: string): { path: string; receipt: FixtureReceipt }[] {
  const proofPath = `${root}/contrast-proof.json`;
  if (!existsSync(proofPath)) return [];
  const proof = JSON.parse(readFileSync(proofPath, 'utf8')) as { producerSha256: string; rows: Contrast[] };
  if (proof.producerSha256 !== sha(readFileSync('tools/qa/accept/sweep-c6-l7-readability.py'))) return [];
  const rows = [];
  for (const tier of ['low', 'high'] as const) {
    const ip = `${root}/${tier}-physical.json.gz`, cp = `${root}/${tier}-city-physical.json.gz`, rp = `${root}/${tier}-review.json`;
    if (![ip, cp, rp].every(existsSync)) continue;
    const raw = gunzipSync(readFileSync(ip)), cityRaw = gunzipSync(readFileSync(cp));
    const a = JSON.parse(raw.toString()) as Physical, city = JSON.parse(cityRaw.toString()) as Physical, v = JSON.parse(readFileSync(rp, 'utf8')) as Review;
    if ([a, city, v].some(r => r.sourceHash !== sourceHash || r.browserHash !== browserHash) ||
      a.toolSha256 !== sha(readFileSync('tools/qa/accept/sweep-c6-l7-readability.mjs')) || city.toolSha256 !== sha(readFileSync(`${root}/${tier}-city-producer.mjs`)) ||
      v.inputSha256 !== sha(raw) || v.cityInputSha256 !== sha(cityRaw)) continue;
    const valid = [a, city].every(r => r.setup.quality === tier && r.setup.backend === 'webgl' && !r.errors.length && physical(r));
    const cells = [...(a.cells ?? []), ...(city.cells ?? [])], measured = proof.rows.filter(r => r.tier === tier);
    const labels = ['rocket', 'horde-0', 'horde-6', 'horde-12', 'city-0', 'city-6', 'city-12'];
    const matrix = cells.length === 14 && measured.length === 14 && labels.every(label => [.5, 1.5].every(zoom => {
      const c = cells.find(c => c.label === label && c.zoom === zoom), m = measured.find(m => m.label === label && m.zoom === zoom);
      return !!c && !!m && c.state.quality === tier && c.state.backend === 'webgl' && Math.abs(c.state.camera.zoom - zoom) < 1e-8 && c.afterTick === c.state.tick && m.tick === c.state.tick &&
        m.sourceHash === sourceHash && m.courierMaskPixels > 100 && m.ringSamples.length >= 32 && ['normal', 'hidden', 'mask'].every(kind => {
          const key = kind as 'normal' | 'hidden' | 'mask';
          return c[key].file === m.captures[key].file && c[key].sha256 === m.captures[key].sha256 && evidenceIsArchivedOrMatches(c[key].file, c[key].sha256);
        });
    }));
    const consistent = measured.every(m => [m.courierP90, m.ringMedian, m.contrast02, m.contrast05].every(Number.isFinite) &&
      Math.abs(m.contrast02 - ratio(m.courierP90, m.ringMedian, .02)) < 1e-8 && Math.abs(m.contrast05 - ratio(m.courierP90, m.ringMedian, .05)) < 1e-8);
    const contrast = measured.every(m => m.contrast02 >= 3 && m.contrast05 >= 3);
    const counterexample = measured.some(m => m.contrast02 < 3 && m.contrast05 < 3);
    const motion = [.5, 1.5].every(zoom => {
      const burst = [0, 6, 12].map(n => cells.find(c => c.label === `horde-${n}` && c.zoom === zoom));
      const alpha = burst[0]?.state.alphas.find(a => a.hp > 0 && a.distance <= 5);
      return !!alpha && burst.every((c, i) => !!c && c.state.tick === burst[0]!.state.tick + i * 6 && c.state.alphas.some(a => a.id === alpha.id && a.hp > 0 && a.distance <= 8));
    });
    const cityFrames = city.captures.length === 18 && city.cells?.length === 6 && ['city-0', 'city-6', 'city-12'].every(label => [.5, 1.5].every(zoom => city.cells!.some(c =>
      c.label === label && c.zoom === zoom && Math.abs(c.state.camera.zoom - zoom) < 1e-8)));
    const captures = [...a.captures, ...city.captures];
    const reviewed = v.allPersonallyReviewed && v.alphaHuman && v.cityDestruction && v.captures.length === captures.length && captures.every(c =>
      evidenceIsArchivedOrMatches(c.file, c.sha256) && v.captures.some(r => r.file === c.file && r.sha256 === c.sha256 && r.seen.trim()));
    const path = `${reportRoot}/receipts/L7-${tier}-readability-browser.json`;
    const receipt: FixtureReceipt = { version: 1, level: 'L7', tier, sourceHash, fixtureHash: sha(readFileSync(new URL(import.meta.url))), errors: [], observations: { root }, checks: [
      { id: 'L7-12', clause: 'physical rocket and horde player contrast matrix', tier, policy: 'physical-readability',
        status: !valid || !matrix || !consistent ? 'NOT CHECKED' : contrast ? 'PASS' : counterexample ? 'FAIL' : 'NOT CHECKED',
        value: { valid, matrix, minimumContrast02: measured.length ? Math.min(...measured.map(m => m.contrast02)) : null, minimumContrast05: measured.length ? Math.min(...measured.map(m => m.contrast05)) : null,
          counterexamples: measured.filter(m => m.contrast02 < 3 && m.contrast05 < 3).map(m => ({ label: m.label, zoom: m.zoom, tick: m.tick, contrast02: m.contrast02, contrast05: m.contrast05 })) },
        target: 'Actual physical progressed-save low/high; userzoom0.5/1.5 at rocket, live horde and active city fire. Courier ID-mask P90 versus actual2m ring ≥3:1. Report both .02/.05 offsets; require both to pass and call FAIL only when both are below3.', receipt: proofPath },
      { id: 'L7-12', clause: 'reviewed ruined-city and Alpha motion frames', tier, policy: 'physical-readability', status: valid && motion && cityFrames && reviewed ? 'PASS' : 'FAIL',
        value: { motion, cityFrames, reviewed, captures: captures.length }, target: 'Same original living Alpha through actual six/twelve-tick physical movement, both zooms; current-source physically reached ruined-city approach frames at both zooms; all source/mask frames personally reviewed. P: does this read as the worst destruction so far, and do the enlarged Alpha bodies still read as human?', receipt: rp },
    ] };
    atomicJson(path, receipt); rows.push({ path, receipt });
  }
  return rows;
}
