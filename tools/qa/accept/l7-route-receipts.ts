import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { FixtureReceipt } from './fixtures';
import { atomicJson, reportRoot } from './report';
import { evidenceIsArchivedOrMatches } from './reviews';

type Pose = { tick: number; player: { x: number; z: number } };
type Capture = { file: string; sha256: string; label: string; state: Pose };
type Input = {
  sourceHash: string; browserHash: string; toolSha256: string;
  seed: { file: string; sha256: string };
  setup: { backend: string; quality: string; driverDetached: boolean };
  inputs: { tick: number; nativeDriver: boolean }[];
  samples: Pose[]; captures: Capture[]; errors: string[];
  commands: { screenshotOnly?: boolean; reason?: string; keys: string[] }[];
};
type Review = { sourceHash: string; browserHash: string; allPersonallyReviewed: boolean;
  artifacts: { file: string; sha256: string }[]; captures: (Capture & { seen: string })[];
  clarity: { pass: boolean; note: string }; };
const root = 'docs/reports/sweep-c6/L7-06';
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const read = (file: string): Input => JSON.parse(gunzipSync(readFileSync(file)).toString()) as Input;
const corridor = (p: Pose) => p.player.x >= -84 && p.player.x <= -30 && p.player.z >= 43 && p.player.z <= 56;

export function l7RouteReceipts(sourceHash: string, browserHash: string): { path: string; receipt: FixtureReceipt }[] {
  const reviewFile = `${root}/review.json`, screenFile = `${root}/low-screen-physical.json.gz`;
  if (!existsSync(reviewFile) || !existsSync(screenFile)) return [];
  const review = JSON.parse(readFileSync(reviewFile, 'utf8')) as Review, screen = read(screenFile);
  const metadata = (a: Input, tier: string, producer: string) => a.sourceHash === sourceHash && a.browserHash === browserHash &&
    a.toolSha256 === sha(readFileSync(`${root}/${producer}`)) && a.setup.backend === 'webgl' && a.setup.quality === tier &&
    a.setup.driverDetached && !a.errors.length && existsSync(a.seed.file) && sha(readFileSync(a.seed.file)) === a.seed.sha256;
  const physical = (a: Input) => !!a.inputs?.length && a.inputs.every((f, i) => f.tick === i && !f.nativeDriver) &&
    a.inputs.length === a.samples.at(-1)?.tick && a.commands.some(c => c.keys.length > 0);
  const validReview = review.sourceHash === sourceHash && review.browserHash === browserHash && review.allPersonallyReviewed &&
    review.artifacts.every(a => existsSync(a.file) && sha(readFileSync(a.file)) === a.sha256);
  const seen = (a: Input) => a.captures.length > 0 && a.captures.every(c => review.captures.some(v =>
    v.file === c.file && v.sha256 === c.sha256 && v.seen.trim()) && evidenceIsArchivedOrMatches(c.file, c.sha256));
  const manual = screen.commands.filter(c => c.screenshotOnly);
  const clarity = metadata(screen, 'low', 'screen-producer.mjs') && physical(screen) && seen(screen) && manual.length >= 5 &&
    manual.every(c => !!c.reason?.trim()) && screen.samples.some(corridor) && review.clarity.pass && !!review.clarity.note.trim();
  const boundsProof = JSON.parse(readFileSync(`${root}/bounds-provenance.json`, 'utf8')) as {sourceHash: string; toolSha256: string};
  const currentBounds = boundsProof.sourceHash === sourceHash && boundsProof.toolSha256 === sha(readFileSync('tools/qa/visual-p1-bounds.ts'));
  const rows = [];
  for (const tier of ['low', 'high'] as const) {
    const aFile = `${root}/${tier}-A-physical.json.gz`, bFile = `${root}/${tier}-B-physical.json.gz`;
    if (!existsSync(aFile) || !existsSync(bFile)) continue;
    const a = read(aFile), b = read(bFile);
    const valid = metadata(a, tier, 'routes-A-producer.mjs') && metadata(b, tier, 'routes-B-producer.mjs') && physical(a) && physical(b);
    const routeA = a.samples.some(s => s.player.x < -72 && s.player.z < -35) && a.samples.some(s => s.player.x < -72 && corridor(s));
    const routeB = b.samples.some(s => s.player.x > 75 && s.player.z > 43) && b.samples.some(corridor);
    const boundsFile = `${root}/bounds-${tier}/bounds-sweep.json`;
    const bounds = JSON.parse(readFileSync(boundsFile, 'utf8')) as { tier: string; counterproof: boolean; results: { level: string; walked: number; driven: number; failures: unknown[] }[] };
    const perimeter = currentBounds && bounds.tier === tier && !bounds.counterproof && bounds.results.length === 1 &&
      bounds.results[0].level === 'L7' && bounds.results[0].walked === 129 && bounds.results[0].driven > 0 && !bounds.results[0].failures.length;
    const path = `${reportRoot}/receipts/L7-${tier}-routes-browser.json`;
    const receipt: FixtureReceipt = { version: 1, level: 'L7', tier, sourceHash, fixtureHash: sha(readFileSync(new URL(import.meta.url))),
      errors: [], observations: { aFile, bFile, screenFile, reviewFile, boundsFile }, checks: [
        { id: 'L7-06', clause: 'physical Harbor and Lakeshore corridor routes with current bounds sweep', tier, policy: 'physical-routes',
          status: valid && routeA && routeB && perimeter && validReview && seen(a) && seen(b) ? 'PASS' : 'NOT CHECKED',
          value: { valid, routeA, routeB, perimeter, validReview, seenA: seen(a), seenB: seen(b) }, target: 'Real progressed save, complete physical input trace, both distinct map branches into corridor and current production perimeter sweep; reviewed frames.', receipt: reviewFile },
        { id: 'L7-06', clause: 'screenshot-only wrong-turn and route-clarity review', tier, policy: 'physical-routes',
          status: validReview && clarity ? 'PASS' : 'NOT CHECKED', value: { clarity, commands: manual.length, note: review.clarity.note },
          target: 'Separate screenshot-only controller after logged east-junction prefix; physical wrong-turn recovery and route to corridor; no post-prefix map/nav/planner recommendations.', receipt: screenFile },
      ] };
    atomicJson(path, receipt); rows.push({ path, receipt });
  }
  return rows;
}
