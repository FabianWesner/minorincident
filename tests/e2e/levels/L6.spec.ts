import { PNG } from 'pngjs';
import { LevelSixSubway } from '../../../src/sim/missions/LevelSixSubway';
import { l7Exit } from '../../../src/levels/L7/layout';
import { compareWeapons } from '../../../src/data/weaponOrder';
import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot, testUrl } from '../fixtures';
const out='test-results/epics/E24';
test('T-E24-18 @E24 @E24-AC18 shelter and emergency photo spots render the shipped adults and lights',async({page})=>{
  test.setTimeout(600_000);mkdirSync(out,{recursive:true});
  await boot(page,`${testUrl}&ui=1&scenelab=1`);await page.evaluate(()=>window.__SS__!.loadLevel('L6',{seed:1,progression:'L6-default'}));await page.getByRole('button',{name:'Begin mission'}).click();await page.evaluate(()=>window.__SS__!.pause());
  for(const [name,ticks]of [['l6-shelter-calm',60],['l6-first-breach',34*60],['l6-shelter-fails',23*60]] as const){
    await page.evaluate(n=>window.__SS__!.step(n),ticks);await page.evaluate(async name=>{const a=window.__SS__!;a.camera.preset(`D-SUBWAY/W0/${name}`);await a.screenshotReady();},name);
    await page.screenshot({path:`${out}/${name}.png`});
    writeFileSync(`${out}/${name}.json`,JSON.stringify(await page.evaluate(()=>({mission:window.__SS__!.missions.state(),perf:window.__SS__!.perf()})),null,2));
  }
  const s=await page.evaluate(()=>window.__SS__!.missions.state()!.l6!);expect(s.emergency).toBe(true);expect(s.survivors.length).toBe(29);
});
test('T-E28-L6 @E28 @E28-AC01 @E24 @E24-AC14 actual Northgate exit changes underground haze to ground fog and night',async({page})=>{
  test.setTimeout(300_000);mkdirSync(out,{recursive:true});await boot(page);
  await page.evaluate(async()=>{const a=window.__SS__!;await a.loadLevel('L6',{seed:1,progression:'L6-default'});a.pause();a.missions.begin();await a.step(1);});
  expect(await page.evaluate(()=>window.__SS__!.getState().weather!.kind)).toBe('none');
  await page.evaluate(async()=>{const a=window.__SS__!;a.cheats.completeObjective('shelter');a.cheats.completeObjective('stop');a.cheats.completeObjective('retreat');a.teleport(1,{x:268,z:15});await a.step(2);a.camera.preset('D-SUBWAY/W0/l6-exit-night');await a.screenshotReady();});
  const evidence=await page.evaluate(()=>({state:window.__SS__!.getState(),lighting:window.__SS__!.perf().lighting}));writeFileSync(`${out}/exit-weather.json`,JSON.stringify(evidence,null,2));await page.screenshot({path:`${out}/l6-exit-night.png`});expect(evidence.state.weather!.kind).toBe('fog');expect(evidence.state.weather!.rain).toBe(0);expect(evidence.state.weather!.flakes).toBe(0);expect(evidence.lighting!.preset).toBe('L6');expect(evidence.state.player!.transform.y).toBeGreaterThan(4.5);
});
test('T-E24-17 @E24 @E24-AC17 keyboard/mouse only escort to Northgate, E closes a gate and all seven photographs',async({page})=>{
  test.setTimeout(1_200_000);mkdirSync(out,{recursive:true});await boot(page,`${testUrl}&ui=1&scenelab=1`);await page.evaluate(()=>window.__SS__!.loadLevel('L6',{seed:1,progression:'L6-default'}));await page.getByRole('button',{name:'Begin mission'}).click();await page.evaluate(()=>window.__SS__!.pause());
  const shots=new Set<string>(),step=(n:number)=>page.evaluate(n=>window.__SS__!.step(n),n);
  await page.evaluate(()=>{
    const game=(window.__SCENE__ as unknown as {game:import('../../../src/Game').Game})?.game;
    if(!game)return;
    const journal:unknown[]=[];(window as unknown as {l6PlayerEvents:unknown[]}).l6PlayerEvents=journal;
    for(const type of ['player.damaged','player.died'] as const)game.world.events.on(type,event=>journal.push({event,at:{...game.world.entities.get(1)!.transform}}));
  });
  const snap=async(name:string)=>{
    await page.evaluate(async name=>{
      const a=window.__SS__!;a.camera.preset(`D-SUBWAY/W0/${name}`);
      if(name!=='l6-first-breach'&&name!=='l6-shelter-fails')a.vfx.stepRender(.3);
      if(name==='l6-tunnel-retreat'){
        const s=a.missions.state()!.l6!,p=a.getState().player!.transform;
        const front=Math.max(p.x,...s.survivors.filter(r=>r.status==='following').map(r=>a.getEntity(r.id)!.transform.x)),x=(p.x+front)/2;
        const radius=Math.max(32,(front-p.x+7)*.8/(2*Math.tan(25*Math.PI/360)*(innerWidth/innerHeight)));
        a.camera.cinematic({position:[x-radius*.6,.6+radius*.85,15+radius*.809],target:[x,.6,15]},true);
      }
      await a.screenshotReady();
    },name);
    await page.screenshot({path:`${out}/real-${name}.png`});
    const positions=await page.evaluate(()=>{
      const a=window.__SS__!;
      return{tick:a.getState().tick,camera:a.getState().render.camera,player:a.getEntity(1)!.transform,
        followers:a.missions.state()!.l6!.survivors.filter(r=>r.status==='following').map(r=>{
          const e=a.getEntity(r.id)!;
          return{id:r.id,at:e.transform,health:e.health.current,head:a.camera.project(e.transform.x,e.transform.y+1.4,e.transform.z)};
        })};
    });
    writeFileSync(`${out}/real-${name}-positions.json`,JSON.stringify(positions,null,2));
    if(name==='l6-tunnel-retreat')expect(positions.followers.every(r=>Math.abs(r.head[0])<1&&Math.abs(r.head[1])<1&&r.head[2]<1),'all following adults stay inside the retreat photo').toBe(true);
    shots.add(name);await page.evaluate(()=>window.__SS__!.camera.follow());await step(1);
  };
  await step(30);await expect(page.locator('.story-bubble')).toContainText('Keep the wrap tight');await expect(page.locator('.story-bubble')).toBeVisible();await snap('l6-shelter-calm');await step(300);await expect(page.locator('.story-bubble')).toContainText('Please do not leave me behind');
  for(let i=0;i<3500;i++){
    const obs=await page.evaluate(()=>{const a=window.__SS__!,m=a.missions.state()!,s=m.l6!,p=a.getState().player!.transform,all=a.query({}),friends=s.survivors.filter(r=>r.status==='following').map(r=>({...r,at:all.find(e=>e.id===r.id)!.transform})),close=all.filter(e=>e.infected&&e.health.current>0&&!e.hidden&&!e.infectionRise&&Math.hypot(e.transform.x-p.x,e.transform.z-p.z)<2.5).map(e=>e.transform);const enemy=all.filter(e=>e.infected&&e.health.current>0&&!e.hidden&&!e.infectionRise&&a.input.visible(e.transform)&&Math.hypot(e.transform.x-p.x,e.transform.z-p.z)<22).sort((a,b)=>Math.hypot(a.transform.x-p.x,a.transform.z-p.z)-Math.hypot(b.transform.x-p.x,b.transform.z-p.z))[0];const lamp=all.find(e=>e.archetype==='pickup.headlamp'&&e.pickup&&'collected' in e.pickup&&!e.pickup.collected);return{tick:a.getState().tick,m,s,p,rightRack:a.getEntity(1)!.weapons!.RIGHT.rack.map(slot=>slot.id),leftRack:a.getEntity(1)!.weapons!.LEFT.rack.map(slot=>slot.id),lamp:lamp?.transform,friends,input:a.getState().input,controls:a.getState().controls,close,enemy:enemy?{id:enemy.id,at:enemy.transform}:null};});
    if(i%100===0)writeFileSync(`${out}/real-progress.json`,JSON.stringify({i,obs,diagnostic:await page.evaluate(()=>{const a=window.__SS__!;return{stats:a.missions.state()!.stats,plan:a.bot.plan(),attacks:a.events().filter(e=>e.type==='combat.attack'&&e.sourceId===1).slice(-12),hits:a.events().filter(e=>e.type==='combat.hit'&&e.sourceId===1).slice(-12)};})},null,2));
    if(obs.m.phase==='result'){if(obs.p.x>263&&!shots.has('l6-exit-night'))await snap('l6-exit-night');writeFileSync(`${out}/real-input.json`,JSON.stringify({result:obs.m.result,shots:[...shots],state:obs.s},null,2));break;}
    if(obs.s.phase==='first'&&obs.tick>obs.s.breach1At+120&&!shots.has('l6-first-breach'))await snap('l6-first-breach');
    if(obs.s.emergency&&obs.tick>obs.s.breach2At+120&&!shots.has('l6-shelter-fails'))await snap('l6-shelter-fails');
    if(obs.p.x>107&&!shots.has('l6-tunnel-retreat'))await snap('l6-tunnel-retreat');
    if(obs.p.x>130&&!shots.has('l6-straggler'))await snap('l6-straggler');
    if(obs.p.x>143&&!shots.has('l6-chokepoint'))await snap('l6-chokepoint');
    if(obs.p.x>263&&!shots.has('l6-exit-night'))await snap('l6-exit-night');
    if(obs.m.phase==='cinematic'){await step(60);continue;}
    // Reuse the shipping completion policy only to plan: all actions still cross DOM input.
    expect(obs.m.phase).not.toBe('briefing');
    const plan=await page.evaluate(()=>window.__SS__!.bot.plan());
    let move=plan.frame.move;
    if(obs.lamp){
      const dx=obs.lamp.x-obs.p.x,dz=obs.lamp.z-obs.p.z;
      if(Math.hypot(dx,dz)<1.7){await page.keyboard.down('e');await step(24);await page.keyboard.up('e');continue;}
      move={x:dx,z:dz};
    }
    const gate=obs.s.abandonAt>0&&obs.s.gates.find(g=>!g.closedAt&&obs.p.x<g.x+11&&obs.friends.every(r=>r.at.x>g.x+2));
    const closing=gate&&(!plan.target||Math.hypot(plan.target.x-obs.p.x,plan.target.z-obs.p.z)>2.2);
    // The shipped wait/brace point is beside the opening; the old centre-track point is outside its interaction radius.
    const gateAt=gate?LevelSixSubway.gateWait(gate.x):undefined;
    const holdGate=closing&&Math.hypot(gateAt!.x-obs.p.x,gateAt!.z-obs.p.z)<1.2;
    if(closing&&!obs.lamp)move=holdGate?{x:0,z:0}:{x:gateAt!.x-obs.p.x,z:gateAt!.z-obs.p.z};
    const attack=!obs.lamp&&!holdGate&&plan.target&&plan.frame.attackTarget;
    if(attack&&plan.frame.attackTarget!.side==='LEFT'&&Math.hypot(plan.target!.x-obs.p.x,plan.target!.z-obs.p.z)>1.8)move={x:plan.target!.x-obs.p.x,z:plan.target!.z-obs.p.z};
    await page.evaluate(p=>window.__SS__!.camera.cinematic({position:[p.x+24,29,p.z+24],target:[p.x,0,p.z]},true),obs.p);await step(1);
    const screenX=(move.x-move.z)/Math.SQRT2,screenY=(move.x+move.z)/Math.SQRT2,scale=Math.max(Math.abs(screenX),Math.abs(screenY)),keys:string[]=[];
    if(scale>0){if(screenX>scale*.4)keys.push('d');if(screenX<-scale*.4)keys.push('a');if(screenY>scale*.4)keys.push('s');if(screenY<-scale*.4)keys.push('w');}
    if((holdGate||(!closing&&plan.frame.interact))&&!obs.lamp)keys.push('e');
    if(attack){
      // Aim along the same ground-plane ray inside the canvas, even for a distant target.
      // J/K are the shipped attack bindings, so an off-screen target cannot click the HUD.
      const aim=await page.evaluate(at=>{const a=window.__SS__!,p=a.getEntity(1)!.transform;return{from:a.input.project(p,'player'),to:a.input.project(at,'player')};},plan.target!),view=page.viewportSize()!;
      const dx=aim.to.x-aim.from.x,dy=aim.to.y-aim.from.y;
      const t=Math.max(0,Math.min(1,dx>0?(view.width-8-aim.from.x)/dx:dx<0?(8-aim.from.x)/dx:1,dy>0?(view.height-8-aim.from.y)/dy:dy<0?(8-aim.from.y)/dy:1));
      await page.mouse.move(aim.from.x+dx*t,aim.from.y+dy*t);
      const right=plan.frame.attackTarget!.side==='RIGHT',id=right?'weapon.army-mg':'weapon.fire-axe';
      const side:'RIGHT'|'LEFT'=right?'RIGHT':'LEFT';
      const selected=()=>page.evaluate((side:'RIGHT'|'LEFT')=>{const w=window.__SS__!.getEntity(1)!.weapons![side];return w.rack[w.index].id;},side);
      if(await selected()!==id){
        const ids=right?[...obs.rightRack]:[...obs.leftRack,...obs.rightRack].map(id=>id==='weapon.kick'?'weapon.fists':id);
        const slot=ids.sort(compareWeapons).indexOf(id)+1;expect(slot).toBeGreaterThan(0);expect(slot).toBeLessThanOrEqual(3);
        if(right)await page.keyboard.down('Shift');await page.keyboard.press(String(slot));if(right)await page.keyboard.up('Shift');await step(16);
      }
      expect(await selected()).toBe(id);keys.push(right?'k':'j');
    }
    // Preserve the planner's braking near short waypoints when translating its
    // analog movement into physical keys; full-speed six-tick bursts overshoot stairs.
    const movingTicks=Math.max(1,Math.round(6*Math.min(1,Math.hypot(move.x,move.z))));
    for(const key of keys)await page.keyboard.down(key);await step(movingTicks);
    for(const key of keys.filter(key=>['w','a','s','d'].includes(key)))await page.keyboard.up(key);
    if(movingTicks<6)await step(6-movingTicks);
    for(const key of keys)await page.keyboard.up(key);

  }
  const m=await page.evaluate(()=>window.__SS__!.missions.state()!);expect(m.phase).toBe('result');expect(m.l6!.flashlight).toBe(true);await expect(page.getByRole('heading',{name:'Night. Still alive.'})).toBeVisible();await expect(page.getByTestId('result-rescued')).toHaveText(String(m.result!.rescued));await expect(page.getByTestId('result-survivorsIn')).toHaveText(String(m.result!.survivorsIn));await expect(page.getByTestId('mission-detail')).toContainText(`Rescued ${m.result!.rescued}`);await page.screenshot({path:`${out}/real-result.png`});// L6 is no longer the last level (PO 10-11 levels 4-9): the result button continues into L7; credits follow the last level.
  writeFileSync(`${out}/real-player-events.json`,JSON.stringify(await page.evaluate(()=>(window as unknown as {l6PlayerEvents?:unknown[]}).l6PlayerEvents??[]),null,2));
  const carriedArsenal=await page.evaluate(()=>{const w=window.__SS__!.getEntity(1)!.weapons!;return [...w.LEFT.rack,...w.RIGHT.rack].map(s=>s.id).sort();});
  const exitCamera=await page.evaluate(async()=>{const a=window.__SS__!;a.camera.preset('D-SUBWAY/W0/l6-exit-night');await a.screenshotReady();return a.getState().render.camera;});await page.screenshot({path:`${out}/pair-northgate-l6.png`});
  await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>window.__SS__!.getState().scenario==='L7',undefined,{timeout:60_000});
  await page.evaluate(()=>window.__SS__!.screenshotReady());
  const next=await page.evaluate(()=>window.__SS__!.getState());expect(await page.evaluate(()=>window.__SS__!.missions.state()!.checkpoint)).toBe('night-exit');expect(next.l7!.roster.map(r=>r.id).sort((a,b)=>a-b)).toEqual(m.result!.escapedSurvivors!.map(e=>e.id).sort((a,b)=>a-b));expect([...next.player!.weapons!.LEFT.rack,...next.player!.weapons!.RIGHT.rack].map(s=>s.id).sort()).toEqual(carriedArsenal);expect(Math.hypot(next.player!.transform.x-l7Exit.position[0],next.player!.transform.z-l7Exit.position[2])).toBeLessThanOrEqual(1);
  await page.evaluate(async pose=>{const a=window.__SS__!;a.camera.cinematic({position:pose.position as [number,number,number],target:pose.target as [number,number,number]},true);await a.screenshotReady();},exitCamera);
  const nextCamera=await page.evaluate(()=>window.__SS__!.getState().render.camera);expect(nextCamera.position).toEqual(exitCamera.position);expect(nextCamera.target).toEqual(exitCamera.target);await page.screenshot({path:`${out}/pair-northgate-l7.png`});
  writeFileSync(`${out}/real-handover.json`,JSON.stringify({result:m.result,shots:[...shots],scenario:next.scenario,ids:next.l7!.roster.map(r=>r.id),weapons:carriedArsenal},null,2));
  // Keep every gameplay gate strict after recording the complete route and exact L7 carryover.
  expect(shots.size).toBe(7);expect(m.l6!.gates.some(g=>g.closedAt>0)).toBe(true);expect(m.result!.deaths).toBe(0);expect(m.l6!.survivors.some(r=>r.straggler&&r.rejoined)).toBe(true);
  expect(m.result!.rescued/m.result!.survivorsIn!).toBeGreaterThanOrEqual(.6);
});

