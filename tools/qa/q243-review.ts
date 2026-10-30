/** Q243–245 deterministic production L10 bodies and road review, through the shared headless pool. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { regularInfectedModels } from '../../src/data/crowdAppearance';
import type { Game } from '../../src/Game';
const label = process.argv[2] ?? 'before';
const tier = (process.argv[3] ?? 'high') as 'high' | 'low';
const out = `test-results/q243/${label}/${tier}`;
mkdirSync(out, { recursive: true });
const session = new SceneSession({ backend: 'webgpu', tier });
const rows: unknown[] = [];
let initialIds: number[] = [];
try {
  await session.open();
  await session.page.evaluate('globalThis.__name = fn => fn');
  await session.page.evaluate(async tier => {
    const a = window.__SS__!;
    a.settings.set({ quality: tier, cameraShake: false, cheapDof: false });
    await a.loadLevel('L10', { seed: 32, checkpoint: 'cure-crash' });
    a.pause(); a.cheats.god(true); a.camera.follow(); a.debug.figureJoints(false);
  }, tier);
  for (const [name, x, z, bodies] of [['r4',2030,-75,true],['console',4002,-18,true],['road',2290,-75,false]] as const) {
    const setup = await session.page.evaluate(async ({ x,z,bodies,models }) => {
      const a=window.__SS__!, game=(window.__SCENE__ as unknown as {game:Game}).game, w=game.world;
      a.teleport(1,{x,z}); await a.step(2); await a.screenshotReady();
      const warm={...a.perf().nodeBuildMaterials};
      const ids:number[]=[];
      if (bodies) for(let i=0;i<28;i++) {
        const id=a.spawn('infected.runner',{x:x-10+(i%7)*3.3,z:z-8+Math.floor(i/7)*4.5},{variant:models[i%models.length],offNav:true,yaw:i*2.399963});
        const e=w.entities.get(id)!; e.health.current=0;e.infected!.state='dead';e.infected!.deadAt=w.tick-150;e.infected!.recoverAt=-1;w.infected!.settle(e);ids.push(id);
      }
      await a.step(2); await a.screenshotReady();
      const after=a.perf().nodeBuildMaterials;
      const lateCorpseBuilds=Object.entries(after).filter(([key,value])=>key.includes('corpse_')&&value>(warm[key]??0));
      return { ids, count:a.query({}).filter(e=>e.corpse).length,lateCorpseBuilds };
    },{x,z,bodies,models:[...regularInfectedModels]});
    if(name==='r4') initialIds=setup.ids;
    if(label==='after') assert.deepEqual(setup.lateCorpseBuilds,[],`${name}: no corpse shader builds after warm-up`);
    for(const zoom of name==='road'||tier==='low'?[1]:[1,1.5]) {
      await session.page.evaluate(async zoom=>{const a=window.__SS__!;a.camera.zoom(zoom);await a.step(1);await a.screenshotReady();},zoom);
      await session.screenshot(`${out}/${name}-z${zoom}.png`);
      const state=await session.page.evaluate(()=>{
        const a=window.__SS__!,game=(window.__SCENE__ as unknown as {game:Game}).game;
        const materials:unknown[]=[];const seen=new Set();
        game.view.scene.traverse(o=>{const m=o as import('three').InstancedMesh;if(!m.name.startsWith('corpses:')||!m.count)return;const mat=m.material as import('../../src/render/PaletteMaterial').PaletteMaterial;if(seen.has(mat))return;seen.add(mat);materials.push({name:m.name,transparent:mat.transparent,opacity:mat.opacity,fade:mat.fade?.value,fill:mat.figureFill?.value,rim:mat.figureRim?.value});});
        return {camera:game.view.view.getState(),scale:game.view.view.regionScale,corpses:a.query({}).filter(e=>e.corpse).length,builds:{...a.perf().nodeBuildMaterials},materials,draws:a.perf().drawCalls,triangles:a.perf().triangles};
      });
      rows.push({name,zoom,setup,state});
      writeFileSync(`${out}/evidence.json`,JSON.stringify({rows,errors:session.errors},null,2));
      if(label==='before'&&name==='r4'&&zoom===1.5) {
        await session.page.evaluate(()=>window.__SS__!.look.set({version:1,worldLook:{hazeAmount:0,fogNear:300,fogFar:600},palette:{}}));
        await session.screenshot(`${out}/r4-no-fog.png`);
        await session.page.evaluate(()=>window.__SS__!.look.reset());
        await session.page.evaluate(()=>{const game=(window.__SCENE__ as unknown as {game:Game}).game,seen=new Set<import('three').Material>(); game.view.scene.traverse(o=>{const mesh=o as import('three').Mesh;if(!mesh.name.startsWith('corpses:'))return;const m=mesh.material as import('../../src/render/PaletteMaterial').PaletteMaterial;if(seen.has(m))return;seen.add(m);if(m.figureFill){m.userData.savedFill=m.figureFill.value;m.figureFill.value=0;}if(m.figureRim){m.userData.savedRim=m.figureRim.value;m.figureRim.value=0;}});});
        await session.screenshot(`${out}/r4-no-fill.png`);
        await session.page.evaluate(()=>{const game=(window.__SCENE__ as unknown as {game:Game}).game;game.view.scene.traverse(o=>{const mesh=o as import('three').Mesh;if(!mesh.name.startsWith('corpses:'))return;const m=mesh.material as import('../../src/render/PaletteMaterial').PaletteMaterial;if(m.figureFill)m.figureFill.value=m.userData.savedFill;if(m.figureRim)m.figureRim.value=m.userData.savedRim;});});
      }
    }
    console.log(`${label} ${tier} ${name}: ${setup.count} retained bodies`);
  }
  const persisted=await session.page.evaluate(async ids=>{
    const a=window.__SS__!;a.teleport(1,{x:2030,z:-75});await a.step(2);await a.screenshotReady();
    return ids.every(id=>a.getEntity(id)?.corpse===true);
  },initialIds);
  assert.ok(persisted,'R4 corpses persist through streaming away and returning');
  assert.deepEqual(session.errors,[]);
  writeFileSync(`${out}/evidence.json`,JSON.stringify({rows,persisted,errors:session.errors},null,2));
} finally {await session.close();stopServer();}
