import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer, type Backend } from '../scenelab/session';
/**
 * vqa-fix-3: staged L10 console-charge readability. The courier stands where the vqa-1b real-input run held her
 * (on the bullet tank's west pad behind the vessel, and in the open south of the console) while rockets burst
 * point-blank beside her. Frames are taken a few ticks after each blast, at the game camera.
 *   SCENE_PORT=4418 npx tsx tools/qa/vqa-fix-3-charge.ts <label> <high|low> <webgl2|webgpu> [zoom,...]
 * -> test-results/vqa-fix-3/<label>/<backend>-<tier>/sheet.jpg plus metrics.json (reveal audit per frame).
 */
const [label = 'after', tier = 'high', backend = 'webgl2', zoomList = '1.5,0.5'] = process.argv.slice(2);
const spots = [
  { id: 'tank-pad', at: { x: 4008.44, z: -41.47 } },
  { id: 'open', at: { x: 4004.3, z: -47.8 } },
];
/** Blast offsets from the courier (m) and frame ages after the blast (ticks). */
const blasts = [{ dx: .6, dz: .4 }, { dx: -1.4, dz: 1.2 }];
const ages = [2, 6, 14, 30];
const out = `test-results/vqa-fix-3/${label}/${backend}-${tier}`; mkdirSync(out, { recursive: true });
const session = new SceneSession({ tier: tier as 'high' | 'low', backend: backend as Backend, viewport: { width: 1280, height: 720 } });
const metrics: unknown[] = [];
try {
  await session.open(); const p = session.page;
  await p.evaluate(async () => { const a = window.__SS__!; await a.loadLevel('L10', { seed: 32, checkpoint: 'cure-complex' }); if (a.missions.state()?.phase === 'briefing') a.missions.begin(); a.pause(); a.cheats.god(true); a.camera.follow(); });
  const cells: { frame: number; jpeg: Buffer }[] = [];
  let frame = 0;
  for (const zoom of zoomList.split(',').map(Number)) for (const spot of spots) {
    await p.evaluate(async at => { const a = window.__SS__!; a.teleport('player', at); a.camera.follow(); await a.step(90); }, spot.at);
    await p.evaluate(async z => { window.__SS__!.camera.zoom(z); await window.__SS__!.step(30); }, zoom);
    for (const blast of blasts) {
      let elapsed = 0;
      await p.evaluate(({ at, blast }) => window.__SS__!.explosions.blast('explosion.rocket', { x: at.x + blast.dx, z: at.z + blast.dz }), { at: spot.at, blast });
      for (const age of ages) {
        await p.evaluate(async n => { await window.__SS__!.step(n); }, age - elapsed); elapsed = age;
        const jpeg = await session.snapshot(), name = `${spot.id}-z${zoom}-b${blasts.indexOf(blast)}-t${age}`;
        writeFileSync(`${out}/${name}.jpg`, jpeg); cells.push({ frame: frame++, jpeg });
        metrics.push({ name, ...await p.evaluate(() => {
          const g = (window.__SCENE__ as unknown as { game: { world: { entities: { get(id: number): { transform: { x: number; y: number; z: number } } } }; view: { districts?: { seeThroughAudit(): { solidRadius: number; cutPlacements: string[]; lensPlacements: string[] } } } } }).game;
          const audit = g.view.districts?.seeThroughAudit();
          return { player: g.world.entities.get(1).transform, solidRadius: audit?.solidRadius, cut: audit?.cutPlacements, lens: audit?.lensPlacements };
        }) });
      }
      await p.evaluate(async () => { await window.__SS__!.step(240); });
    }
  }
  await session.makeSheet(cells, `${out}/sheet.jpg`, 400, 900);
  writeFileSync(`${out}/metrics.json`, JSON.stringify({ errors: session.errors, metrics }, null, 1));
  console.log('errors', session.errors.length, out);
} finally { await session.close(); stopServer(); }
