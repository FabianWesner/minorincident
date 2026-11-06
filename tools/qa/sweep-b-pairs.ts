/** Matched authored L4/L5 cameras; a PO prompt remains separate from numeric sunset. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { l4PhotoSpots } from '../../src/data/l4';
import type { Game } from '../../src/Game';
import { preset } from '../../src/sim/progression/Campaign';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
const out = 'test-results/sweep-b/pairs'; mkdirSync(`${out}/captures`, { recursive: true });
const rows = [];
try {
 for (const tier of ['low','high'] as const) {
  const session = new SceneSession({ tier, backend: 'webgl2', query: { profile:'0', ui:'1' } });
  try {
   await session.open();
   for (const level of ['L4','L5'] as const) {
    const save = preset(`${level}-default`); save.settings.quality=tier;
    await session.page.evaluate(async ({save,level,tier}) => {
     const a=window.__SS__!;a.settings.set({quality:tier});a.campaign.restore(save);await a.loadLevel(level,{seed:1});a.pause();a.missions.begin();a.cheats.god(false);
     a.cheats.completeObjective(level==='L4'?'ride':'emerge');await a.step(level==='L4'?30:660);
    },{save,level,tier});
    for (const spot of ['pair-plaza','pair-harbor-street','pair-metro-entrance','pair-kessler-lane']) {
     const offset=l4PhotoSpots.find(p=>p[0]===spot)![1];
     await session.page.evaluate(async ({spot,offset}) => {const a=window.__SS__!;const w=(window.__SCENE__ as unknown as {game:Game}).game.world,d=w.districts!.districts[0],p=d.layout.anchors[spot].position;a.teleport(1,{x:p[0]+d.origin[0],z:p[2]+d.origin[1]});a.camera.cinematic({position:[p[0]+d.origin[0]+offset[0],p[1]+offset[1],p[2]+d.origin[1]+offset[2]],target:[p[0]+d.origin[0],p[1],p[2]+d.origin[1]]},true);await a.step(0);await a.screenshotReady();},{spot,offset});
     const s=await session.page.evaluate(()=>{const a=window.__SS__!,s=a.getState();return {camera:s.render.camera,renderTier:s.render.quality,lighting:s.render.lighting?{preset:s.render.lighting.preset,intensity:s.render.lighting.intensity}:null};});
     const file=`${out}/captures/${tier}-${spot}-${level}.jpg`;await session.page.screenshot({path:file,type:'jpeg',quality:90});rows.push({tier,level,spot,file,...s});
    }
   }
  }finally{await session.close();}
 }
}finally{stopServer();writeFileSync(`${out}/proof.json`,JSON.stringify({...provenance(),producerSha256:createHash('sha256').update(readFileSync('tools/qa/sweep-b-pairs.ts')).digest('hex'),method:'Explicit controlled matched-camera supplement: production progressed L4 calm reception and L5 emergence, existing authored pair offsets applied as explicit cinematic poses (named runtime preset lookup is unavailable), same1280x720 viewport and tier. Teleports only select photo anchors; no route or caption-only discovery claim, no performance timing.',rows},null,2)+'\n');}
