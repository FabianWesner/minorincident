# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/levels/L6.spec.ts >> T-E24-17 @E24 @E24-AC17 keyboard/mouse only escort to Northgate, E closes a gate and all seven photographs
- Location: tests/e2e/levels/L6.spec.ts:22:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic:
      - text: N ▲
      - region "Mission" [ref=e4]:
        - heading "Night. Still alive." [level=1] [ref=e5]
        - paragraph [ref=e6]: Campaign summary · 1 levels · Time 269.9 s · Deaths 0 · Rescued 27
        - generic [ref=e7]:
          - term [ref=e8]: Time (seconds)
          - definition [ref=e9]: "269.92"
          - term [ref=e10]: Knockdowns
          - definition [ref=e11]: "51"
          - term [ref=e12]: Kills
          - definition [ref=e13]: "0"
          - term [ref=e14]: Damage taken
          - definition [ref=e15]: "0"
          - term [ref=e16]: Deaths
          - definition [ref=e17]: "0"
          - term [ref=e18]: Survivors out
          - definition [ref=e19]: "27"
          - term [ref=e20]: Survivors in
          - definition [ref=e21]: "29"
          - term [ref=e22]: Optional objectives
          - definition [ref=e23]: None
        - button "Credits" [active] [ref=e24] [cursor=pointer]
  - text: ⚔ ✦ Ⅱ
