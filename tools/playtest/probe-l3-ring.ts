/** P1-114 probe: L3 army checkpoint ring is reachable by real input (click-to-move, then WASD) from where the PO stood. Fixture: debug load + teleport. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, origin, stopServer } from '../scenelab/session';
import { clickGroundInput } from './input';

const out = 'test-results/rg/ring'; mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgpu', tier: 'low', viewport: { width: 1280, height: 720 } });
try {
  await session.open();
  const page = session.page; page.setDefaultTimeout(120_000);
  await page.addInitScript('window.__name = fn => fn');
  await page.goto(`${origin}/?testApi=1&scenelab=1&debug=1&quality=low&dpr=1&audio=muted`);
  await page.waitForFunction(() => !!window.__SS__); await page.evaluate(() => window.__SS__!.ready);
  await page.evaluate(() => window.__SS__!.loadLevel('L3'));
  await page.waitForFunction(() => window.__SS__!.missions.state()?.phase === 'playing' || window.__SS__!.missions.state()?.phase === 'briefing');
  if (await page.evaluate(() => window.__SS__!.missions.state()?.phase === 'briefing')) await page.getByTestId('mission-button').click();
  await page.evaluate(() => { const a = window.__SS__!; a.cheats.completeObjective('armory'); a.cheats.completeObjective('defend'); });
  await page.waitForTimeout(500);
  const start = process.env.START?.split(',').map(Number) ?? [229.93, 0.64];
  await page.evaluate(([x, z]) => window.__SS__!.teleport('player', { x, z }), start);
  const trace: unknown[] = [];
  for (let k = 0; k < 14; k++) {
    await page.waitForTimeout(500);
    trace.push(await page.evaluate(() => { const g = (window.__SCENE__ as unknown as { game: { view: { marker: { visible: boolean; arrow: { visible: boolean }; position: { x: number; y: number; z: number } } | null }; world: { tick: number; storyLock: unknown; missions: { state: { phase: string; marker: string | null } } } } }).game; const m = g.view.marker; return { tick: g.world.tick, vis: m?.visible, arrow: m?.arrow.visible, pos: m && [m.position.x, m.position.y, m.position.z].map(v => +v.toFixed(2)), phase: g.world.missions.state.phase, marker: g.world.missions.state.marker, lock: !!g.world.storyLock }; }));
  }
  console.log('trace', JSON.stringify(trace));
  const info = await page.evaluate(() => { const a = window.__SS__!, s = a.missions.state() as unknown as { steps?: Record<string, { status: string }>; marker?: string | null; l3?: { crossedAt: number; phase: string } }; return { steps: s.steps, marker: s.marker, l3: s.l3, p: a.getEntity(1)!.transform }; });
  console.log('state', JSON.stringify(info));
  await page.screenshot({ path: `${out}/before.png` });
  const ring = { x: 225, z: 0 };
  const result: Record<string, unknown> = { start, info };
  for (let n = 0; n < 8; n++) {
    const at = await page.evaluate(() => window.__SS__!.getEntity(1)!.transform), d = Math.hypot(at.x - ring.x, at.z - ring.z);
    const crossed = await page.evaluate(() => !!(window.__SS__!.missions.state() as unknown as { l3?: { crossedAt: number } }).l3?.crossedAt);
    if (crossed) break;
    const px = await page.evaluate(r => window.__SS__!.input.project(r), ring);
    await clickGroundInput({ releaseKeys: async () => { await page.keyboard.up('KeyW'); }, releaseAim: async () => {}, mouse: page.mouse }, px.x, px.y);
    await page.waitForTimeout(1500);
    result[`step${n}`] = { x: +at.x.toFixed(2), z: +at.z.toFixed(2), dist: +d.toFixed(2), px };
  }
  await page.screenshot({ path: `${out}/after.png` });
  const end = await page.evaluate(() => { const a = window.__SS__!; return { p: a.getEntity(1)!.transform, l3: (a.missions.state() as unknown as { l3?: { crossedAt: number } }).l3 }; });
  result.end = end; writeFileSync(`${out}/result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  assert.ok(end.l3?.crossedAt, 'ring reached by click-to-move');
} finally { await session.close(); stopServer(); }
