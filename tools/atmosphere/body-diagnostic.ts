import { mkdirSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
const tier = process.argv[2] === 'low' ? 'low' : 'high';
const s = new SceneSession({ tier, viewport: { width: 1600, height: 900 } });
const out = `docs/reports/night-bodies-eyes/diagnostic-${tier}`; mkdirSync(out, { recursive: true });
try {
 await s.open();
 await s.page.evaluate(async () => {
  const a = window.__SS__!; await a.loadLevel('night-street'); a.pause(); a.cheats.god(true);
  a.teleport('player', { x: 51, z: -32.5 }); a.camera.follow(); await a.step(90);
  for (let i=0;i<3;i++) a.spawn('infected.runner', { x: 47-i*.6, z:-30 }, {state:'idle',yaw:-Math.PI/4});
  await a.screenshotReady();
 });
 for (const mode of ['baseline','double-side','no-mask','no-shadow','neutral']) {
  await s.page.evaluate(async mode => {
   const game = (window.__SCENE__ as unknown as {game: import('../../src/Game').Game}).game;
   game.view.scene.traverse(node => {
    if (node.parent?.name !== 'infected-crowd' || !('material' in node)) return;
    const mesh = node as import('three').Mesh, m = mesh.material as import('../../src/render/PaletteMaterial').PaletteMaterial;
    if (mode === 'double-side') m.side=2;
    if (mode === 'no-mask') m.maskNode=null;
    if (mode === 'no-shadow') mesh.receiveShadow=false;
    if (mode === 'neutral') { m.outputNode=null; m.color.set('#dddddd'); }
    m.needsUpdate=true;
   });
   await window.__SS__!.screenshotReady();
  },mode);
  await s.page.locator('canvas').screenshot({path:`${out}/${mode}.png`});
 }
 console.log(s.errors);
} finally { await s.close(); stopServer(); }
