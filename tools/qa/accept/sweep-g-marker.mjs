/** G-09 counterexample: an authored hold step remains active without any marker. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SceneSession, stopServer } from '../../scenelab/session.ts';
import { provenance } from './probe.ts';
const out = 'test-results/sweep-g/G-09'; mkdirSync(out, { recursive: true });
const result = { ...provenance(), method: 'Authored L4 turn checkpoint setup (prefix objective skips); actual active hold step observed for180 live simulation ticks at each quality/zoom. No marker/entity writes. Baseline physical full route independently spends190s in this step.', cells: [], errors: [] };
try {
 for (const tier of ['low', 'high']) {
  const session = new SceneSession({ backend: 'webgl2', tier });
  try {
   await session.open(); await session.page.evaluate(async tier => { const api=window.__SS__; await api.loadLevel('L4',{seed:1,checkpoint:'turn'});api.settings.set({quality:tier});api.cheats.god(true);window.__SCENE__.game.ui.show(null);api.pause(); }, tier);
   for (const zoom of [1,1.5]) {
    await session.page.evaluate(zoom=>window.__SS__.camera.zoom(zoom), zoom);
    const samples=[];
    for(let i=0;i<=6;i++) {
     if(i) await session.step(30); await session.ready();
     samples.push(await session.page.evaluate(()=>{ const g=window.__SCENE__.game,m=g.world.missions,s=m.state;const marker=window.__SS__.getState().render.missionMarker;return {tick:g.world.tick, active:m.def.steps.filter(d=>s.steps[d.id].status==='active').map(d=>({id:d.id,waypoint:d.waypoint,anchor:d.anchor})),phase:s.l4.phase,quality:g.quality.snapshot().tier,zoom:window.__SS__.getState().render.camera.zoom,marker,pinVisible:!!document.querySelector('[data-testid="mission-marker"]:not([hidden])')};}));
    }
    const file=`${out}/${tier}-z${zoom}.png`;await session.screenshot(file);result.cells.push({tier,zoom,samples,file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')});
   }
   result.errors.push(...session.errors);
  }finally{await session.close();}
 }
}finally{stopServer();writeFileSync('docs/reports/sweep-g/G-09-marker.json',JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result.cells.map(c=>({tier:c.tier,zoom:c.zoom,active:c.samples[0].active,last:c.samples.at(-1)}))));
