/** Q-234: real keyboard movement against every R3 barricade gap and both detours. Run through e2e-lock. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';

const out = 'test-results/misc-30/r3';
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgl2', tier: 'low' });
const rows: { z: number; detour: boolean; x: number; endZ: number }[] = [];
try {
  await session.open();
  await session.page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L10', { seed: 32 });
    a.pause(); a.cheats.god(true); a.camera.follow();
  });
  // D+S resolves to world +X under the production isometric control azimuth.
  for (const z of [9, ...Array.from({ length: 30 }, (_, i) => -23.5 + i * 3), -55, 100]) {
    const detour = z === -55 || z === 100;
    await session.page.evaluate(async z => {
      const a = window.__SS__!;
      a.teleport('player', { x: 1508, z }); await a.step(1); await a.screenshotReady();
    }, z);
    await session.page.keyboard.down('d'); await session.page.keyboard.down('s');
    await session.page.evaluate(() => window.__SS__!.step(240));
    await session.page.keyboard.up('d'); await session.page.keyboard.up('s');
    const at = await session.page.evaluate(() => window.__SS__!.getState().player!.transform);
    rows.push({ z, detour, x: at.x, endZ: at.z });
    assert.ok(Math.abs(at.z - z) < .5, `keyboard path drift at z=${z}: ${JSON.stringify(at)}`);
    assert.ok(detour ? at.x > 1520 : at.x < 1515.36, `R3 ${detour ? 'detour blocked' : 'gap crossed'} at z=${z}: ${at.x}`);
    if (z === 9 || detour) await session.screenshot(`${out}/${detour ? `detour-${z}` : 'blocked-z9'}.png`);
  }
  assert.deepEqual(session.errors, []);
  console.log(JSON.stringify({ rows: rows.length, blocked: rows.filter(r => !r.detour).length, detours: rows.filter(r => r.detour).length, errors: session.errors }));
} finally {
  writeFileSync(`${out}/evidence.json`, JSON.stringify({ rows, errors: session.errors }, null, 2));
  await session.close(); stopServer();
}
