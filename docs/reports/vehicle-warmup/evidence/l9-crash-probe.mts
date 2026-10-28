import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../../../../tools/scenelab/session.ts';
import type { Game } from '../../../../src/Game.ts';
const session = new SceneSession({ backend: 'webgpu', tier: 'low', query: { loadProfile: '2' }, viewport: { width: 1600, height: 900 } });
try {
 await session.open(); await session.page.evaluate('globalThis.__name = fn => fn');
 const proof = await session.page.evaluate(async () => {
  const a=window.__SS__!, g=(window.__SCENE__ as unknown as {game:Game}).game;
  await a.loadLevel('L9',{seed:1}); a.pause(); a.missions.begin(); a.cheats.god(true);
  const before={...a.perf().nodeBuildMaterials}, w=g.world, id=w.missions!.l9!.state.carId, anchor=w.missions!.def.anchors['crash-approach'];
  w.vehicles!.scriptPose(id,{x:anchor.x,y:w.entities.get(id)!.transform.y,z:anchor.z,yaw:0});
  a.resume(); await new Promise(r=>setTimeout(r,6500)); a.pause();
  const after={...a.perf().nodeBuildMaterials};
  return {before,after,state:a.getState().l9,vehicle:a.getEntity(id)!.vehicle,lateSubjectBuilds:Object.entries(after).filter(([key,n])=>n!==before[key]&&/^(vehicle:|character:|action-held:)/.test(key))};
 });
 writeFileSync('test-results/vehicle-warmup/L9-crash.json',JSON.stringify({...proof,errors:session.errors},null,2));
 console.log(JSON.stringify({phase:proof.state?.phase,decay:proof.vehicle?.decay,lateSubjectBuilds:proof.lateSubjectBuilds,errors:session.errors}));
 assert.equal(proof.vehicle?.decay,'wrecked'); assert.deepEqual(proof.lateSubjectBuilds,[]); assert.deepEqual(session.errors,[]);
} finally {await session.close();stopServer();}
