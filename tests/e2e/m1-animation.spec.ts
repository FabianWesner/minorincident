import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from './fixtures';
import { menuStart, menuUrl } from './ui-helpers';

const output = 'test-results/m1-anim';
test.use({ video:'on' });
for (const mode of ['desktop','iphone'] as const) test.describe(mode, () => {
  test.use({ viewport: mode === 'desktop' ? { width:1600,height:900 } : { width:390,height:844 }, hasTouch:mode==='iphone', isMobile:mode==='iphone' });
  for (const weapon of ['bat','crowbar','machete'] as const) test(`M1-03 M1-11 M1-12 M1-13 @E19 ${mode} chooses and fights with ${weapon} through real input`, async ({ page, context }) => {
    test.setTimeout(180_000); mkdirSync(output,{recursive:true});
    if(mode==='desktop') await menuStart(page);
    else { await page.goto(menuUrl); for(const id of ['start-game','character-female','level-L1','mission-button']) await page.getByTestId(id).tap(); }
    // Checkpoint setup keeps this focused; the separate E19 route tests the complete journey.
    await page.evaluate(async()=>{const a=window.__SS__!;a.pause();await a.loadLevel('L1',{checkpoint:'melee'});a.teleport('player',{x:70,z:-7});await a.step(1);});
    await expect(page.getByTestId('weapon-display')).toBeVisible();
    if(mode==='iphone') {await page.getByTestId(`choose-${weapon}`).tap();await page.getByTestId('touch-interact').tap();}
    else {await page.getByTestId(`choose-${weapon}`).click();await page.keyboard.press('f');}
    await page.evaluate(()=>window.__SS__!.step(1));
    const held=await page.evaluate(()=>window.__SS__!.getState().render.actions!.attachments.find(a=>a.side==='LEFT')!);
    expect(held.actionId).toBe(`weapon.${weapon}`);expect(held.socket).toBe('weaponSocketR');expect(held.attached).toBe(true);expect(held.source).toBe('glb');expect(held.gripDistance).toBeLessThan(.001);
    expect(await page.evaluate(()=>window.__SS__!.getState().player!.weapons!.LEFT.rack[0].id)).toBe(`weapon.${weapon}`);
    const icon=page.getByTestId(mode==='iphone'?'touch-icon-left':'icon-LEFT');
    await expect(icon).toHaveAttribute('src',held.iconUrl!);await expect.poll(()=>icon.evaluate(e=>(e as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.evaluate(()=>window.__SS__!.screenshotReady());await page.screenshot({path:`${output}/${mode}-${weapon}-held.png`});
    const cdp=mode==='iphone'?await context.newCDPSession(page):null;
    let maximumTrail=0,maximumParticles=0;
    if(mode==='desktop') {
      // Store enemies spawn offscreen. Approach with real ground clicks before
      // projecting an attack; moving the mouse outside the canvas sends no input.
      for(let attempt=0;attempt<60;attempt++) {
        const approach=await page.evaluate(()=>{
          const a=window.__SS__!,p=a.getState().player!.transform;
          const target=a.query({kind:'infected'}).filter(e=>e.health.current>0).sort((a,b)=>Math.hypot(a.transform.x-p.x,a.transform.z-p.z)-Math.hypot(b.transform.x-p.x,b.transform.z-p.z))[0];
          if(!target)return null;
          const point=a.input.project(target.transform),dx=target.transform.x-p.x,dz=target.transform.z-p.z,d=Math.hypot(dx,dz)||1;
          return {point,step:a.input.project({x:p.x+dx/d*Math.min(3,d),z:p.z+dz/d*Math.min(3,d)})};
        });
        expect(approach).not.toBeNull();
        if(approach!.point.x>20&&approach!.point.x<1580&&approach!.point.y>100&&approach!.point.y<800)break;
        expect(attempt,'enemy must enter the canvas through real movement').toBeLessThan(59);
        await page.mouse.click(approach!.step.x,approach!.step.y);await page.evaluate(()=>window.__SS__!.step(24));
      }
    }
    for(let beat=0;beat<8;beat++){
      const target=await page.evaluate(()=>{const a=window.__SS__!,p=a.getState().player!.transform;return a.query({kind:'infected'}).filter(e=>e.health.current>0).sort((a,b)=>Math.hypot(a.transform.x-p.x,a.transform.z-p.z)-Math.hypot(b.transform.x-p.x,b.transform.z-p.z))[0];});
      if(!target)break;
      if(cdp){
        const p=await page.evaluate(()=>window.__SS__!.getState().player!.transform),dx=target.transform.x-p.x,dz=target.transform.z-p.z,d=Math.hypot(dx,dz)||1;
        const origin={id:1,x:70,y:506};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[origin]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...origin,x:origin.x+(dx-dz)/d/Math.SQRT2*60,y:origin.y+(dx+dz)/d/Math.SQRT2*60}]});
        await page.evaluate(n=>window.__SS__!.step(n),Math.max(1,Math.floor(Math.max(0,d-1.15)/4.5*60)));
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.getByTestId(beat%4===3?'touch-right':'touch-left').tap();
      }else {const point=await page.evaluate(p=>window.__SS__!.input.project(p),target.transform);await page.mouse.move(point.x,point.y);await page.mouse.down();}
      // Offscreen population spawns need navigation time before the strike review.
      if(!cdp) for(let approach=0;approach<60;approach++){
        const distance=await page.evaluate(id=>{const a=window.__SS__!,e=a.getEntity(id),p=a.getState().player!.transform;return !e||e.health.current<=0?0:Math.hypot(e.transform.x-p.x,e.transform.z-p.z);},target.id);
        if(distance<1.8)break;
        await page.evaluate(async()=>{const a=window.__SS__!;await a.step(12);a.vfx.stepRender(.2);});
        const render=await page.evaluate(()=>window.__SS__!.getState().render);
        maximumTrail=Math.max(maximumTrail,render.actions!.trailVertices);maximumParticles=Math.max(maximumParticles,render.vfx!.particles);
      }
      for(let tick=0;tick<36;tick++){
        await page.evaluate(async()=>{const a=window.__SS__!;await a.step(1);a.vfx.stepRender(1/60);});
        const render=await page.evaluate(()=>window.__SS__!.getState().render);
        maximumTrail=Math.max(maximumTrail,render.actions!.trailVertices);maximumParticles=Math.max(maximumParticles,render.vfx!.particles);
        if(beat<3&&[5,9,14,22].includes(tick)){await page.evaluate(()=>window.__SS__!.screenshotReady());await page.screenshot({path:`${output}/${mode}-${weapon}-${beat}-${tick}.png`});}
      }
      if(!cdp)await page.mouse.up();
    }
    const events=await page.evaluate(()=>window.__SS__!.events()),hits=events.filter(e=>e.type==='combat.hit'&&e.actionId===`weapon.${weapon}`);
    expect(hits.length).toBeGreaterThan(0);expect(maximumTrail).toBeGreaterThan(0);expect(maximumParticles).toBeGreaterThan(0);
    expect(await page.evaluate(()=>window.__SS__!.getState().render.character!.missingClips)).toBe(0);
    const state=await page.evaluate(()=>window.__SS__!.getState());
    writeFileSync(`${output}/${mode}-${weapon}.json`,JSON.stringify({held,maximumTrail,maximumParticles,hits,attacks:events.filter(e=>e.type==='combat.attack'),render:state.render,stats:state.mission},null,2));
    await page.evaluate(()=>window.__SS__!.screenshotReady());await page.screenshot({path:`${output}/${mode}-${weapon}-after.png`});
    if (weapon === 'bat') {
      // An uninterrupted recording also exposes transition/facing problems that
      // stepped strike captures cannot show. All movement and attacks use real input.
      await page.evaluate(()=>{window.__SS__!.cheats.god(true);window.__SS__!.resume();});
      if (cdp) {
        const origin={id:1,x:70,y:506};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[origin]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...origin,x:110,y:466}]});await page.waitForTimeout(1600);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        for(let i=0;i<6;i++){if(!await page.getByTestId('touch-left').isVisible())break;await page.getByTestId('touch-left').tap();await page.waitForTimeout(350);}
      } else {
        await page.keyboard.down('d');await page.keyboard.down('Shift');await page.waitForTimeout(1200);
        await page.keyboard.up('Shift');await page.waitForTimeout(1200);await page.keyboard.up('d');
        const target=await page.evaluate(()=>{const a=window.__SS__!,p=a.getState().player!.transform;return a.query({kind:'infected'}).filter(e=>e.health.current>0).sort((a,b)=>Math.hypot(a.transform.x-p.x,a.transform.z-p.z)-Math.hypot(b.transform.x-p.x,b.transform.z-p.z))[0];});
        if(target){const point=await page.evaluate(p=>window.__SS__!.input.project(p),target.transform);await page.mouse.move(point.x,point.y);await page.mouse.down();await page.waitForTimeout(4000);await page.mouse.up();}
      }
      await page.evaluate(()=>window.__SS__!.pause());await page.screenshot({path:`${output}/${mode}-continuous.png`});
    }
  });
});
