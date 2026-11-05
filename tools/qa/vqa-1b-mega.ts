/** vqa-1b: L10 Mega death flash by real mouse rocket fire (vqa-1 P2 #5). Staged spot: cure-complex checkpoint, the Mega is
 * introduced 14 m from the courier with low HP; the kill itself is physical (weapon key + held left mouse on its feet).
 * Frames as fast as screenshots allow for ~5 s after the first shot.  VQA_BACKEND=webgl2|webgpu VQA_TIER=high|low VQA_ZOOM=0.5 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { weaponKey } from '../../src/data/weaponKeys';
import type { Game } from '../../src/Game';

const backend = (process.env.VQA_BACKEND ?? 'webgl2') as 'webgl2' | 'webgpu', tier = (process.env.VQA_TIER ?? 'high') as 'high' | 'low';
const zoom = Number(process.env.VQA_ZOOM ?? .5), hp = Number(process.env.VQA_HP ?? 300), weapon = process.env.VQA_WEAPON ?? 'weapon.rocket-launcher';
const out = `test-results/vqa-1b/mega-${backend}-${tier}-z${zoom}`; mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
const s = new SceneSession({ tier, backend, viewport: { width: 1280, height: 720 }, seed: 32 });
try {
  await s.open();
  await s.page.evaluate('window.__name = f => f');
  await s.page.evaluate(async ({ tier, zoom, hp }) => {
    const a = window.__SS__!; a.settings.set({ quality: tier, cameraShake: false });
    await a.loadLevel('L10', { seed: 32, checkpoint: 'cure-complex' });
    a.pause(); a.cheats.god(true); a.camera.follow(); a.camera.zoom(zoom);
    const g = (window.__SCENE__ as unknown as { game: Game }).game, p = g.world.entities.get(1)!.transform;
    const id = g.world.megaPursuit!.introduce({ x: p.x + 14, z: p.z + 3 });
    await a.step(90);
    const m = g.world.entities.get(id)!; m.health.current = Math.min(m.health.current, hp);
  }, { tier, zoom, hp });
  const key = weaponKey(weapon); if (key !== undefined) await s.page.keyboard.press(`Digit${key}`);
  await s.page.evaluate(() => window.__SS__!.resume());
  const t0 = Date.now(); let n = 0, deadAt = 0;
  while (Date.now() - t0 < 12_000) {
    const info = await s.page.evaluate(() => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game, m = g.world.megaPursuit!.entity(), p = g.world.entities.get(1)!.transform;
      const feet = m ? a.input.project({ x: m.transform.x, z: m.transform.z }, 'destination') : null;
      return { tick: g.world.tick, hp: m?.health.current ?? null, d: m ? +Math.hypot(m.transform.x - p.x, m.transform.z - p.z).toFixed(1) : null, feet, weapon: g.world.entities.get(1)!.weapons?.RIGHT.rack[0]?.id ?? null };
    });
    if (info.hp !== null && info.hp > 0 && info.feet) { await s.page.mouse.move(info.feet.x, info.feet.y); await s.page.mouse.down(); }
    else { await s.page.mouse.up(); deadAt ||= Date.now(); }
    const file = `${out}/${String(n++).padStart(3, '0')}-t${info.tick}.jpg`;
    await s.page.screenshot({ path: file, type: 'jpeg', quality: 80 });
    rows.push({ ...info, file });
    if (deadAt && Date.now() - deadAt > 5000) break;
  }
  await s.page.mouse.up();
  if (s.errors.length) rows.push({ errors: s.errors });
} finally { await s.close(); stopServer(); writeFileSync(`${out}/receipt.json`, JSON.stringify(rows, null, 1)); }
