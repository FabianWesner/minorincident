import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { Game } from '../../../src/Game';
import { boot, expect, test } from '../fixtures';

const output='test-results/objective-clarity/browser';
test.use({trace:'off'});
async function start(page:Page,quality:'high'|'low',level:'L1'|'L3'|'L5'|'L6'|'L7'|'L10'){
  await boot(page,`/?test=1&scenelab=1&renderer=webgl&quality=${quality}&dpr=1&audio=muted&ui=1`);
  await page.evaluate(async ({level,quality})=>{
    const a=window.__SS__!;await a.loadLevel(level,{seed:1,progression:level==='L1'?undefined:`${level}-default` as NonNullable<Parameters<typeof a.loadLevel>[1]>['progression']});a.pause();a.missions.begin();a.cheats.god(true);a.settings.set({quality});
  },{level,quality});
}
async function capture(page:Page,name:string,zoom:number){
  mkdirSync(output,{recursive:true});
  await page.evaluate(async zoom=>{
    await window.__SS__!.screenshotReady();window.__SS__!.pause();
    const g=(window.__SCENE__ as unknown as {game:Game}).game;
    g.view.view.zoom(Math.log(zoom/g.view.view.playerZoom),true);g.view.view.update(g.world.entities.get(1)!.transform,0);g.view.update(1);await window.__SS__!.screenshotReady();
  },zoom);
  const metadata=await page.evaluate(()=>{const g=(window.__SCENE__ as unknown as {game:Game}).game,w=g.world,m=w.missions!,s=m.state;const names=[...(s.marker?[s.marker]:[]),...(s.l5&&(s.l5.phase==='search'||s.l5.phase==='metro')?s.l5.survivors.filter(r=>r.status==='hidden').map(r=>`l5-ring-${r.key}`):[])];return {scenario:w.scenario,tick:w.tick,player:w.entities.get(1)!.transform,render:window.__SS__!.getState().render,hud:document.querySelector('[data-testid="objective-text"]')?.textContent,rings:names.map(name=>{const a=m.def.anchors[name],y=w.districts!.groundHeight(a.x,a.z),ndc=window.__SS__!.camera.project(a.x,y+.08,a.z);return {name,...a,y,screen:[(ndc[0]+1)*800,(1-ndc[1])*450]};})};});
  writeFileSync(`${output}/${name}-z${zoom}.json`,JSON.stringify(metadata,null,2));
  expect(await page.evaluate(()=>window.__SS__!.getState().render.camera.zoom)).toBeCloseTo(zoom,2);
  if(!metadata.render.camera.spot)expect(metadata.render.camera.radius).toBeCloseTo(19*zoom,2);
  await page.screenshot({path:`${output}/${name}-z${zoom}.jpg`,type:'jpeg',quality:90});
}
async function clickGround(page:Page,x:number,z:number){const p=await page.evaluate(({x,z})=>window.__SS__!.input.project({x,z}),{x,z});await page.mouse.click(p.x,p.y);}
for(const quality of ['high','low'] as const){
  test(`PO 10-21 #1 first service gate with real input, ${quality}`,async({page})=>{
    test.setTimeout(240_000);await start(page,quality,'L6');
    await page.evaluate(async()=>{
      const a=window.__SS__!,w=(window.__SCENE__ as unknown as {game:Game}).game.world;
      a.cheats.completeObjective('shelter');a.cheats.completeObjective('stop');a.cheats.killAll();
      const s=w.missions!.state.l6!;s.leaderX=89;s.leaderZ=15;s.nextWave=1e9;s.entries=[];
      // Two living stragglers, the reported case; the rest have already exited.
      for(const r of s.survivors.slice(2)){r.status='out';w.entities.get(r.id)!.hidden=true;w.spatial.delete(r.id);}
      s.survivors.slice(0,2).forEach((r,i)=>{r.injured=false;a.teleport(r.id,{x:86,z:14.5+i});});
      a.teleport(1,{x:88.5,z:15});a.camera.follow();await a.step(1);
    });
    await expect(page.getByTestId('objective-text')).toContainText('0/2 through');
    const ring=await page.evaluate(()=>({...((window.__SCENE__ as unknown as {game:Game}).game.world.missions!.def.anchors['l6-next'])}));
    expect(ring.x).toBeCloseTo(92.4);expect(ring.z).toBeCloseTo(17.3);
    await capture(page,`${quality}-l6-gate`,1);await capture(page,`${quality}-l6-gate`,1.5);
    await clickGround(page,ring.x,ring.z);
    let crossed=false;
    const trace=[];
    for(let i=0;i<100;i++){
      await page.evaluate(()=>window.__SS__!.step(12));
      const row=await page.evaluate(()=>{const w=(window.__SCENE__ as unknown as {game:Game}).game.world,s=w.missions!.state.l6!;return {tick:w.tick,p:w.entities.get(1)!.transform,group:s.survivors.slice(0,2).map(r=>w.entities.get(r.id)!.transform),hud:document.querySelector('[data-testid="objective-text"]')?.textContent};});trace.push(row);
      if(row.group.every(p=>p.x>92)&&Math.hypot(row.p.x-ring.x,row.p.z-ring.z)<.4){crossed=true;break;}
    }
    writeFileSync(`${output}/${quality}-l6-input.json`,JSON.stringify(trace,null,2));expect(crossed).toBe(true);
    await page.keyboard.down('e');await page.evaluate(()=>window.__SS__!.step(90));await page.keyboard.up('e');
    expect(await page.evaluate(()=>window.__SS__!.missions.state()!.l6!.gates[0].closedAt)).toBeGreaterThan(0);
    await capture(page,`${quality}-l6-closed`,1.5);
  });
  test(`PO 10-21 #3 Metro approach clicks at all zooms, ${quality}`,async({page})=>{
    test.setTimeout(300_000);await start(page,quality,'L5');
    for(const zoom of [.5,1,1.5]){
      await page.evaluate(async()=>{
        const a=window.__SS__!,w=(window.__SCENE__ as unknown as {game:Game}).game.world;
        await a.loadLevel('L5',{seed:1,progression:'L5-default'});a.pause();a.missions.begin();a.cheats.god(true);a.cheats.completeObjective('emerge');a.cheats.completeObjective('look');a.cheats.killAll();
        const s=w.missions!.state.l5!;
        // Isolate the approach and true arrival trigger; group ingress has its own regression.
        for(const r of s.survivors){r.status='dead';w.entities.get(r.id)!.hidden=true;w.spatial.delete(r.id);}
        a.teleport(1,{x:37.6,z:-45.8});a.camera.follow();await a.step(1);
      });
      await capture(page,`${quality}-l5-metro`,zoom);
      const click=await page.evaluate(()=>{const a=window.__SS__!,w=(window.__SCENE__ as unknown as {game:Game}).game.world,r=w.missions!.def.anchors['l5-metro-in'];return a.input.project(r);});
      await page.mouse.click(click.x,click.y);
      let arrived=false;
      for(let i=0;i<100;i++){
        await page.evaluate(()=>window.__SS__!.step(6));
        if(await page.evaluate(()=>!!window.__SS__!.missions.state()?.l5?.metroAt)){arrived=true;break;}
      }
      expect(arrived,`zoom ${zoom}: a real click enters the actual stair trigger`).toBe(true);
      await expect(page.getByTestId('objective-text')).toContainText('3 s');
      await capture(page,`${quality}-l5-metro-arrived`,zoom);
    }
  });
  test(`PO 10-21 #6 western corridor keeps the group and bus hands it to L8, real input, ${quality}`,async({page})=>{
    test.setTimeout(300_000);await start(page,quality,'L7');
    const ids=await page.evaluate(async()=>{
      const a=window.__SS__!,w=(window.__SCENE__ as unknown as {game:Game}).game.world,c=w.l7Encounters!;
      c.state.started=true;a.cheats.killAll();a.cheats.completeObjective('rocket');
      const near=c.state.roster.slice(0,-1);let placed=0;
      for(let x=-57;x<=-45&&placed<near.length;x++)for(const z of [46.5,47.5,48.5,45.5,49.5]){
        if(placed>=near.length)break;const e=w.entities.get(near[placed].id)!;
        if(w.infected!.nav.clear(x,z,.4)&&w.solids.relocate(e,{x,z,y:.83},'test.corridor.group',0))placed++;
      }
      if(placed!==near.length)throw new Error(`Only ${placed}/${near.length} corridor fixture members placed`);
      const last=w.entities.get(c.state.roster.at(-1)!.id)!;
      if(!w.solids.relocate(last,{x:-78,z:30,y:.83},'test.corridor.tail',2))throw new Error('Corridor tail fixture rejected');
      a.teleport(1,{x:-60,z:50});a.camera.follow();await a.step(1);return c.state.roster.map(r=>r.id);
    });
    expect(await page.evaluate(()=>window.__SS__!.missions.state()!.steps.corridor.status)).toBe('active');
    await expect(page.getByTestId('objective-text')).toContainText('Waiting for');
    await capture(page,`${quality}-l7-corridor`,1);await capture(page,`${quality}-l7-corridor`,1.5);
    await clickGround(page,-68,50);
    let completed=false,busCaptured=false;
    for(let i=0;i<150;i++){await page.evaluate(()=>window.__SS__!.step(12));if(await page.evaluate(()=>window.__SS__!.missions.state()!.steps.corridor.status==='completed')){completed=true;if(await page.evaluate(()=>window.__SS__!.getState().l7Departure?.phase==='boarding')){await capture(page,`${quality}-l7-bus`,1);await capture(page,`${quality}-l7-bus`,1.5);busCaptured=true;}break;}}
    expect(completed).toBe(true);
    await clickGround(page,-70.5,47.5);
    let departed=false;
    for(let i=0;i<400;i++){
      await page.evaluate(()=>window.__SS__!.step(12));
      const s=await page.evaluate(()=>window.__SS__!.getState());
      if(s.l7Departure?.phase==='boarding'&&!busCaptured){await capture(page,`${quality}-l7-bus`,1);await capture(page,`${quality}-l7-bus`,1.5);busCaptured=true;}
      if(s.scenario==='L8'||s.l7Departure?.phase==='departing'){departed=true;break;}
    }
    expect(departed).toBe(true);expect(busCaptured).toBe(true);
    expect(await page.evaluate(()=>window.__SS__!.getState().l7Departure?.boarded.length)).toBe(ids.length);
    await page.evaluate(()=>window.__SS__!.step(550));await page.waitForFunction(()=>window.__SS__!.getState().scenario==='L8');
    const carried=await page.evaluate(()=>(window.__SCENE__ as unknown as {game:Game}).game.world.missions!.l8!.state.roster);
    expect([...carried].sort((a,b)=>a-b)).toEqual([...ids].sort((a,b)=>a-b));
    writeFileSync(`${output}/${quality}-l7-handover.json`,JSON.stringify({quality,incoming:ids,carried},null,2));
    await capture(page,`${quality}-l7-handover`,1.5);
    // A separate capture fixture shows the APC objective at its actual vehicle door.
    await page.evaluate(async()=>{const a=window.__SS__!,w=(window.__SCENE__ as unknown as {game:Game}).game.world;a.pause();a.cheats.god(true);if(w.missions!.state.phase==='briefing')a.missions.begin();w.missions!.l8!.advance();const d=w.missions!.l8!.door();a.teleport(1,{x:d.x+3,z:d.z+3});a.camera.follow();await a.step(1);});
    await capture(page,`${quality}-l8-apc`,1);await capture(page,`${quality}-l8-apc`,1.5);
  });
}

