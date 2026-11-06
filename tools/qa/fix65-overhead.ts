/** fix65-a: top-down / angled inspection captures of a level area (geometry review only, no sim change). */
import { SceneSession, stopServer } from '../scenelab/session';
import type { Game } from '../../src/Game';
// usage: tsx tools/qa/fix65-overhead.ts L1 out.png cx,cz,height[,tilt] [cx,cz,height[,tilt] ...]
const [level, out, ...views] = process.argv.slice(2);
const tier = (process.env.TIER ?? 'low') as 'low' | 'high';
const s = new SceneSession({ tier, backend: 'webgl2', viewport: { width: 1280, height: 900 } });
try {
  await s.open();
  await s.page.evaluate('window.__name = f => f');
  await s.page.addStyleTag({ content: '.mission-panel,.mission-card,[class*=briefing],[class*=mission-modal]{visibility:hidden!important}' });
  await s.page.evaluate(async ({ level, tier }) => { const a = window.__SS__!; a.settings.set({ quality: tier }); await a.loadLevel(level, { seed: 1 }); a.pause(); }, { level, tier });
  let i = 0;
  for (const v of views) {
    const [cx, cz, h, tilt = 0.01, ty = 0] = v.split(',').map(Number);
    await s.page.evaluate(({ cx, cz, h, tilt, ty }) => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game;
      g.view.view.inspectionPose = { position: [cx + tilt * h, ty + h, cz + tilt * h], target: [cx, ty, cz] };
      g.view.update(1);
    }, { cx, cz, h, tilt, ty });
    await s.step(2);
    await s.screenshot(out.replace('.png', `-${i++}.png`));
  }
} finally { await s.close(); stopServer(); }
