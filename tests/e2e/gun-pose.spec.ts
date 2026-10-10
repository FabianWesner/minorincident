import { test, expect } from './fixtures';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = 'test-results/gun-pose-render';
const distance = (a: number[], b: number[]) => Math.hypot(...a.map((v,i)=>v-b[i]));
for (const walking of [false,true]) {
  test(`@gun-pose courier and every NPC gun muzzle match the rendered tracer (${walking ? 'walking' : 'standing'})`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto('/?test=1&scenelab=1&renderer=webgl&audio=muted&profile=1');
    await page.waitForFunction(() => !!window.__SCENE__ && !!window.__SS__);
    await page.evaluate(async()=>{await window.__SS__!.ready;window.__SS__!.pause();});
    const cases = [
      {kind:'courier',model:'female',weapon:'handgun'},
      {kind:'pedestrian',model:'npc.police-officer',weapon:'pistol'},
      {kind:'pedestrian',model:'npc.national-guard',weapon:'rifle'},
      {kind:'pedestrian',model:'npc.national-guard',weapon:'hmg'},
      {kind:'pedestrian',model:'npc.civilian-man-a',weapon:'pistol'},
      {kind:'pedestrian',model:'npc.civilian-woman-a',weapon:'hunting-rifle'},
    ] as const;
    const results = [];
    for (const c of cases) {
      const courier = c.kind === 'courier';
      const spec: SceneSpec = { name:`gun-${c.weapon}`,ground:'asphalt',size:40,camera:{mode:'game',target:[1,0],zoom:1.8},actors:[
        {id:'shooter',kind:c.kind,at:[0,0],look:{model:c.model,handProp:courier?undefined:c.weapon==='hmg'?'rifle':c.weapon},...(courier?{loadout:['weapon.handgun','weapon.fists'] as [string,string]}:walking?{}:{state:{ally:{role:c.model.includes('police')?'officer':c.model.includes('guard')?'soldier':'civilian',weapon:c.weapon as 'pistol'|'rifle'|'hmg'|'hunting-rifle'}}})},
        {id:'target',kind:'infected',archetype:'infected.dummy',at:[7,0],state:'idle'},
      ]};
      await page.evaluate(s=>window.__SCENE__!.load(s),spec);
      await page.evaluate(async ({courier,walking})=>{
        const lab=window.__SCENE__!,a=window.__SS__!;
        if(courier){lab.command('shooter',{attack:'target',seconds:2,...(walking?{move:[0,1] as [number,number]}:{})});if(walking)await lab.step(20);}
        else if(walking)lab.command('shooter',{walk:[[0,0],[0,4]]});
        // NPC walking uses the production event bus probe at the real walking rig pose.
        if(!courier && walking){await lab.step(20);const id=lab.actors.get('shooter')!.entity;a.audio.emit({type:'ally.attack',tick:a.tick(),sourceId:id,targetId:lab.actors.get('target')!.entity,role:'soldier',from:{x:0,z:0},to:{x:7,z:0}});}
      },{courier,walking});
      const probes = await page.evaluate(async ({courier,walking})=>{
        const lab=window.__SCENE__!,a=window.__SS__!,id=lab.actors.get('shooter')!.entity;
        for(let frame=0;frame<120;frame++){
          const state=a.getState(),shot=state.render.vfx?.shots.at(-1);
          if(shot?.sourceId===id && shot.tick===a.tick()){
            const muzzle=courier?state.render.actions!.attachments.find(h=>h.visible&&!h.holstered)?.muzzle:state.render.npcs!.civilians.muzzles.find(m=>m.id===id)?.position;
            const joints=courier?state.render.character!.gunPose:state.render.npcs!.civilians.figures.find(f=>f.id===id)?.joints;
            const clipping=await lab.clipping();
            return {shot,muzzle,joints,clipping,speed:state.entities.find(e=>e.id===id)?.motion?.speed??Math.hypot(state.entities.find(e=>e.id===id)?.survivor?.velocity.x??0,state.entities.find(e=>e.id===id)?.survivor?.velocity.z??0),walking};
          }
          await lab.step(1);
        }
        throw new Error('No shot from shooter');
      },{courier,walking});
      if(walking) expect(probes.speed,c.weapon+' walking speed').toBeGreaterThan(.5);
      expect(probes.muzzle,c.weapon).toBeTruthy();
      expect(distance(probes.shot.tracerStart,probes.muzzle!),c.weapon).toBeLessThan(.05);
      expect(probes.clipping.summary.gunBodyHits).toBe(0);expect(probes.clipping.summary.actorHits).toBe(0);expect(probes.clipping.summary.staticPairs).toBe(0);
      const joints=probes.joints!;
      expect(Math.abs(joints.handR[1]-joints.armR[1])).toBeLessThan(.15);
      const v=joints.handR.map((n,i)=>n-joints.foreArmR[i]),d=probes.shot.end.map((n,i)=>n-probes.shot.muzzle[i]);
      const dot=v.reduce((s,n,i)=>s+n*d[i],0)/(Math.hypot(...v)*Math.hypot(...d));
      expect(Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI).toBeLessThan(15);
      results.push({case:c,...probes});
      mkdirSync(out,{recursive:true});await page.screenshot({path:`${out}/${c.model}-${c.weapon}-${walking?'walking':'standing'}.png`});
    }
    writeFileSync(`${out}/metrics-${walking?'walking':'standing'}.json`,JSON.stringify(results,null,2));
  });
}

