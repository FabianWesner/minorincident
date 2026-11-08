import { cureRadius } from '../../../src/data/cureDust';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fixtureHash, type FixtureReceipt } from './fixtures';
import { atomicJson, reportRoot } from './report';
import { evidenceIsArchivedOrMatches } from './reviews';
type Tick = { tick: number; elapsed: number; radius: number; god: boolean; phase: string; epilogueTicks: number; player: { x: number; z: number; hp: number }; corgi: { id: number; hp: number } };
type Sample = { tick: number; phase: string; phaseTicks: number; epilogueScale: number; puffs: number; title: string | null; credits: string | null; mainMenu: boolean; front: { elapsed: number } };
type Input = { schema?: 'po-2026-11-08'; panorama?: { seconds: number; allCornersVisible: boolean; drawCalls: number; triangles: number }; sourceHash: string; browserHash: string; toolSha256: string; prefix: { file: string; sha256: string }; seed: { file: string; sha256: string }; errors: string[];
  setup: { tick: number; backend: string; quality: string; driverDetached: boolean }; captures: { file: string; sha256: string; label: string; zoom: number; state: Sample }[]; samples: Sample[];
  commands: { stage: string; keys?: string[] }[]; result: { inputs: { tick: number; nativeDriver: boolean; god: boolean; move: { x: number; z: number } }[];
  ticks: Tick[]; touches: { archetype: string; touched: number; dead: number | null; recovered?: number; sameId?: boolean; hp?: number }[]; immune: { id: number; hp: number; minHp: number; lastHp: number }[];
  finish: { elapsed: number; epilogueTicks: number; phase: string } } };
