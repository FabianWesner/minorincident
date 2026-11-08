/** One pooled headless browser: authored LODs plus courier hold/fire proof at both requested zooms. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, origin, stopServer } from './session';

const out = 'test-results/r15-flamer';
const report = 'docs/reports/r15-flamer';
const spec = JSON.parse(readFileSync(`${report}/scene.json`, 'utf8')) as SceneSpec;
const session = new SceneSession({ viewport: { width: 1280, height: 720 }, backend: 'webgl2', tier: 'high' });
const game: unknown[] = [], lods: unknown[] = [];
mkdirSync(out, { recursive: true });
try {
  await session.open();
  for (const zoom of [1, 1.5]) {
    spec.camera = { mode: 'game', target: 'courier', zoom };
    await session.load(spec);
    for (const [pose, frames] of [['hold', 24], ['fire', 21]] as const) {
      await session.step(frames);
      await session.screenshot(`${out}/zoom-${zoom}-${pose}.png`);
      const evidence = await session.page.evaluate(() => {
        const api = window.__SS__!, s = api.getState();
        return {
          camera: s.render.camera, backend: s.render.backend,
          effectiveZoom: Math.hypot(...s.render.camera.position) / s.render.camera.radius,
          attachments: s.render.actions!.attachments.filter(a => a.visible),
          supportHandGap: s.render.character!.supportHandGap,
          particles: s.render.vfx!.particles,
          attacks: api.events(0).filter(e => e.type === 'combat.attack' && e.actionId === 'weapon.flamethrower'),
        };
      });
      writeFileSync(`${out}/zoom-${zoom}-${pose}.json`, JSON.stringify(evidence, null, 2) + '\n');
      const held = evidence.attachments[0];
      if (Math.abs(evidence.effectiveZoom - zoom) > .001) throw new Error('Requested game-camera zoom was not applied');
      if (evidence.attachments.length !== 1 || held?.actionId !== 'weapon.flamethrower' || held.source !== 'glb') throw new Error('Dedicated flamethrower GLB is not in hand');
      if (held.handDistance > .05 || held.gripDistance > .0001 || evidence.supportHandGap > .02) throw new Error('Flamethrower hand contact failed');
      if (pose === 'fire' && (!evidence.attacks.length || !evidence.particles)) throw new Error('No actual flamethrower discharge');
      game.push({ zoom, pose, ...evidence });
    }
  }
  await session.page.setViewportSize({ width: 800, height: 450 });
  await session.page.goto(`${origin}/preview/?asset=wpn.flamethrower&test=1&renderer=webgl&production=1`);
  await session.page.waitForFunction(() => !!window.__ASSET__);
  await session.page.evaluate(() => window.__ASSET__!.ready);
  await session.page.locator('#toolbar').evaluate(el => { el.style.display = 'none'; });
  for (const [index, quality] of ['high', 'lod1', 'lod2'].entries()) {
    await session.page.evaluate(async quality => { await window.__ASSET__!.inspectionView!(quality as 'high' | 'lod1' | 'lod2', 75); }, quality);
    const info = await session.page.evaluate(() => window.__ASSET__!.info());
    if (info.placeholder || info.events.length) throw new Error(`LOD${index} is a placeholder`);
    await session.page.screenshot({ path: `${out}/lod${index}.png` });
    lods.push({ lod: index, ...info });
  }
  await session.page.evaluate(async () => {
    const icon = document.createElement('img'); icon.id = 'proof-icon'; icon.src = '/src/assets/icons/flamethrower.svg'; icon.width = icon.height = 128;
    icon.style.cssText = 'position:fixed;left:0;top:0;z-index:100'; document.body.append(icon); await icon.decode();
  });
  await session.page.locator('#proof-icon').screenshot({ path: `${out}/icon.png` });
  if (session.errors.length) throw new Error(session.errors.join('\n'));
  writeFileSync(`${report}/evidence.json`, JSON.stringify({ browser: 'one pooled headless Metal WebGL2 context', game, lods, consoleErrors: session.errors }, null, 2) + '\n');
} finally { await session.close(); stopServer(); }
