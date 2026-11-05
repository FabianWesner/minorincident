/** L3-01: acquire normally, then count actual production handgun attacks and inspect the live HUD. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
import type { Game } from '../../src/Game';
const out = process.env.HANDGUN_CAPTURE_OUT ?? 'test-results/fix60-a/handgun'; mkdirSync(`${out}/captures`, { recursive: true });
const runs = [];
const sampleLimit = Number(process.env.HANDGUN_SAMPLE_LIMIT ?? 6);
const finalZooms = (process.env.HANDGUN_FINAL_ZOOMS ?? '1').split(',').map(Number);
assert(finalZooms.every(zoom => [.5, 1, 1.5].includes(zoom)));
try {
  for (const tier of ['low','high'] as const) {
    const session = new SceneSession({ tier, backend: 'webgpu', query: { ui: '1' } });
    try {
      await session.open(); await session.page.evaluate('window.__name=f=>f');
      await session.page.evaluate(async tier => {
        const a=window.__SS__!;document.documentElement.setAttribute('data-scene-hud','');a.settings.set({quality:tier});
        await a.loadLevel('L3',{seed:1,progression:'L3-default'});a.missions.begin();a.pause();a.camera.follow();a.camera.zoom(1);
        const game=(window.__SCENE__ as unknown as {game:Game}).game;game.world.combat!.damage.god=true;a.bot.start('complete');
        for(let i=0;i<120&&!game.world.missions!.state.l3!.handgunAt;i++){await a.step(30);game.view.frame(.5);}
        if(!game.world.missions!.state.l3!.handgunAt)throw Error('Handgun not acquired normally');if(!game.ui.enabled||!document.querySelector('[data-testid=survivor-portrait]'))throw Error('Full HUD is not mounted');a.bot.stop();a.input.clear();
        const state={shots:[] as number[],hud:[] as {tick:number;text:string}[]};
        (window as unknown as {__fix60Gun:typeof state}).__fix60Gun=state;
        game.world.events.on('combat.attack',e=>{if(e.type==='combat.attack'&&e.sourceId===1&&e.actionId==='weapon.handgun')state.shots.push(e.tick);});
      },tier);
      await session.page.addStyleTag({content:'#hud:not([data-scene-hud]),.hud:not([data-scene-hud]),.story-bubble{visibility:visible!important}'});
      const captures=[];
      for(let sample=0;sample<=sampleLimit;sample++) {
        const state=await session.page.evaluate(async target=>{
          const a=window.__SS__!,game=(window.__SCENE__ as unknown as {game:Game}).game;
          const state=(window as unknown as {__fix60Gun:{shots:number[];hud:{tick:number;text:string}[]}}).__fix60Gun;
          for(let i=0;i<3000&&state.shots.length<target;i++) {
            a.input.set({selectedWeaponKey:4,aim:{x:1,z:0},aimSource:'keyboard',right:{down:true,held:true,up:false}});
            await a.step(15);
            game.view.frame(.25);
            state.hud.push({tick:game.world.tick,text:Array.from(document.querySelectorAll('#hud,.hud')).map(n=>(n as HTMLElement).innerText).join('\n')});
          }
          a.input.clear();await a.step(15);game.view.frame(.25);await a.screenshotReady();
          return {tier:a.getState().render.quality,tick:game.world.tick,handgunAt:game.world.missions!.state.l3!.handgunAt,shots:[...state.shots],hud:state.hud,player:{...game.world.entities.get(1)!.transform},courierForeground:game.view.getState().courierForeground,occlusion:game.view.getState().occlusion,living:game.world.infected!.active.filter(e=>e.health.current>0&&!e.hidden&&!e.pendingAdmission).map(e=>({id:e.id,at:{...e.transform},drawn:a.crowdFigures().find(f=>f.id===e.id)?.drawn??false,projected:game.view.project(e.transform.x,e.transform.y+.4,e.transform.z)}))};
        },sample*100);
        assert(state.shots.length>=sample*100,'Actual handgun attack quota');
        if (sample === sampleLimit || process.env.HANDGUN_FINAL_ONLY !== '1') for (const zoom of sample === sampleLimit ? finalZooms : [1]) {
          await session.page.evaluate(async zoom => { window.__SS__!.camera.zoom(zoom); await window.__SS__!.screenshotReady(); }, zoom);
          const census = await session.page.evaluate(() => {
            const game = (window.__SCENE__ as unknown as { game: Game }).game, figures = window.__SS__!.crowdFigures();
            const living = game.world.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.pendingAdmission);
            return { actualZoom: game.view.view.playerZoom, vfxTime: game.view.vfx!.snapshot().time, foreground: game.view.getState().courierForeground, living: living.length,
              livingDrawnInCamera: living.filter(e => { const p = game.view.project(e.transform.x, e.transform.y + .4, e.transform.z); return figures.some(f => f.id === e.id && f.drawn) && p.every(v => Math.abs(v) < 1); }).map(e => e.id) };
          });
          const file=`${out}/captures/${tier}-${sample*100}-z${zoom}.png`;await session.page.screenshot({path:file});
          captures.push({file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex'),tick:state.tick,shots:state.shots.length,...census});
        }
        if(sample===sampleLimit)runs.push({method:'Ordinary complete InputFrames to handgun pickup; then stationary right-hand fire through native input, with only courier damage suppressed. Actual combat.attack actionId counts; no ammunition/weapon injection, teleport, objective skip or timing measurement.',...state,captures});
      }
      assert.deepEqual(session.errors,[]);console.log(tier,runs.at(-1)!.shots.length);
    } finally {await session.close();}
  }
} finally {stopServer();writeFileSync(`${out}/receipt.json`,JSON.stringify({...provenance(),runs},null,2)+'\n');}
