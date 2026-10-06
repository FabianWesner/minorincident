import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import { menuStart, menuUrl } from './ui-helpers';
const output='test-results/epics/E19';
// Native headless GPU headroom, without rounding a 60 Hz vsync ceiling into a pass.
test.use({headless:true,launchOptions:{args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--disable-frame-rate-limit','--disable-gpu-vsync']}});
for(const mode of ['desktop','portrait','landscape'] as const)test.describe(mode,()=>{
  test.use({hasTouch:mode!=='desktop',isMobile:mode!=='desktop',viewport:mode==='desktop'?{width:1600,height:900}:mode==='portrait'?{width:390,height:844}:{width:844,height:390}});
  test(`@E19 slice real-input start to end ${mode}`,async({page,context})=>{
    test.setTimeout(240_000);page.setDefaultTimeout(60_000);mkdirSync(output,{recursive:true});
    if(mode==='desktop')await menuStart(page);
    else {await page.goto(menuUrl);for(const id of ['start-game','character-female','level-L1','mission-button'])await page.getByTestId(id).tap();await expect(page.getByTestId('pause-button')).toBeVisible();}
    page.setDefaultTimeout(10_000);
    await page.evaluate(()=>window.__SS__!.pause());
    const cdp=mode==='desktop'?null:await context.newCDPSession(page);
    const step=async(n:number)=>{
      await page.evaluate(n=>window.__SS__!.step(n),n);
      expect(await page.evaluate(()=>window.__SS__!.getState().player!.transform.y), 'survivor stays on ground').toBeGreaterThan(.65);
    };
    const noVoid=async(buffer:Buffer)=>{
      const png=PNG.sync.read(buffer);let skyPixels=0,samples=0;
      // This downward isometric camera has its horizon above the viewport. Sample the lower half.
      for(let y=Math.floor(png.height/2);y<png.height;y+=4)for(let x=0;x<png.width;x+=4){
        const i=(y*png.width+x)*4;samples++;
        if(Math.abs(png.data[i]-197)<8&&Math.abs(png.data[i+1]-218)<8&&Math.abs(png.data[i+2]-229)<8)skyPixels++;
      }
      expect(skyPixels/samples,'sky colour must not replace ground below the horizon').toBeLessThan(.001);
    };
    const shot=async(label:string)=>{
      if(mode!=='desktop'&&await page.evaluate(()=>window.__SS__!.missions.state()!.phase==='playing')){
        const layout=await page.evaluate(()=>{
          const selectors=['.hud-vitals','.hud-map','.hud-tracker','.onboarding','.hud-stick-zone','.slice-choices','[data-touch-action=left]','[data-touch-action=right]','[data-touch-action=interact]','[data-testid=pause-button]'];
          const rect=(e:Element)=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,id:(e as HTMLElement).dataset.testid??e.className};};
          const visible=(e:Element)=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
          const boxes=selectors.flatMap(s=>[...document.querySelectorAll(s)].filter(visible).map(rect));
          const xs=[...new Set(boxes.flatMap(b=>[Math.max(0,b.x),Math.min(innerWidth,b.x+b.w)]))].sort((a,b)=>a-b);let area=0;
          for(let i=1;i<xs.length;i++){const ys=boxes.filter(b=>b.x<xs[i]&&b.x+b.w>xs[i-1]).map(b=>[Math.max(0,b.y),Math.min(innerHeight,b.y+b.h)]).sort((a,b)=>a[0]-b[0]);let end=0,height=0;for(const [a,b]of ys){if(b>end){height+=b-Math.max(end,a);end=b;}}area+=(xs[i]-xs[i-1])*height;}
          const controls=[...document.querySelectorAll('.hud button,.hud [role=button],.slice-choices button,[data-touch-action], [data-testid=pause-button]')].filter(visible).map(rect);
          return{coverage:area/(innerWidth*innerHeight),controls};
        });
        if(mode==='portrait')expect(layout.coverage,`${label} HUD coverage`).toBeLessThanOrEqual(.25);
        for(const [i,a]of layout.controls.entries())for(const b of layout.controls.slice(i+1))expect(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y,`${label}: ${a.id} overlaps ${b.id}`).toBe(false);
      }
      await page.evaluate(()=>window.__SS__!.screenshotReady());await noVoid(await page.screenshot({path:`${output}/${mode}-${label}.png`}));};
    const move=async(x:number,z:number)=>{
      for(let i=0;i<160;i++){
        const p=await page.evaluate(()=>window.__SS__!.getState().player!.transform);
        const distance=Math.hypot(x-p.x,z-p.z);if(distance<.7)return;
        if(cdp){
          const dx=(x-p.x)/distance,dz=(z-p.z)/distance;
          const origin={id:1,x:70,y:page.viewportSize()!.height*.6};
          await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[origin]});
          await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...origin,x:origin.x+(dx-dz)/Math.SQRT2*50,y:origin.y+(dx+dz)/Math.SQRT2*50}]});
          await step(Math.min(24,Math.max(1,Math.floor(distance/6*60))));
          await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        }else{
          const point=await page.evaluate(({x,z})=>window.__SS__!.input.project({x,z}),{x:p.x+(x-p.x)/distance*Math.min(3,distance),z:p.z+(z-p.z)/distance*Math.min(3,distance)});
          await page.mouse.click(point.x,point.y);await step(24);
        }
        if(i%12===0){await page.evaluate(()=>window.__SS__!.screenshotReady());await noVoid(await page.screenshot());}
      }
      throw new Error(`Could not walk to ${x},${z}: ${JSON.stringify(await page.evaluate(()=>window.__SS__!.getState().player!.transform))}`);
    };
    expect(await page.evaluate(()=>window.__SS__!.getState().districts!.districts.map(d=>d.id))).toEqual(['D-RES','D-MAIN','D-SHOP']);
    await shot('morning');expect(await page.evaluate(()=>window.__SS__!.getState().player!.weapons)).toBeUndefined();
    await expect(page.locator('[data-audio-controls]')).toBeHidden();for(const panel of await page.locator('body>details').all())await expect(panel).toBeHidden();
    expect(await page.evaluate(()=>window.__SS__!.query({kind:'companion'}))).toHaveLength(1);
    await page.evaluate(()=>window.__SS__!.settings.set({idPass:true}));await page.evaluate(()=>window.__SS__!.screenshotReady());
    const mask=PNG.sync.read(await page.screenshot());let top=mask.height,bottom=-1;
    for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++){const i=(y*mask.width+x)*4;if(mask.data[i]>240&&mask.data[i+1]<20&&mask.data[i+2]>240){top=Math.min(top,y);bottom=Math.max(bottom,y);}}
    const playerHeight=(bottom-top+1)/mask.height;expect(playerHeight).toBeGreaterThanOrEqual(mode==='portrait'?.12:1/5.5);
    writeFileSync(`${output}/${mode}-pixels.json`,JSON.stringify({playerHeight,playerPixels:bottom-top+1,viewport:page.viewportSize(),companionCount:1},null,2));
    await page.evaluate(()=>window.__SS__!.settings.set({idPass:false}));await page.evaluate(()=>window.__SS__!.screenshotReady());
    const project=await page.evaluate(()=>window.__SS__!.input.project(window.__SS__!.getState().player!.transform));
    if(cdp){await page.getByTestId('touch-left').tap();await page.getByTestId('touch-right').tap();expect(await page.getByTestId('touch-icon-left').evaluate(e=>(e as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);}
    else {await page.mouse.click(project.x,project.y);await page.mouse.click(project.x,project.y,{button:'right'});}await step(1);
    expect(await page.evaluate(()=>window.__SS__!.events().some(e=>e.type==='combat.hit'&&e.sourceId===1))).toBe(false);

    await move(-14,-4);await move(0,0);await move(42,0);await shot('before-incident');await move(42,-6.5);await step(1);
    expect(await page.evaluate(()=>window.__SS__!.getState().mission!.completedObjectives)).toContain('breakfast');
    expect(await page.evaluate(()=>window.__SS__!.query({kind:'infected'}).filter(e=>e.health.current>0))).toHaveLength(1);await shot('entrant');
    for(let i=0;i<120 && !await page.evaluate(()=>window.__SS__!.missions.state()!.outbreak!.released);i++)await step(30);
    expect(await page.evaluate(()=>window.__SS__!.query({kind:'infected'}).filter(e=>e.health.current>0))).toHaveLength(4);
    expect(await page.evaluate(()=>window.__SS__!.events().filter(e=>e.type==='civilian.turned').length)).toBeGreaterThanOrEqual(3);await shot('incident');
    expect(await page.evaluate(()=>window.__SS__!.missions.state()!.checkpoint)).toBe('escape');
    if(mode==='desktop'){
      const started=await page.evaluate(()=>window.__SS__!.getState().tick);
      // All combat comes from LMB/RMB on live infected, including the formerly inert fists.
      for(let turn=0;turn<20;turn++){
        if(await page.evaluate(()=>window.__SS__!.missions.state()!.stats.kills>0))break;
        const point=await page.evaluate(()=>{
          const a=window.__SS__!,p=a.getState().player!.transform;
          const target=a.query({kind:'infected'}).filter(e=>e.health.current>0).sort((a,b)=>Math.hypot(a.transform.x-p.x,a.transform.z-p.z)-Math.hypot(b.transform.x-p.x,b.transform.z-p.z))[0];
          return a.input.project(target.transform);
        });
        const button=turn===0?'right':'left';await page.mouse.move(point.x,point.y);await page.mouse.down({button});await step(36);await page.mouse.up({button});
      }
      const hits=await page.evaluate(()=>window.__SS__!.events());
      expect(hits.some(e=>e.type==='combat.hit'&&e.actionId==='weapon.fists'&&e.amount>0)).toBe(true);
      expect(hits.some(e=>e.type==='combat.kill'&&e.actionId==='weapon.fists')).toBe(true);
      expect(await page.evaluate(()=>window.__SS__!.getState().tick)-started).toBeLessThan(11*60);
      await shot('fists');
    }
    await move(42,0);await move(70,0);await move(70,-7);await step(1);
    expect(await page.evaluate(()=>window.__SS__!.missions.state()!.checkpoint)).toBe('melee');
    await shot('display');await page.getByTestId('choose-bat').click();
    if(cdp)await page.getByTestId('touch-interact').tap();else {await page.keyboard.press('f');}
    await step(1);
    expect(await page.evaluate(()=>window.__SS__!.getState().player!.weapons!.LEFT.rack[0].id)).toBe('weapon.bat');await shot('store');
    // Use both sides against real encounter targets; clicks approach through ControlIntent.
    for(let turn=0;turn<150;turn++){
      const state=await page.evaluate(()=>window.__SS__!.getState());if('phase' in state.mission! && state.mission.phase==='result')break;
      const target=await page.evaluate(()=>{const a=window.__SS__!,p=a.getState().player!.transform;return a.query({kind:'infected'}).filter(e=>e.health.current>0).sort((a,b)=>Math.hypot(a.transform.x-p.x,a.transform.z-p.z)-Math.hypot(b.transform.x-p.x,b.transform.z-p.z))[0];});
      if(!target){await step(30);continue;}
      const side=turn%4===0?'right':'left';
      if(cdp){
        const p=state.player!.transform,dx=target.transform.x-p.x,dz=target.transform.z-p.z,d=Math.hypot(dx,dz)||1;
        const origin={id:1,x:70,y:page.viewportSize()!.height*.6};
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[origin]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...origin,x:origin.x+(dx-dz)/d/Math.SQRT2*60,y:origin.y+(dx+dz)/d/Math.SQRT2*60}]});
        await step(d>1.5?18:4);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await page.getByTestId(`touch-${side}`).tap();await step(30);
      }
      else{
        const point=await page.evaluate(p=>window.__SS__!.input.project(p),target.transform);
        await page.mouse.move(point.x,point.y);await page.mouse.down({button:side});await step(36);await page.mouse.up({button:side});
      }
      if(turn===2)await shot('fight');
    }
    await expect(page.getByTestId('mission-heading')).toHaveText('Milestone 1 complete — thanks for playing');
    const events=await page.evaluate(()=>window.__SS__!.events());expect(events.some(e=>e.type==='combat.hit'&&e.actionId==='weapon.kick')).toBe(true);expect(events.some(e=>e.type==='combat.hit'&&e.actionId==='weapon.bat')).toBe(true);
    expect(await page.evaluate(()=>window.__SS__!.missions.state()!.stats.deaths)).toBe(0);
    writeFileSync(`${output}/${mode}-playthrough.json`,JSON.stringify(await page.evaluate(()=>window.__SS__!.missions.state()!.stats),null,2));
    await shot('complete');await page.getByRole('button',{name:'Restart',exact:true}).click();await page.evaluate(()=>window.__SS__!.pause());await step(1);
    expect(await page.evaluate(()=>window.__SS__!.getState().mission!.completedObjectives)).toEqual([]);
  });
  test(`@E19 slice GPU performance ${mode}`,async({page})=>{
    test.setTimeout(180_000);mkdirSync(output,{recursive:true});await menuStart(page);await page.evaluate(()=>window.__SS__!.pause());
    const samples:Record<string,unknown>={};
    const perf=async(label:string)=>{
      const data=await page.evaluate(async()=>{
        const a=window.__SS__!,fps:number[]=[];a.resume();
        for(let i=0;i<120;i++){await new Promise<void>(r=>requestAnimationFrame(()=>r()));if(i>30)fps.push(a.perf().fps);}
        a.pause();fps.sort((a,b)=>a-b);
        const gl=document.querySelector('canvas')!.getContext('webgl2')!,extension=gl.getExtension('WEBGL_debug_renderer_info');
        return {medianFps:fps[Math.floor(fps.length/2)],unthrottled:true,gpu:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) as string:null,counters:a.perf()};
      });samples[label]=data;expect(data.medianFps,`${mode} ${label} native GPU median FPS`).toBeGreaterThanOrEqual(mode==='desktop'?60:30);writeFileSync(`${output}/${mode}-perf.json`,JSON.stringify(samples,null,2));
    };
    // Photo/performance setup is separate from the real-input playthrough above.
    await page.evaluate(async()=>{ const a=window.__SS__!;a.teleport('player',{x:42,z:-6.5});await a.step(1); });
    await perf('incident');
    await page.evaluate(async()=>{ const a=window.__SS__!;await a.loadLevel('L1');a.pause();a.missions.begin();a.missions.completeObjective('breakfast');a.missions.completeObjective('escape');a.teleport('player',{x:70,z:-7});a.missions.completeObjective('melee');await a.step(1);await a.screenshotReady(); });
    await perf('store');
  });
});