test('PO 10-21 #2 a click on the fire bay ring ignores bodies; #9 raised diamond follows ground',async({page})=>{
  test.setTimeout(240_000);await start(page,'high','L1');
  await page.evaluate(async()=>{
    const a=window.__SS__!,w=(window.__SCENE__ as unknown as {game:Game}).game.world;
    a.cheats.completeObjective('pickup');a.cheats.completeObjective('deliver');a.cheats.completeObjective('escape');a.cheats.completeObjective('weapon');a.cheats.killAll();
    const r=w.missions!.def.anchors['fire-bay-trigger'];a.teleport(1,{x:r.x,z:r.z+2});
    const id=a.spawn('infected.runner',{x:r.x,z:r.z});const e=w.entities.get(id)!;e.health.current=0;e.infected!.recoverAt=w.tick+6000;
    a.camera.follow();await a.step(1);
  });
  await capture(page,'high-l1-fire-bay',1);await capture(page,'high-l1-fire-bay',1.5);
  const p=await page.evaluate(()=>{const w=(window.__SCENE__ as unknown as {game:Game}).game.world,r=w.missions!.def.anchors['fire-bay-trigger'];return window.__SS__!.input.project(r);});
  const picked=await page.evaluate(p=>{const g=(window.__SCENE__ as unknown as {game:Game}).game;return g.input.picker.pick(p.x,p.y,g.world.entities.iterate())?.id;},p);
  expect(picked,'the body would normally swallow this ring click').toBeDefined();
  await page.mouse.click(p.x,p.y);await page.evaluate(()=>window.__SS__!.step(1));
  expect(await page.evaluate(()=>(window.__SCENE__ as unknown as {game:Game}).game.input.frame.attackTarget)).toBeUndefined();
  expect(await page.evaluate(()=>(window.__SCENE__ as unknown as {game:Game}).game.input.frame.moveTarget)).toBeDefined();
  await page.evaluate(async()=>{
    const a=window.__SS__!;await a.loadLevel('L6',{seed:1,progression:'L6-default'});a.pause();a.missions.begin();a.cheats.completeObjective('shelter');a.cheats.completeObjective('stop');a.cheats.completeObjective('retreat');const w=(window.__SCENE__ as unknown as {game:Game}).game.world;w.missions!.state.l6!.survivors.forEach((r,i)=>{if(i===0){r.status='following';a.teleport(r.id,{x:260,z:15});}else{r.status='out';w.entities.get(r.id)!.hidden=true;}});a.teleport(1,{x:270,z:15});a.camera.follow();await a.step(1);
  });
  const heights=await page.evaluate(()=>{
    const g=(window.__SCENE__ as unknown as {game:Game}).game,w=g.world,r=w.missions!.def.anchors['night-exit'];
    g.view.refreshMissionUI();
    const expected=window.__SS__!.camera.project(r.x,w.districts!.groundHeight(r.x,r.z)+1.8,r.z);
    const marker=document.querySelector('[data-testid="mission-marker"]') as HTMLElement;
    return {expected,actual:[parseFloat(marker.style.left),parseFloat(marker.style.top)],ground:w.districts!.groundHeight(r.x,r.z)};
  });
  expect(heights.ground).toBeCloseTo(3.9);expect(heights.actual[0]).toBeCloseTo((heights.expected[0]+1)*800,0);expect(heights.actual[1]).toBeCloseTo((1-heights.expected[1])*450,0);
  await capture(page,'high-l6-raised-diamond',1);await capture(page,'high-l6-raised-diamond',1.5);
});

