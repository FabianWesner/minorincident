import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { SceneSession, origin, stopServer } from '../scenelab/session';

type MissionProbe = { def: { anchors: Record<string, { x: number; z: number; y?: number; radius?: number }> }; state: { steps: Record<string, { status: string }>; marker: string | null } };
const out = 'docs/reports/s230-fixedrings';
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'high', viewport: { width: 1280, height: 720 }, query: { quality: 'high', dpr: '1' } });
const shots: PNG[] = [];
try {
  await session.open();
  const page = session.page;
  await page.addInitScript('window.__name = fn => fn');
  await page.goto(`${origin}/?testApi=1&scenelab=1&debug=1&quality=high&dpr=1&audio=muted`);
  await page.waitForFunction(() => !!window.__SS__);
  await page.evaluate(() => window.__SS__!.ready);
  for (const level of ['L4', 'L10']) {
    await page.evaluate(level => window.__SS__!.loadLevel(level, level === 'L4' ? { checkpoint: 'line-break' } : undefined), level);
    await page.waitForFunction(() => ['playing', 'briefing'].includes(window.__SS__!.missions.state()?.phase ?? ''));
    if (await page.evaluate(() => window.__SS__!.missions.state()?.phase === 'briefing')) await page.getByTestId('mission-button').click();
    await page.evaluate(level => {
      const m = (window.__SCENE__ as unknown as { game: { world: { missions: MissionProbe } } }).game.world.missions, p = window.__SS__!;
      p.pause(); p.missions.begin();
      const target = level === 'L4' ? m.def.anchors['l4-cellar-door'] : level === 'L10' ? m.def.anchors['cure-console'] : m.def.anchors['exit-platform'];
      if (level === 'L4') m.state.steps.hide.status = 'active';
      if (level === 'L6') { m.state.marker = 'l6-next'; m.def.anchors['l6-next'] = { ...m.def.anchors['exit-platform'] }; }
      if (level === 'L10') { m.state.steps.mega.status = 'active'; m.state.marker = 'cure-mega'; }
      p.teleport('player', { x: target.x - 4, z: target.z - 3 });
      p.camera.zoom(1);
    }, level);
    await page.evaluate(async () => { await window.__SS__!.step(1); await window.__SS__!.screenshotReady(); });
    const bytes = await page.screenshot({ path: join(out, `${level}-high-z1.png`) });
    shots.push(PNG.sync.read(bytes));
  }
  const width = 1280, height = 360, sheet = new PNG({ width, height });
  for (let panel = 0; panel < shots.length; panel++) {
    const shot = shots[panel], left = panel * 640;
    for (let y = 0; y < 360; y++) for (let x = 0; x < 640; x++) {
      const src = (y * 2 * shot.width + x * 2) * 4, dst = (y * width + left + x) * 4;
      sheet.data.set(shot.data.subarray(src, src + 4), dst);
    }
  }
  writeFileSync(join(out, 'rings-high-z1.png'), PNG.sync.write(sheet));
} finally { await session.close(); stopServer(); }