test('@E19 hardware checkpoint accepts a real middle-click for the chosen crowbar',async({page})=>{
  test.setTimeout(120_000);await menuStart(page);
  // Isolated input check complements the complete, unmodified menu-to-result routes above.
  await page.evaluate(async()=>{const a=window.__SS__!;a.pause();await a.loadLevel('L1',{checkpoint:'melee'});a.teleport('player',{x:70,z:-7});await a.step(1);});
  await page.getByTestId('choose-crowbar').click();const p=await page.evaluate(()=>window.__SS__!.input.project({x:70,z:-8.14875}));
  await page.mouse.click(p.x,p.y,{button:'middle'});await page.evaluate(()=>window.__SS__!.step(1));
  expect(await page.evaluate(()=>window.__SS__!.getState().player!.weapons!.LEFT.rack[0].id)).toBe('weapon.crowbar');
  await page.evaluate(()=>window.__SS__!.screenshotReady());await page.screenshot({path:`${output}/desktop-middle-click.png`});
});

test('@E19 incident idle survival and death resume escape through real clicks',async({page})=>{
  test.setTimeout(180_000);await menuStart(page);await page.evaluate(()=>window.__SS__!.pause());
  const walk=async(x:number,z:number)=>{
    for(let i=0;i<160;i++){
      const p=await page.evaluate(()=>window.__SS__!.getState().player!.transform),d=Math.hypot(x-p.x,z-p.z);
      if(d<.7)return;
      const point=await page.evaluate(p=>window.__SS__!.input.project(p),{x:p.x+(x-p.x)/d*Math.min(3,d),z:p.z+(z-p.z)/d*Math.min(3,d)});
      await page.mouse.click(point.x,point.y);await page.evaluate(()=>window.__SS__!.step(24));
      expect(await page.evaluate(()=>window.__SS__!.getState().player!.transform.y)).toBeGreaterThan(.65);
    }throw new Error(`Incident route stalled to ${x},${z}: ${JSON.stringify(await page.evaluate(()=>window.__SS__!.getState().player!.transform))}`);
  };
  await walk(-14,-4);await walk(0,0);
  // Click beyond the exposed west edge, then attempt to continue off the loaded floor.
  await walk(-26,0);
  for(let i=0;i<12;i++){
    const point=await page.evaluate(()=>{const a=window.__SS__!,p=a.getState().player!.transform;return a.input.project({x:p.x-3,z:p.z});});
    await page.mouse.click(point.x,point.y);await page.evaluate(()=>window.__SS__!.step(60));
    const p=await page.evaluate(()=>window.__SS__!.getState().player!.transform);expect(p.x).toBeGreaterThan(-28);expect(p.y).toBeGreaterThan(.65);
  }
  await page.evaluate(()=>window.__SS__!.screenshotReady());await page.screenshot({path:`${output}/desktop-edge.png`});
  await walk(0,0);await walk(42,0);
  await walk(42,-6.5);
  await page.evaluate(()=>window.__SS__!.step(1));
  expect(await page.evaluate(()=>window.__SS__!.missions.state()!.checkpoint)).toBe('escape');
  const start=await page.evaluate(()=>window.__SS__!.getState().tick);
  await page.evaluate(()=>window.__SS__!.step(1500));
  expect(await page.evaluate(()=>window.__SS__!.missions.state()!.stats.deaths)).toBe(0);
  expect(await page.evaluate(()=>window.__SS__!.getState().player!.health.current)).toBeGreaterThan(0);
  for(let i=0;i<160;i++){
    if(await page.evaluate(()=>window.__SS__!.events().some(e=>e.type==='checkpoint.restored'&&e.id==='escape')))break;
    await page.evaluate(()=>window.__SS__!.step(30));
  }
  const events=await page.evaluate(()=>window.__SS__!.events());
  expect(events.some(e=>e.type==='checkpoint.restored'&&e.id==='escape')).toBe(true);
  const death=events.find(e=>e.type==='player.died')!;expect((death.tick-start)/60).toBeGreaterThanOrEqual(25);
  const state=await page.evaluate(()=>window.__SS__!.missions.state()!);
  expect(state.completedObjectives).toEqual(['breakfast']);expect(state.steps.escape.status).toBe('active');
  expect(state.steps.melee.status).toBe('pending');
  expect(await page.evaluate(()=>window.__SS__!.getState().player!.weapons!.LEFT.rack[0].id)).toBe('weapon.fists');
  await page.evaluate(()=>window.__SS__!.screenshotReady());await page.screenshot({path:`${output}/desktop-escape-respawn.png`});
  writeFileSync(`${output}/incident-survival.json`,JSON.stringify({idleSurvival_s:(death.tick-start)/60,checkpoint:state.checkpoint,deaths:state.stats.deaths},null,2));
});