for(const quality of ['high','low'] as const)test(`PO 10-21 #4 #5 research and all search rings at gameplay zooms, ${quality}`,async({page})=>{
  test.setTimeout(300_000);await start(page,quality,'L5');
  await page.evaluate(async()=>{const a=window.__SS__!;a.cheats.completeObjective('emerge');a.cheats.killAll();await a.step(661);});
  for(const key of ['dale','rosa','okafor','mia','sam']){
    const distance=await page.evaluate(async key=>{const a=window.__SS__!,w=(window.__SCENE__ as unknown as {game:Game}).game.world,r=w.missions!.def.anchors[`l5-ring-${key}`];a.teleport(1,{x:r.x+2,z:r.z+(key==='dale'?-3:3)});a.camera.follow();await a.step(1);const p=w.entities.get(1)!.transform;return Math.hypot(p.x-r.x,p.z-r.z);},key);
    expect(distance,`${key} capture fixture reaches the search spot`).toBeLessThan(5);
    await capture(page,`${quality}-l5-search-${key}`,1);await capture(page,`${quality}-l5-search-${key}`,1.5);
  }
  await page.evaluate(async()=>{
    const a=window.__SS__!;await a.loadLevel('L10',{seed:1,progression:'L10-default'});a.pause();a.missions.begin();a.cheats.god(true);
    for(const id of ['crash','residential-fringe','industrial-area','military-zone','research-campus'])a.cheats.completeObjective(id);
    a.teleport(1,{x:2707,z:45});a.camera.follow();await a.step(1);
  });
  await capture(page,`${quality}-l10-research`,1);await capture(page,`${quality}-l10-research`,1.5);
  await clickGround(page,2707,41.5);
  for(let i=0;i<100;i++){await page.evaluate(()=>window.__SS__!.step(6));if(await page.evaluate(()=>window.__SS__!.missions.state()!.steps.research.status==='completed'))break;}
  expect(await page.evaluate(()=>window.__SS__!.missions.state()!.steps.research.status)).toBe('completed');
});

test('PO 10-21 #7 L3 tracker distance is to the fixed army objective in both HUDs',async({page})=>{
  test.setTimeout(180_000);await start(page,'high','L3');
  await page.evaluate(async()=>{const a=window.__SS__!;a.cheats.completeObjective('armory');await a.step(310);a.cheats.completeObjective('defend');await a.step(10);});
  const d=await page.evaluate(()=>{const w=(window.__SCENE__ as unknown as {game:Game}).game.world,p=w.entities.get(1)!.transform,a=w.missions!.def.anchors['l3-zone'];return Math.hypot(a.x-p.x,a.z-p.z);});
  expect(d).toBeGreaterThan(300);
  await expect(page.getByTestId('objective-text')).toContainText(`${Math.round(d)}\u00a0m`);
  expect(Number(await page.getByTestId('mission-tracker').getAttribute('data-distance'))).toBeCloseTo(d,2);
});
