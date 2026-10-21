/** One headless browser at a time, under tools/e2e-lock.sh. Raw matrix cells are temporary. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { alphaLookAssets } from '../../src/data/alphaLooks';
import { regularInfectedModels } from '../../src/data/crowdAppearance';
import type { Game } from '../../src/Game';

const out=process.env.FIXES_OUT??'test-results/fixes-13g-capture';
mkdirSync(out,{recursive:true}); const rows:unknown[]=[];
try {
  for(const backend of (process.env.FIXES_BACKENDS??'webgl2,webgpu').split(',') as ('webgl2'|'webgpu')[]) for(const tier of (process.env.FIXES_TIERS??'low,high').split(',') as ('low'|'high')[]){
    const session=new SceneSession({backend,tier,viewport:{width:1280,height:720}});
    try{
      await session.open(); await session.page.evaluate('globalThis.__name = fn => fn');
      const setup=await session.page.evaluate(async ({alphas,regular,tier})=>{
        const a=window.__SS__!, game=(window.__SCENE__ as unknown as {game:Game}).game;
        await a.loadLevel('L10',{seed:32,checkpoint:'cure-disperse-ready'}); a.pause();a.cheats.god(true);
        a.settings.set({quality:tier,cameraShake:false,cheapDof:false});a.debug.figureJoints(false);
        a.teleport(1,{x:4002,z:-27});
        // Exercise every Alpha appearance through the production permanent-body path.
        for(const e of [...game.world.infected!.active]){e.hidden=true;}
        const ids:number[]=[];
        for(const [i,asset] of [...alphas,...regular].entries()){
          const id=game.world.infected!.spawn(i<alphas.length?'infected.alpha':'infected.runner',{x:3994+i%5*3.8,z:-23+Math.floor(i/5)*3.8},{variant:asset,cureRegion:'dispersal-complex',offNav:true,yaw:i*1.2});
          const e=game.world.entities.get(id)!;e.health.current=0;e.infected!.state='dead';e.infected!.deadAt=game.world.tick-150;e.infected!.recoverAt=-1;
          game.world.infected!.settle(e);ids.push(id);
        }
        for(const [i,coat] of ['', 'black','cream'].entries()){
          const id=game.world.infected!.spawn('infected.dog',{x:3999+i*2,z:-25.5},{variant:`inf.dog${coat?'.'+coat:''}`,offNav:true,yaw:.7});
          const e=game.world.entities.get(id)!;e.health.current=0;e.infected!.state='dead';e.infected!.deadAt=game.world.tick-150;e.infected!.recoverAt=-1;game.world.infected!.settle(e);ids.push(id);
        }
        await a.step(2);await a.screenshotReady();
        return {ids,tick:a.tick(),bodies:a.query({}).filter(e=>e.corpse).map(e=>({id:e.id,asset:e.infected?.variant,at:e.transform}))};
      },{alphas:[...alphaLookAssets],regular:[...regularInfectedModels],tier});
      await session.page.evaluate(()=>window.__SS__!.teleport(1,{x:4002,z:-27}));
      for(const zoom of [.5,1,1.5]){
        const state=await session.page.evaluate(async zoom=>{
          const a=window.__SS__!,game=(window.__SCENE__ as unknown as {game:Game}).game,rig=game.view.view,hero=game.world.entities.get(1)!.transform;
          rig.inspectionPose=null;rig.reset(hero);rig.zoom(Math.log(zoom/rig.getState().targetZoom),true);rig.update(hero,0);await a.step(1);await a.screenshotReady();
          const pages:{name:string;count:number;triangles:number}[]=[];
          game.view.scene.traverse(o=>{const m=o as import('three').InstancedMesh;if(m.name.startsWith('corpses:')&&m.count)pages.push({name:m.name,count:m.count,triangles:(m.geometry.index?.count??0)/3});});
          return {backend:a.perf().backend,tier:a.getState().render.quality,zoom:a.getState().render.camera.zoom,pages,bodies:a.query({}).filter(e=>e.corpse).length};
        },zoom);
        assert.equal(state.bodies,setup.bodies.length);assert.ok(Math.abs(state.zoom-zoom)<.001);
        const name=`${backend}-${tier}-corpses-z${zoom}`;
        await session.page.screenshot({path:`${out}/${name}.jpg`,type:'jpeg',quality:92});rows.push({name,setup,state});writeFileSync(`${out}/evidence.json`,JSON.stringify(rows,null,2));console.log(`${name}: ${state.bodies} retained bodies`);
      }
      if(process.env.FIXES_CORPSES_ONLY==='1') continue;
      await session.page.evaluate(()=>window.__SS__!.teleport(1,{x:4002,z:-27}));
      for(const heroine of ['female','male'] as const){
        await session.page.evaluate(async heroine=>{const a=window.__SS__!;a.survivor.select(heroine,4);a.setLoadout(['weapon.fire-axe'],['weapon.molotov','weapon.pipe-bomb']);await a.step(2);},heroine);
        for(const weapon of ['pipe-bomb','molotov']){
          await session.page.keyboard.press(weapon==='pipe-bomb'?'9':'8');
          await session.page.evaluate(async()=>{await window.__SS__!.step(20);await window.__SS__!.screenshotReady();});
          await session.page.waitForFunction(id=>window.__SS__!.getState().render.actions?.attachments.some(h=>h.visible&&h.actionId===`weapon.${id}`),weapon);
          for(const zoom of [.5,1,1.5]){
            const state=await session.page.evaluate(async zoom=>{
              const a=window.__SS__!,game=(window.__SCENE__ as unknown as {game:Game}).game,rig=game.view.view,hero=game.world.entities.get(1)!.transform;
              rig.inspectionPose=null;rig.reset(hero);rig.zoom(Math.log(zoom/rig.getState().targetZoom),true);rig.update(hero,0);
              await a.step(1);await a.screenshotReady();
              const meshes:{name:string;count:number;triangles:number}[]=[];
              game.view.scene.traverse(o=>{const m=o as import('three').InstancedMesh;if(m.name.startsWith('corpses:')&&m.count)meshes.push({name:m.name,count:m.count,triangles:(m.geometry.index?.count??0)/3});});
              return {backend:a.perf().backend,quality:a.getState().render.quality,camera:a.getState().render.camera,attachments:a.getState().render.actions!.attachments,meshes,bodies:a.query({}).filter(e=>e.corpse).length};
            },zoom);
            assert.equal(state.backend,backend==='webgl2'?'webgl':backend);assert.equal(state.quality,tier);assert.ok(Math.abs(state.camera.zoom-zoom)<.001);
            const held=state.attachments.find(h=>h.visible)!;assert.equal(held.actionId,`weapon.${weapon}`);assert.ok(held.gripDistance<.001);assert.ok(held.handDistance<.05);
            const name=`${backend}-${tier}-${heroine}-${weapon}-z${zoom}`;
            await session.page.screenshot({path:`${out}/${name}.jpg`,type:'jpeg',quality:92});
            rows.push({name,setup,state,errors:session.errors});writeFileSync(`${out}/evidence.json`,JSON.stringify(rows,null,2));console.log(`${name}: ${state.bodies} bodies, grip ${held.gripDistance}`);
          }
        }
      }
      assert.deepEqual(session.errors,[]);
    }finally{await session.close();}
  }
}finally{stopServer();}
