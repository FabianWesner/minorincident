import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { FixtureReceipt } from './fixtures';
import { atomicJson, reportRoot } from './report';
import { evidenceIsArchivedOrMatches } from './reviews';

type Hashed = { file: string; sha256: string };
type Sample = { tick: number; phase: string; hud?: string; hp: number; speed: number; speedCap: number; damage: string; vehiclePresent: boolean; wheels: number; position: { x: number; z: number } };
type Event = { type: string; tick: number; name?: string; id?: string };
type Cell = { tier: string; mode: string; setup: { before: number; after: number; backend: string; quality: string }; errors: string[]; samples: Sample[]; commands: { tick: number; keys: string[] }[]; captures: { file: string; sha256: string; tick: number; zoom: number; label: string }[]; result: { events: Event[] } };
type Physical = { sourceHash: string; browserHash: string; toolSha256: string; rows: Cell[] };
type Review = { captures: { file: string; sha256: string; seen?: string }[]; sheets: Hashed[]; rawCleanup: { verifiedAndDeleted: number; allPersonallyReviewed: boolean } };

/** Actual physical zero-HP and healthy comparison, with separately reviewed images.
 * Archived producer bytes bind the earlier healthy run; no historical game hash is rebound. */
export function sweepC3L9Receipts(sourceHash: string, browserHash: string): { path: string; receipt: FixtureReceipt }[] {
  const manifestPath = 'docs/reports/sweep-c3/L9-05/qualification.json';
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    full: Hashed; zero: Hashed; speed: Hashed; fullProducer: Hashed; zeroProducer: Hashed; speedProducer: Hashed; fullReview: Hashed; zeroReview: Hashed;
    visual: { smokeObserved: boolean; wholeHullAndAttachedWheels: boolean; what: string };
  };
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  const read = (ref: Hashed) => {
    const b = readFileSync(ref.file);
    if (sha(b) !== ref.sha256) throw new Error(`L9 physical evidence mismatch: ${ref.file}`);
    return b;
  };
  const full = JSON.parse(gunzipSync(read(manifest.full)).toString()) as Physical;
  const zero = JSON.parse(gunzipSync(read(manifest.zero)).toString()) as Physical;
  const speed = JSON.parse(gunzipSync(read(manifest.speed)).toString()) as Physical;
  if ([full, zero, speed].some(p => p.sourceHash !== sourceHash || p.browserHash !== browserHash) ||
    full.toolSha256 !== sha(read(manifest.fullProducer)) || zero.toolSha256 !== sha(read(manifest.zeroProducer)) ||
    speed.toolSha256 !== sha(read(manifest.speedProducer))) return [];
  const fullReview = JSON.parse(read(manifest.fullReview).toString()) as Review;
  const zeroReview = JSON.parse(read(manifest.zeroReview).toString()) as Review;
  const reviewed = (cell: Cell, review: Review) => review.rawCleanup.allPersonallyReviewed &&
    review.rawCleanup.verifiedAndDeleted === review.captures.length && review.sheets.length > 0 &&
    review.sheets.every(sheet => evidenceIsArchivedOrMatches(sheet.file, sheet.sha256)) && cell.captures.length >= 22 &&
    cell.captures.every(capture => review.captures.some(c => c.file === capture.file && c.sha256 === capture.sha256 && c.seen?.trim()));
  const road = (cell: Cell) => cell.samples.filter(s => s.phase === 'driving' && Math.abs(s.position.z + 330) < 3 && s.position.x > -240 && s.position.x < 220);
  const results: { path: string; receipt: FixtureReceipt }[] = [];
  for (const tier of ['low', 'high'] as const) {
    const healthy = full.rows.find(r => r.tier === tier && r.mode === 'full'), empty = zero.rows.find(r => r.tier === tier && r.mode === 'zero');
    if (!healthy || !empty) continue;
    const valid = (cell: Cell, review: Review) => cell.setup.backend === 'webgl' && cell.setup.quality === tier && !cell.errors.length &&
      cell.samples.at(-1)?.phase === 'crawl' && cell.commands.some(i => i.keys.includes('KeyW')) && reviewed(cell, review);
    const validPair = valid(healthy, fullReview) && valid(empty, zeroReview);
    const speedHealthy = speed.rows.find(r => r.tier === tier && r.mode === 'full'), speedEmpty = speed.rows.find(r => r.tier === tier && r.mode === 'zero');
    if (!speedHealthy || !speedEmpty) continue;
    // The uninterrupted fixed-tick comparison retains many steady road samples.
    // The rendered smoke stop can leave the road; its one high-tier road sample
    // is deliberately excluded from the speed comparison.
    const healthyRoad = road(speedHealthy), emptyRoad = road(speedEmpty);
    const healthyPeak = Math.max(...healthyRoad.map(s => s.speed)), emptyPeak = Math.max(...emptyRoad.map(s => s.speed));
    const ratio = emptyPeak / healthyPeak;
    const driving = empty.samples.filter(s => s.phase === 'driving');
    const metres = empty.samples.slice(1).reduce((n, b, i) => {
      const a = empty.samples[i]; return n + (a.phase === 'driving' ? Math.hypot(b.position.x - a.position.x, b.position.z - a.position.z) : 0);
    }, 0);
    const speedPass = validPair && empty.setup.before > 0 && empty.setup.after === 0 && driving.length > 10 &&
      driving.every(s => s.hp === 0 && s.damage === 'smoking' && s.vehiclePresent) && metres > 1000 &&
      speedEmpty.setup.after === 0 && !speedEmpty.errors.length && !speedHealthy.errors.length &&
      healthyRoad.length > 10 && emptyRoad.length > 10 && emptyRoad.every(s => s.hp === 0) && healthyPeak > 1 && ratio >= .58 && ratio <= .62 &&
      emptyRoad.every(s => Math.abs(s.speedCap - .6) < 1e-9) && manifest.visual.smokeObserved && !!manifest.visual.what.trim();
    const path = `${reportRoot}/receipts/L9-${tier}-sweep-c3-physical.json`;
    const receipt: FixtureReceipt = { version: 1, level: 'L9', tier, sourceHash,
      fixtureHash: sha(readFileSync(new URL(import.meta.url))), errors: [], checks: [], observations: { manifestPath, browserHash } };
    receipt.checks.push({ id: 'L9-05', clause: 'physical zero-HP speed smoke and continued driving', tier, policy: 'controlled-physical',
      status: speedPass ? 'PASS' : 'FAIL', value: { validPair, healthyPeak, emptyPeak, ratio, metres, drivingSamples: driving.length, smoke: manifest.visual },
      target: 'actual 0HP, >1km physical drive to crash; matched straight-road speed58–62% of healthy; road cap0.6; all driving samples smoking; reviewed dense plume', receipt: manifestPath });
    const crashes = [healthy, empty].map(cell => {
      const impacts = cell.result.events.filter(e => e.type === 'mission.signal' && e.name === 'l9.crash-impact');
      const objectives = cell.result.events.filter(e => e.type === 'objective.started' && e.id === 'reach-outskirts');
      const falling = cell.samples.filter(s => s.phase === 'fall');
      const impact = impacts[0]?.tick;
      return { mode: cell.mode, impacts, objectives, fallSamples: falling.length,
        intact: falling.length >= 9 && falling.every(s => s.vehiclePresent && s.wheels === 4),
        hudOrdered: impact !== undefined && cell.samples.filter(s => s.tick < impact).every(s => !s.hud?.includes('Get clear of the wreck')) &&
          cell.samples.some(s => s.tick >= impact && s.hud?.includes('Get clear of the wreck')) };
    });
    const crashPass = validPair && healthy.setup.after > 0 && empty.setup.after === 0 && manifest.visual.wholeHullAndAttachedWheels &&
      crashes.every(c => c.impacts.length === 1 && c.objectives.length === 1 && c.objectives[0].tick >= c.impacts[0].tick && c.intact && c.hudOrdered);
    receipt.checks.push({ id: 'L9-07', clause: 'physical full and zero whole-body crash and objective ordering', tier, policy: 'controlled-physical',
      status: crashPass ? 'PASS' : 'FAIL', value: { validPair, crashes, visual: manifest.visual.wholeHullAndAttachedWheels },
      target: 'full and0HP actual drives reach crawl; one impact; whole hull/wheels throughout falling samples and reviewed frames; objective/HUD at or after impact', receipt: manifestPath });
    results.push({ path, receipt }); atomicJson(path, receipt);
  }
  return results;
}
