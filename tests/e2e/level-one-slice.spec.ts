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
    const step=async(n:number)=>{await page.evaluate(n=>window.__SS__!.step(n),n);};
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
      await page.evaluate(()=>window.__SS__!.screenshotReady());await page.screenshot({path:`${output}/${mode}-${label}.png`});};
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
      }
      throw new Error(`Could not walk to ${x},${z}: ${JSON.stringify(await page.evaluate(()=>window.__SS__!.getState().player!.transform))}`);
    };
    await shot('morning');expect(await page.evaluate(()=>window.__SS__!.getState().player!.weapons)).toBeUndefined();
    await move(0,0);await move(42,0);await move(42,-6.5);await step(1);
    expect(await page.evaluate(()=>window.__SS__!.getState().mission!.completedObjectives)).toContain('breakfast');
    expect(await page.evaluate(()=>window.__SS__!.query({kind:'infected'}).filter(e=>e.health.current>0))).toHaveLength(4);await shot('incident');await perf('incident');
    await move(42,0);await move(70,0);await move(70,-7);await step(1);
    expect(await page.evaluate(()=>window.__SS__!.missions.state()!.checkpoint)).toBe('melee');
    await shot('display');await page.getByTestId('choose-machete').click();
    if(cdp)await page.getByTestId('touch-interact').tap();else {await page.keyboard.press('f');}
    await step(1);
    expect(await page.evaluate(()=>window.__SS__!.getState().player!.weapons!.LEFT.rack[0].id)).toBe('weapon.machete');await shot('store');await perf('store');
    if(mode==='desktop'){
      // Let the real AI kill the idle player; step only advances time, without damage cheats.
      for(let i=0;i<80;i++){await step(30);if(await page.evaluate(()=>window.__SS__!.events().some(e=>e.type==='player.died')))break;}
      expect(await page.evaluate(()=>window.__SS__!.events().some(e=>e.type==='player.died'))).toBe(true);
      for(let i=0;i<20;i++){await step(15);if(await page.evaluate(()=>window.__SS__!.events().some(e=>e.type==='checkpoint.restored')))break;}
      expect(await page.evaluate(()=>window.__SS__!.getState().player!.weapons!.LEFT.rack[0].id)).toBe('weapon.machete');
      expect(await page.evaluate(()=>window.__SS__!.missions.state()!.checkpoint)).toBe('melee');await shot('respawn');
    }
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
    const events=await page.evaluate(()=>window.__SS__!.events());expect(events.some(e=>e.type==='combat.hit'&&e.actionId==='weapon.kick')).toBe(true);expect(events.some(e=>e.type==='combat.hit'&&e.actionId==='weapon.machete')).toBe(true);
    await shot('complete');await page.getByRole('button',{name:'Restart',exact:true}).click();await page.evaluate(()=>window.__SS__!.pause());await step(1);
    expect(await page.evaluate(()=>window.__SS__!.getState().mission!.completedObjectives)).toEqual([]);
  });
});