test('@gun-pose equipped handgun has no permanent cyan or yellow line at idle',async({page})=>{
  await page.goto('/?test=1&scenelab=1&renderer=webgl&audio=muted');
  await page.waitForFunction(()=>!!window.__SCENE__&&!!window.__SS__);
  await page.evaluate(async()=>{await window.__SS__!.ready;window.__SS__!.pause();await window.__SCENE__!.load({ground:'asphalt',actors:[{id:'courier',kind:'courier',at:[0,0],loadout:['weapon.handgun','weapon.fists']}],camera:{mode:'game',target:[0,0],zoom:1.8}});});
  for(const side of ['LEFT','RIGHT'] as const){
    const vertices=await page.evaluate(async(side)=>{const a=window.__SS__!;a.setLoadout(['weapon.handgun'],['weapon.handgun']);window.__SCENE__!.command('courier',{select:side});await window.__SCENE__!.step(30);return a.getState().render.actions!.indicator.vertices;},side);
    expect(vertices).toBe(0);
  }
  mkdirSync(out,{recursive:true});await page.screenshot({path:`${out}/idle.png`});
});

test('@gun-pose short muzzle aim cue stops at a fence and fades after the shot',async({page})=>{
  test.setTimeout(120_000);
  await page.goto('/?test=1&scenelab=1&renderer=webgl&audio=muted');
  await page.waitForFunction(()=>!!window.__SCENE__&&!!window.__SS__);
  const samples=await page.evaluate(async()=>{
    const a=window.__SS__!,lab=window.__SCENE__!;await a.ready;a.pause();
    await lab.load({ground:'asphalt',actors:[{id:'courier',kind:'courier',at:[0,0],loadout:['weapon.handgun','weapon.fists']},{id:'target',kind:'infected',at:[7,0],state:'idle'}],props:[{id:'fence',asset:'prop.picket-fence',at:[2.5,0],yaw:0}],camera:{mode:'game',target:[1,0],zoom:1.8}});
    const fire=async()=>{a.input.set({aim:{x:1,z:0},left:{down:true,held:false,up:false}});await a.step(1);a.input.clear();};
    await fire();const active=a.getState().render.actions!.aimCue;
    await a.step(12);const fading=a.getState().render.actions!.aimCue;
    await a.step(14);const idle=a.getState().render.actions!.aimCue;
    return {active,fading,idle};
  });
  expect(samples.active).toBeTruthy();expect(samples.active!.range).toBeLessThanOrEqual(4);
  expect(samples.active!.origin[0]+samples.active!.range).toBeLessThan(2.6);
  expect(samples.fading!.opacity).toBeLessThan(samples.active!.opacity);expect(samples.idle).toBeNull();
});

test('@gun-pose army nest fires from its rotating authored HMG muzzle socket',async({page})=>{
  test.setTimeout(180_000);
  await page.goto('/?test=1&scenelab=1&renderer=webgl&audio=muted');
  await page.waitForFunction(()=>!!window.__SCENE__&&!!window.__SS__);
  const result=await page.evaluate(async()=>{
    const a=window.__SS__!,lab=window.__SCENE__!;await a.ready;a.pause();
    await lab.load({ground:'asphalt',actors:[{id:'gunner',kind:'pedestrian',at:[-.45,0],look:{model:'npc.national-guard',handProp:'rifle'},state:{ally:{role:'soldier',weapon:'hmg'}}},{id:'target',kind:'infected',at:[7,3],state:'idle'}],props:[{id:'nest',asset:'prop.hmg-nest',at:[0,0]}],camera:{mode:'game',target:[1,0],zoom:1.8}});
    for(let i=0;i<120;i++){
      await lab.step(1);const state=a.getState(),shot=state.render.vfx!.shots.at(-1);
      if(shot?.tick===a.tick())return {shot,nest:state.render.machineGuns[0]};
    }
    throw new Error('HMG did not fire');
  });
  expect(result.nest).toBeTruthy();expect(distance(result.shot.tracerStart,result.nest.muzzle)).toBeLessThan(.05);
  mkdirSync(out,{recursive:true});await page.screenshot({path:`${out}/army-hmg-nest.png`});
});