type Review = { sourceHash: string; browserHash: string; allPersonallyReviewed: boolean; tiers: { tier: string; inputSha256: string; mistVisible: boolean; endingVisible: boolean; captures: { file: string; sha256: string; seen: string }[] }[] };
const root = 'docs/reports/sweep-c6/L10-14', sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
export function l10EpilogueReceipts(sourceHash: string, browserHash: string): { path: string; receipt: FixtureReceipt }[] {
  if (!existsSync(`${root}/review.json`)) return [];
  const review = JSON.parse(readFileSync(`${root}/review.json`, 'utf8')) as Review, rows = [];
  // Archived captures cannot qualify the current source. Slim worktrees may
  // omit their binary receipts; leave those clauses unmeasured, not fatal.
  if (review.sourceHash !== sourceHash || review.browserHash !== browserHash || !existsSync(`${root}/producer.mjs`)) return [];
  for (const tier of ['low', 'high'] as const) {
    const file = `${root}/${tier}-physical.json.gz`, fixtureFile = `${root}/${tier}-species-fixture.json`;
    if (!existsSync(file) || !existsSync(fixtureFile)) continue;
    const a = JSON.parse(gunzipSync(readFileSync(file)).toString()) as Input, v = review.tiers.find(v => v.tier === tier);
    const valid = a.schema === 'po-2026-11-08' && a.sourceHash === sourceHash && a.browserHash === browserHash && !a.errors.length && a.setup.driverDetached && a.setup.backend === 'webgl' && a.setup.quality === tier &&
      a.toolSha256 === sha(readFileSync(`${root}/producer.mjs`)) && existsSync(a.prefix.file) && a.prefix.sha256 === sha(readFileSync(a.prefix.file)) && existsSync(a.seed.file) && a.seed.sha256 === sha(readFileSync(a.seed.file)) &&
      a.result.inputs.length > 9000 && a.result.inputs.every((f, i) => f.tick === a.setup.tick + i && !f.nativeDriver);
    const ticks = a.result.ticks, first = ticks[0], end = a.result.finish;
    const continuous = !!first && ticks.length > 9000 && ticks.every((t, i) => t.tick === first.tick + i && t.elapsed === i && Math.abs(t.radius - cureRadius(i)) < 1e-6 && !t.god && t.player.hp === 100 && t.corgi?.id === 99 && t.corgi.hp === 100);
    const duration = end?.epilogueTicks / 60, title = a.samples.find(s => s.phase === 'title');
    const controlTicks = ticks.filter(t => t.elapsed < 8 * 60);
    const control = duration >= 60 && duration <= 75 && !!title && title.front.elapsed === end.epilogueTicks && controlTicks.length === 480 &&
      Math.hypot(controlTicks.at(-1)!.player.x - controlTicks[0].player.x, controlTicks.at(-1)!.player.z - controlTicks[0].player.z) > 1;
    const pull = !!a.panorama && a.panorama.seconds >= 14 && a.panorama.seconds <= 16 && a.panorama.allCornersVisible && a.panorama.drawCalls <= 600 && a.panorama.triangles <= (tier === 'low' ? 500000 : 1500000);
    const mortality = a.result.touches.length >= 3 && ['runner', 'dog', 'alpha'].every(role => a.result.touches.some(t => t.archetype.endsWith(role))) && a.result.touches.every(t => t.recovered !== undefined && t.recovered >= t.touched && t.recovered - t.touched <= 1 && t.sameId === true && (t.hp ?? 0) > 0) &&
      a.result.immune.length >= 5 && a.result.immune.some(e => e.id === 1) && a.result.immune.some(e => e.id === 99) && a.result.immune.every(e => e.hp === e.minHp && e.hp === e.lastHp);
    const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8')) as FixtureReceipt;
    const species = fixture.checks.find(c => c.id === 'L10-14' && c.clause === 'cure native living-species recovery and healthy immunity');
    const value = species?.value as { species: { role: string; reached: number; dead: number; hp: number }[]; healthyChecked: number; harmed: unknown[] } | undefined;
    const allSpecies = fixture.fixtureHash === fixtureHash() && fixture.sourceHash === sourceHash && !fixture.errors.length && species?.status === 'PASS' && !!value && value.healthyChecked >= 37 && !value.harmed.length &&
      ['runner', 'dog', 'alpha', 'lion', 'gorilla', 'elephant', 'zebra', 'flamingo'].every(role => value.species.some(s => s.role === role && s.reached > 0 && s.dead >= s.reached && s.dead - s.reached <= 1 && s.hp > 0));
    const seen = review.sourceHash === sourceHash && review.browserHash === browserHash && review.allPersonallyReviewed && v?.inputSha256 === sha(readFileSync(file)) &&
      a.captures.every(c => v.captures.some(r => r.file === c.file && r.sha256 === c.sha256 && r.seen.trim()) && evidenceIsArchivedOrMatches(c.file, c.sha256));
    const visual = seen && v?.mistVisible && v.endingVisible && [.5, 1.5].every(zoom => a.captures.some(c => c.zoom === zoom && c.label.startsWith('epilogue-') && c.state.puffs > 0)) &&
      a.captures.some(c => c.label === 'title' && c.state.title?.includes('Minor Incident')) && a.captures.some(c => c.label === 'credits-middle' && c.state.phaseTicks >= 360 && c.state.credits?.includes('Minor Incident')) && a.captures.some(c => c.label === 'menu' && c.state.mainMenu) && end.phase === 'done';
    const path = `${reportRoot}/receipts/L10-${tier}-epilogue-browser.json`;
    const receipt: FixtureReceipt = { version: 1, level: 'L10', tier, sourceHash, fixtureHash: sha(readFileSync(new URL(import.meta.url))), errors: [], checks: [
      { id: 'L10-14', clause: 'continuous physical epilogue control and final camera pullback', tier, policy: 'physical-epilogue', status: valid && continuous && control && pull ? 'PASS' : 'NOT CHECKED', value: { valid, continuous, control, pull, duration }, target: 'Consecutive native ticks, physical input, no god after release,8s physical control; title≤75s; 15s full-map pullback within draw/triangle caps.', receipt: file },
      { id: 'L10-14', clause: 'actual cure front recovery immunity and all species fixture', tier, policy: 'physical-epilogue', status: valid && continuous && mortality && allSpecies ? 'PASS' : 'NOT CHECKED', value: { mortality, allSpecies, touched: a.result.touches.length, immune: a.result.immune.length }, target: '10m/s, every touched living infected recovers with same ID≤1tick; actual healthy/player/corgi unharmed, independent native eight-species fixture.', receipt: file },
      { id: 'L10-14', clause: 'reviewed actual mist title credits and menu sequence', tier, policy: 'physical-epilogue', status: valid && visual ? 'PASS' : 'NOT CHECKED', value: { seen, visual }, target: 'Every actual frame personally inspected at both zooms, visible mist, title, middle credits and menu, no skip.', receipt: `${root}/review.json` },
    ] }; atomicJson(path, receipt); rows.push({ path, receipt });
  } return rows;
}