```

# Test source

```ts
  1  | import { PNG } from 'pngjs';
  2  | import { mkdirSync, writeFileSync } from 'node:fs';
  3  | import { test, expect, boot, testUrl } from '../fixtures';
  4  | const out='test-results/epics/E24';
  5  | test('T-E24-18 @E24 @E24-AC18 shelter and emergency photo spots render the shipped adults and lights',async({page})=>{
  6  |   test.setTimeout(600_000);mkdirSync(out,{recursive:true});
  7  |   await boot(page,`${testUrl}&ui=1`);await page.evaluate(()=>window.__SS__!.loadLevel('L6',{seed:1,progression:'L6-default'}));await page.getByRole('button',{name:'Begin mission'}).click();await page.evaluate(()=>window.__SS__!.pause());
  8  |   for(const [name,ticks]of [['l6-shelter-calm',60],['l6-first-breach',34*60],['l6-shelter-fails',23*60]] as const){
  9  |     await page.evaluate(n=>window.__SS__!.step(n),ticks);await page.evaluate(async name=>{const a=window.__SS__!;a.camera.preset(`D-SUBWAY/W0/${name}`);await a.screenshotReady();},name);
  10 |     await page.screenshot({path:`${out}/${name}.png`});
  11 |     writeFileSync(`${out}/${name}.json`,JSON.stringify(await page.evaluate(()=>({mission:window.__SS__!.missions.state(),perf:window.__SS__!.perf()})),null,2));
  12 |   }
  13 |   const s=await page.evaluate(()=>window.__SS__!.missions.state()!.l6!);expect(s.emergency).toBe(true);expect(s.survivors.length).toBe(29);
  14 | });
  15 | test('T-E28-L6 @E28 @E28-AC01 @E24 @E24-AC14 actual Northgate exit changes underground haze to ground fog and night',async({page})=>{
  16 |   test.setTimeout(300_000);mkdirSync(out,{recursive:true});await boot(page);
  17 |   await page.evaluate(async()=>{const a=window.__SS__!;await a.loadLevel('L6',{seed:1,progression:'L6-default'});a.pause();a.missions.begin();await a.step(1);});
  18 |   expect(await page.evaluate(()=>window.__SS__!.getState().weather!.kind)).toBe('none');
  19 |   await page.evaluate(async()=>{const a=window.__SS__!;a.cheats.completeObjective('shelter');a.cheats.completeObjective('stop');a.cheats.completeObjective('retreat');a.teleport(1,{x:268,z:15});await a.step(2);a.camera.preset('D-SUBWAY/W0/l6-exit-night');await a.screenshotReady();});
  20 |   const evidence=await page.evaluate(()=>({state:window.__SS__!.getState(),lighting:window.__SS__!.perf().lighting}));writeFileSync(`${out}/exit-weather.json`,JSON.stringify(evidence,null,2));await page.screenshot({path:`${out}/l6-exit-night.png`});expect(evidence.state.weather!.kind).toBe('fog');expect(evidence.state.weather!.rain).toBe(0);expect(evidence.state.weather!.flakes).toBe(0);expect(evidence.lighting!.preset).toBe('L6');expect(evidence.state.player!.transform.y).toBeGreaterThan(4.5);
  21 | });
  22 | test('T-E24-17 @E24 @E24-AC17 keyboard/mouse only escort to Northgate, E closes a gate and all seven photographs',async({page})=>{
  23 |   test.setTimeout(1_200_000);mkdirSync(out,{recursive:true});await boot(page,`${testUrl}&ui=1`);await page.evaluate(()=>window.__SS__!.loadLevel('L6',{seed:1,progression:'L6-default'}));await page.getByRole('button',{name:'Begin mission'}).click();await page.evaluate(()=>window.__SS__!.pause());
  24 |   const shots=new Set<string>(),step=(n:number)=>page.evaluate(n=>window.__SS__!.step(n),n);
  25 |   const snap=async(name:string)=>{await page.evaluate(async name=>{const a=window.__SS__!;a.camera.preset(`D-SUBWAY/W0/${name}`);if(name!=='l6-first-breach'&&name!=='l6-shelter-fails')a.vfx.stepRender(.3);if(name==='l6-tunnel-retreat'){const s=a.missions.state()!.l6!,p=a.getState().player!.transform,front=Math.max(p.x,...s.survivors.filter(r=>r.status==='following').map(r=>a.getEntity(r.id)!.transform.x)),x=(p.x+front)/2;a.camera.cinematic({position:[x+34,40,49],target:[x,.6,15]},true);}await a.screenshotReady();},name);await page.screenshot({path:`${out}/real-${name}.png`});shots.add(name);await page.evaluate(()=>window.__SS__!.camera.follow());await step(1);};
  26 |   await step(30);await expect(page.locator('.story-bubble')).toContainText('Keep the wrap tight');await expect(page.locator('.story-bubble')).toBeVisible();await snap('l6-shelter-calm');await step(300);await expect(page.locator('.story-bubble')).toContainText('Please do not leave me behind');
  27 |   for(let i=0;i<3500;i++){
  28 |     const obs=await page.evaluate(()=>{const a=window.__SS__!,m=a.missions.state()!,s=m.l6!,p=a.getState().player!.transform,all=a.query({}),friends=s.survivors.filter(r=>r.status==='following').map(r=>({...r,at:all.find(e=>e.id===r.id)!.transform})),close=all.filter(e=>e.infected&&e.health.current>0&&!e.hidden&&!e.infectionRise&&Math.hypot(e.transform.x-p.x,e.transform.z-p.z)<2.5).map(e=>e.transform);const enemy=all.filter(e=>e.infected&&e.health.current>0&&!e.hidden&&!e.infectionRise&&a.input.visible(e.transform)&&Math.hypot(e.transform.x-p.x,e.transform.z-p.z)<(['shelter','first','fails'].includes(s.phase)?18:12)).sort((a,b)=>Math.hypot(a.transform.x-p.x,a.transform.z-p.z)-Math.hypot(b.transform.x-p.x,b.transform.z-p.z))[0];return{tick:a.getState().tick,m,s,p,friends,input:a.getState().input,controls:a.getState().controls,close,enemy:enemy?{id:enemy.id,at:enemy.transform}:null};});
  29 |     if(i%100===0)writeFileSync(`${out}/real-progress.json`,JSON.stringify({i,obs},null,2));
  30 |     if(obs.m.phase==='result'){writeFileSync(`${out}/real-input.json`,JSON.stringify({result:obs.m.result,shots:[...shots],state:obs.s},null,2));break;}
  31 |     if(obs.s.phase==='first'&&obs.tick>obs.s.breach1At+120&&!shots.has('l6-first-breach'))await snap('l6-first-breach');
  32 |     if(obs.s.phase==='fails'&&obs.tick>obs.s.breach2At+120&&!shots.has('l6-shelter-fails'))await snap('l6-shelter-fails');
  33 |     if(obs.p.x>107&&!shots.has('l6-tunnel-retreat'))await snap('l6-tunnel-retreat');
  34 |     if(obs.p.x>130&&!shots.has('l6-straggler'))await snap('l6-straggler');
  35 |     if(obs.p.x>143&&!shots.has('l6-chokepoint'))await snap('l6-chokepoint');
  36 |     if(obs.p.x>263&&!shots.has('l6-exit-night'))await snap('l6-exit-night');
  37 |     if(obs.m.phase==='cinematic'){await step(60);continue;}
  38 |     if(obs.close.length<3&&obs.enemy&&(['shelter','first','fails'].includes(obs.s.phase)||i%4!==0)){await page.evaluate(p=>window.__SS__!.camera.cinematic({position:[p.x+24,29,p.z+24],target:[p.x,0,p.z]},true),obs.p);await step(1);const ndc=await page.evaluate(at=>window.__SS__!.camera.project(at.x,at.y,at.z),obs.enemy.at),view=page.viewportSize()!;await page.mouse.move((ndc[0]+1)*view.width/2,(1-ndc[1])*view.height/2);await page.keyboard.down('Shift');await page.keyboard.press('1');await page.keyboard.up('Shift');await step(1);await page.mouse.down();await step(20);await page.mouse.up();continue;}
  39 |     let target={x:obs.s.leaderZ<14?6:Math.max(25,obs.s.leaderX-3),z:15};
  40 |     const lag=obs.friends.filter(r=>r.straggler&&!r.rejoined).sort((a,b)=>a.at.x-b.at.x)[0];
  41 |     if(lag&&!lag.collected)target=lag.at;else if(lag&&obs.p.x-lag.at.x>5){await step(12);continue;}
  42 |     const gate=obs.s.gates.find(g=>!g.closedAt&&obs.p.x<g.x+8&&obs.friends.every(r=>r.at.x>g.x+2));
  43 |     if(gate)target={x:gate.x+1.4,z:15};
  44 |     else if(obs.friends.length&&obs.p.x>Math.min(...obs.friends.map(r=>r.at.x))+6){await step(12);continue;}
  45 |     if(obs.p.x>=246){target={x:273,z:obs.p.x<258?14.1:15};if(obs.p.x<249.1)target={x:250,z:14.1};}
  46 |     if(obs.p.x<25&&obs.p.z<14)target={x:6,z:obs.p.x<5.5?obs.p.z:15};
  47 |     if(['shelter','first','fails'].includes(obs.s.phase))target={x:0,z:4};
  48 |     if(obs.close.length>=3){const cx=obs.close.reduce((n,e)=>n+e.x,0)/obs.close.length,cz=obs.close.reduce((n,e)=>n+e.z,0)/obs.close.length,scale=5/Math.max(.1,Math.hypot(obs.p.x-cx,obs.p.z-cz));target={x:obs.p.x+(obs.p.x-cx)*scale,z:obs.p.z+(obs.p.z-cz)*scale};}
  49 |     const dx=target.x-obs.p.x,dz=target.z-obs.p.z;
  50 |     if(gate&&Math.hypot(dx,dz)<1.2){await page.keyboard.down('e');await step(60);await page.keyboard.up('e');continue;}
  51 |     if(Math.hypot(dx,dz)<1){await step(12);continue;}
  52 |     // Keep the isometric pose stable while physical WASD crosses the authored route.
  53 |     await page.evaluate(p=>window.__SS__!.camera.cinematic({position:[p.x+24,29,p.z+24],target:[p.x,0,p.z]},true),obs.p);await step(1);
  54 |     const keys=Math.abs(dx)>Math.abs(dz)?dx>0?['s','d']:['w','a']:dz>0?['s','a']:['w','d'];
  55 |     for(const key of keys)await page.keyboard.down(key);await step(Math.min(12,Math.max(2,Math.floor(Math.max(Math.abs(dx),Math.abs(dz))*10))));for(const key of keys)await page.keyboard.up(key);
  56 | 
  57 |   }
> 58 |   const m=await page.evaluate(()=>window.__SS__!.missions.state()!);expect(m.phase).toBe('result');expect(shots.size).toBe(7);expect(m.l6!.gates.some(g=>g.closedAt>0)).toBe(true);expect(m.result!.deaths).toBe(0);expect(m.result!.rescued/m.result!.survivorsIn!).toBeGreaterThanOrEqual(.6);expect(m.l6!.survivors.some(r=>r.straggler&&r.rejoined)).toBe(true);await expect(page.getByRole('heading',{name:'Night. Still alive.'})).toBeVisible();await expect(page.getByTestId('result-rescued')).toHaveText(String(m.result!.rescued));await expect(page.getByTestId('result-survivorsIn')).toHaveText(String(m.result!.survivorsIn));await expect(page.getByTestId('mission-detail')).toContainText(`Rescued ${m.result!.rescued}`);await page.screenshot({path:`${out}/real-result.png`});await page.getByRole('button',{name:'Credits',exact:true}).click();await expect(page.getByRole('heading',{name:'Credits',exact:true})).toBeVisible();await expect(page.locator('.credits-roll')).toContainText('A community still alive');await expect(page.locator('.credits-roll')).toHaveCSS('opacity','1',{timeout:8000});await page.evaluate(()=>window.__SS__!.vfx.stepRender(.3));await page.screenshot({path:`${out}/real-credits.png`});await expect(page.getByRole('heading',{name:'Minor Incident',exact:true})).toBeVisible({timeout:16000});
     |                                                                                                                                                                                                                                                                                                                                                          ^ Error: expect(received).toBe(expected) // Object.is equality
  59 | });
  60 | 
  61 | const lum = (r: number, g: number, b: number) => { const c = (v: number) => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * c(r) + .7152 * c(g) + .0722 * c(b); };
  62 | const hue = (r: number, g: number, b: number) => { const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min || 1; const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
  63 | /** Average colour of a small disc of canvas pixels around an NDC point. */
  64 | function patch(png: PNG, ndc: number[], radius = 6) {
  65 |   const cx = Math.round((ndc[0] + 1) / 2 * png.width), cy = Math.round((1 - ndc[1]) / 2 * png.height); let r = 0, g = 0, b = 0, n = 0;
  66 |   for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++) {
  67 |     if (x < 0 || y < 0 || x >= png.width || y >= png.height || Math.hypot(x - cx, y - cy) > radius) continue;
  68 |     const i = (y * png.width + x) * 4; r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2]; n++;
  69 |   }
  70 |   return { r: r / n, g: g / n, b: b / n, l: lum(r / n, g / n, b / n) };
  71 | }
  72 | 
  73 | for(const [name,spot] of [['l6-shelter-fails',{x:0,z:4}],['l6-tunnel-retreat',{x:110,z:15}]] as const)test(`T-E24-15 @E24 @E24-AC15 ${name} mask contrast, red eye maxima and flashlight shadow`,async({page})=>{
  74 |   test.setTimeout(300_000);mkdirSync(out,{recursive:true});await boot(page);
  75 |   await page.addStyleTag({content:'#hud,.hud,.story-bubble,.mission-subtitle,.mission-hud,.objective-hud{visibility:hidden!important}'});
  76 |   const setup=await page.evaluate(async spot=>{const a=window.__SS__!;await a.loadLevel('L6',{seed:1,progression:'L6-default'});a.pause();a.missions.begin();a.cheats.god(true);a.cheats.completeObjective('shelter');a.cheats.completeObjective('stop');a.teleport(1,spot);const ids=[0,1,2].map(i=>a.spawn('infected.runner',{x:spot.x-7-i*.8,z:spot.z+.6},{state:'idle',yaw:0}));a.camera.cinematic({position:[spot.x+20,25,spot.z+20],target:[spot.x-3,0,spot.z]},true);await a.step(30);await a.screenshotReady();const p=a.getEntity(1)!.transform;return{ring:Array.from({length:8},(_,k)=>a.camera.project(p.x+2*Math.cos(k*Math.PI/4),p.y-.7,p.z+2*Math.sin(k*Math.PI/4))),heads:ids.map(id=>{const t=a.getEntity(id)!.transform;return{head:a.camera.project(t.x,t.y+.75,t.z),feet:a.camera.project(t.x,t.y-.7,t.z)};}),lighting:a.perf().lighting};},spot);
  77 |   const image=PNG.sync.read(await page.locator('canvas').screenshot({path:`${out}/${name}-readability.png`}));await page.evaluate(async()=>{window.__SS__!.settings.set({idPass:true});await window.__SS__!.screenshotReady();});const mask=PNG.sync.read(await page.locator('canvas').screenshot({path:`${out}/${name}-mask.png`}));await page.evaluate(()=>window.__SS__!.settings.set({idPass:false}));let sum=0,n=0;
  78 |   for(let i=0;i<mask.data.length;i+=4)if(mask.data[i]>240&&mask.data[i+1]<20&&mask.data[i+2]>240){sum+=lum(image.data[i],image.data[i+1],image.data[i+2]);n++;}
  79 |   const covered=(p:number[])=>{const i=(Math.round((1-p[1])/2*mask.height)*mask.width+Math.round((p[0]+1)/2*mask.width))*4;return mask.data[i]>240&&mask.data[i+1]<20;};const rings=setup.ring.filter(p=>!covered(p)).map(p=>patch(image,p,5).l),player=sum/n,ring=rings.reduce((a,b)=>a+b,0)/rings.length,contrast=(player+.05)/(ring+.05);
  80 |   const eyes=setup.heads.map(({head,feet})=>{const x0=Math.round((head[0]+1)/2*image.width),y0=Math.round((1-head[1])/2*image.height),y1=Math.round((1-feet[1])/2*image.height),half=Math.max(8,Math.round((y1-y0)*.45));let best={l:-1,r:0,g:0,b:0};for(let y=y0-half;y<=y1;y++)for(let x=x0-half;x<=x0+half;x++){const i=(y*image.width+x)*4,l=lum(image.data[i],image.data[i+1],image.data[i+2]);if(l>best.l)best={l,r:image.data[i],g:image.data[i+1],b:image.data[i+2]};}return best;});writeFileSync(`${out}/${name}-readability.json`,JSON.stringify({n,player,ring,contrast,eyes,setup},null,2));expect(n).toBeGreaterThan(200);expect(contrast).toBeGreaterThanOrEqual(3);expect(setup.lighting!.heroShadow).toBe(1);for(const e of eyes){expect(e.r-Math.max(e.g,e.b)).toBeGreaterThanOrEqual(60);expect(hue(e.r,e.g,e.b)>=330||hue(e.r,e.g,e.b)<=20).toBe(true);}
  81 | });
  82 | 
```