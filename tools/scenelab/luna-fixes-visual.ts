import { execFileSync } from 'node:child_process';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Game } from '../../src/Game';
import type { ActorSpec, SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, stopServer, writeJson } from './session';
import { measureCourierShare } from './run';

const phase = process.argv[2] === 'before' ? 'before' : 'after';
const quick = process.env.LUNA_QUICK === '1';
const out = resolve(`test-results/luna-fixes-1101/visual-${phase}`);
mkdirSync(out, { recursive: true });
const paths = ['src/render/district/DistrictOcclusion.ts', 'src/render/GameView.ts', 'src/render/VehicleView.ts', 'src/render/characters/VehicleOccupant.ts'];
const temporary: string[] = [];
const receipts: unknown[] = [];
try {
  if (phase === 'before') for (const path of paths) {
    const temp = path.replace(/([^/]+)$/, '__luna_before_$1');
    writeFileSync(temp, execFileSync('git', ['show', `0e3e33219:${path}`])); temporary.push(temp);
  }
  for (const backend of (quick ? ['webgl2'] : ['webgl2', 'webgpu']) as ('webgl2' | 'webgpu')[]) for (const tier of (quick ? ['low'] : ['low', 'high']) as ('low' | 'high')[]) {
    const session = new SceneSession({ backend, tier, viewport: { width: 1280, height: 720 } });
    try {
      await session.open();
      if (phase === 'before') {
        for (const path of paths) await session.page.route(`**/${path}*`, async route => {
          const response = await route.fetch({ url: route.request().url().replace(path, path.replace(/([^/]+)$/, '__luna_before_$1')) });
          await route.fulfill({ response });
        });
        await session.page.reload();
        await session.page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
        await session.page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
      }
      const shot = async (name: string) => { for (let i = 0; i < 16; i++) await session.ready(); await session.page.screenshot({ path: `${out}/${backend}-${tier}-${name}.jpg`, type: 'jpeg', quality: 82 }); };
      for (const z of [0]) {
        const spec: SceneSpec = { name: 'luna-fence-joint', ground: 'asphalt', time: 'L1', dof: false,
          props: [{ id: 'fence', asset: 'prop.privacy-fence', at: [1, 1], scale: [1, 1, .4] }],
          actors: [{ id: 'courier', kind: 'courier', at: [0, 0] }, { id: 'corgi', kind: 'corgi', at: [-1.3, 1.3] }] };
        await session.load(spec);
        for (const zoom of [1.5, .5]) {
          await session.page.evaluate(zoom => window.__SCENE__!.setCamera({ mode: 'game', target: 'courier', zoom }), zoom);
          await measureCourierShare(session); await shot(`Q314-${z}-z${zoom}`);
          receipts.push({ phase, backend, tier, scene: 'fence', z, zoom, share: await measureCourierShare(session), at: await session.page.evaluate(() => window.__SS__!.getEntity(1)!.transform), seeThrough: await session.page.evaluate(() => window.__SCENE__!.cutProbe(false)) });
        }
      }
      if (process.env.LUNA_FENCE_ONLY) continue;
      const crowd: ActorSpec[] = Array.from({ length: 80 }, (_, i) => ({ id: `zombie-${i}`, kind: 'infected', at: [(i % 10 - 4.5) * .48, (Math.floor(i / 10) - 3.5) * .48], state: 'idle' }));
      await session.load({ name: 'luna-crowd', infectedCap: 200, ground: 'asphalt', time: 'L3', actors: [{ id: 'courier', kind: 'courier', at: [0, 0] }, ...crowd] });
      await session.page.evaluate(() => { const g = (window.__SCENE__ as unknown as { game: Game }).game; g.world.entities.get(1)!.health.current = 0; });
      for (const zoom of [1.5, .5]) {
        await session.page.evaluate(zoom => window.__SCENE__!.setCamera({ mode: 'game', target: 'courier', zoom }), zoom);
        await measureCourierShare(session); await shot(`Q318-z${zoom}`);
        receipts.push({ phase, backend, tier, scene: 'crowd', zoom, share: await measureCourierShare(session), foreground: await session.page.evaluate(() => window.__SS__!.getState().render.courierForeground) });
      }
      await session.load({ name: 'luna-apc', ground: 'asphalt', time: 'L9-crossing', dof: false,
        actors: [{ id: 'courier', kind: 'courier', at: [0, 3] }],
        vehicles: [{ id: 'apc', asset: 'vehicle.military-apc', at: [0, 0], yaw: 90, driven: true, floor: true, health: 500 }] });
      await session.step(2);
      for (const zoom of [1.5, .5]) {
        await session.page.evaluate(zoom => window.__SCENE__!.setCamera({ mode: 'game', target: 'apc', zoom }), zoom);
        await shot(`Q316-z${zoom}`);
      }
      await session.page.evaluate(() => window.__SCENE__!.setCamera({ mode: 'close', target: [.5, 1.3, -.8], radius: 4, azimuth: 45 }));
      await shot('Q316-close');
      receipts.push({ phase, backend, tier, scene: 'apc', vehicles: await session.page.evaluate(() => window.__SS__!.getState().render.vehicles) });
      if (session.errors.length) throw new Error(session.errors.join('\n'));
      console.log(`${phase} ${backend} ${tier} complete`);
    } finally { await session.close(); }
  }
  writeJson(`${out}/receipts.json`, receipts);
} finally { for (const path of temporary) unlinkSync(path); stopServer(); }