const lum = (r: number, g: number, b: number) => { const c = (v: number) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * c(r) + .7152 * c(g) + .0722 * c(b); };
const hue = (r: number, g: number, b: number) => { const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min || 1; const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
/** Average colour of a small disc of canvas pixels around an NDC point. */
function patch(png: PNG, ndc: number[], radius = 6) {
  const cx = Math.round((ndc[0] + 1) / 2 * png.width), cy = Math.round((1 - ndc[1]) / 2 * png.height); let r = 0, g = 0, b = 0, n = 0;
  for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++) {
    if (x < 0 || y < 0 || x >= png.width || y >= png.height || Math.hypot(x - cx, y - cy) > radius) continue;
    const i = (y * png.width + x) * 4; r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2]; n++;
  }
  return { r: r / n, g: g / n, b: b / n, l: lum(r / n, g / n, b / n) };
}

for(const [name,spot] of [['l6-shelter-fails',{x:0,z:-4}],['l6-tunnel-retreat',{x:110,z:15}]] as const)test(`T-E24-15 @E24 @E24-AC15 ${name} mask contrast, red eye maxima and flashlight shadow`,async({page})=>{
  test.setTimeout(300_000);mkdirSync(out,{recursive:true});await boot(page,`${testUrl}&scenelab=1`);
  await page.addStyleTag({content:'#hud,.hud,.story-bubble,.mission-subtitle,.mission-hud,.objective-hud{visibility:hidden!important}'});
  const setup=await page.evaluate(async spot=>{
    const a=window.__SS__!;
    await a.loadLevel('L6',{seed:1,progression:'L6-default'});a.pause();a.missions.begin();a.cheats.god(true);
    const lamp=a.query({}).find(e=>e.archetype==='pickup.headlamp')!;a.teleport(1,lamp.transform);a.input.set({interact:true});await a.step(24);a.input.clear();
    a.cheats.completeObjective('shelter');a.cheats.completeObjective('stop');a.teleport(1,spot);
    a.camera.cinematic({position:[spot.x+20,25,spot.z+20],target:[spot.x-3,0,spot.z]},true);
    await a.step(30);
    // Create the readability subjects after stepping: allies must not kill them before sampling.
    const ids=[0,1,2].map(i=>a.spawn('infected.runner',{x:spot.x-7-i*.8,z:spot.z+.6},{state:'idle',yaw:0}));
    // Let <=0.2 s muzzle/tracer particles expire without advancing the paused simulation.
    a.vfx.stepRender(.3);await a.screenshotReady();
    const p=a.getEntity(1)!.transform;
    return{
      aimCue:a.getState().render.actions?.aimCue,
      ring:Array.from({length:8},(_,k)=>a.camera.project(p.x+2*Math.cos(k*Math.PI/4),p.y-.7,p.z+2*Math.sin(k*Math.PI/4))),
      heads:ids.map(id=>{const e=a.getEntity(id)!,t=e.transform;return{alive:e.health.current>0,head:a.camera.project(t.x,t.y+.75,t.z),feet:a.camera.project(t.x,t.y-.7,t.z)};}),
      lighting:a.perf().lighting,
      bars:a.getState().render.healthBars?.bars??[],
    };
  },spot);
  expect(setup.heads.every(head=>head.alive), 'All eye samples belong to living infected').toBe(true);
  expect(setup.aimCue?.opacity??0, 'No foreground aiming cue in the readability sample').toBe(0);
  const image=PNG.sync.read(await page.locator('canvas').screenshot({path:`${out}/${name}-readability.png`}));await page.evaluate(async()=>{window.__SS__!.settings.set({idPass:true});await window.__SS__!.screenshotReady();});const mask=PNG.sync.read(await page.locator('canvas').screenshot({path:`${out}/${name}-mask.png`}));await page.evaluate(async()=>{const game=(window.__SCENE__ as unknown as {game:import('../../../src/Game').Game}).game;window.__SS__!.settings.set({idPass:false});game.view.probeCrowdMask(true);await window.__SS__!.screenshotReady();});const infectedMask=PNG.sync.read(await page.locator('canvas').screenshot({path:`${out}/${name}-infected-mask.png`}));await page.evaluate(()=>(window.__SCENE__ as unknown as {game:import('../../../src/Game').Game}).game.view.probeCrowdMask(false));let sum=0,n=0;
  for(let i=0;i<mask.data.length;i+=4)if(mask.data[i]>240&&mask.data[i+1]<20&&mask.data[i+2]>240){sum+=lum(image.data[i],image.data[i+1],image.data[i+2]);n++;}
  const covered=(p:number[])=>{const i=(Math.round((1-p[1])/2*mask.height)*mask.width+Math.round((p[0]+1)/2*mask.width))*4;return mask.data[i]>240&&mask.data[i+1]<20;};const rings=setup.ring.filter(p=>!covered(p)).map(p=>patch(image,p,5).l),player=sum/n,ring=rings.reduce((a,b)=>a+b,0)/rings.length,contrast=(player+.05)/(ring+.05);
  const eyes=setup.heads.map(({head,feet})=>{const x0=Math.round((head[0]+1)/2*image.width),y0=Math.round((1-head[1])/2*image.height),y1=Math.round((1-feet[1])/2*image.height),half=Math.max(8,Math.round((y1-y0)*.45));let best={l:-1,r:0,g:0,b:0};for(let y=y0-half;y<=y1;y++)for(let x=x0-half;x<=x0+half;x++){if(setup.bars.some(b=>x>=Math.floor(b.x-b.width/2-2)&&x<=Math.ceil(b.x+b.width/2+2)&&y>=Math.floor(b.y-b.height/2-2)&&y<=Math.ceil(b.y+b.height/2+2)))continue;const i=(y*image.width+x)*4;if(infectedMask.data[i]<=240||infectedMask.data[i+1]>=20||infectedMask.data[i+2]<=240)continue;const l=lum(image.data[i],image.data[i+1],image.data[i+2]);if(l>best.l)best={l,r:image.data[i],g:image.data[i+1],b:image.data[i+2]};}return best;});writeFileSync(`${out}/${name}-readability.json`,JSON.stringify({n,player,ring,contrast,eyes,setup},null,2));expect(n).toBeGreaterThan(200);expect(contrast).toBeGreaterThanOrEqual(3);expect(setup.lighting!.heroShadow).toBe(1);for(const e of eyes){expect(e.r-Math.max(e.g,e.b)).toBeGreaterThanOrEqual(60);expect(hue(e.r,e.g,e.b)>=330||hue(e.r,e.g,e.b)<=20).toBe(true);}
});
