import { humanInfected } from '../../../src/data/infected.ts';
import { regularInfectedModels } from '../../../src/data/crowdAppearance.ts';
import { alphaLooks } from '../../../src/data/alphaLooks.ts';
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { SceneSession, readSpec, stopServer } from "../../scenelab/session";
import { provenance } from "./probe";
const shared=new SceneSession({backend:'webgl2',tier:'low'});
try{
{shared.options.tier='low';
/** Current low-quality moving strips. One pooled lease per four body identities. */
const manifest=JSON.parse(readFileSync('src/assets/manifest.json','utf8'));
const entries=[...new Map([...humanInfected.map(d=>({model:d.asset,archetype:d.id})),...regularInfectedModels.map(model=>({model,archetype:'infected.runner'})),...Object.values(alphaLooks).flatMap(models=>models.map(model=>({model,archetype:'infected.alpha'}))),...manifest.filter(d=>d.id.startsWith('npc.')&&d.crowdSkin&&!/kid|brother|corgi|dog|cat|crow|lion|gorilla|flamingo|zebra|elephant/.test(d.id)).map(d=>({model:d.id,archetype:'turned pedestrian'}))].map(e=>[e.model,e])).values()];
const offset=0,runnerOnly=process.env.SWEEP_G_L4_RUNNERS==='1',chosen=runnerOnly?regularInfectedModels.map(model=>({model,archetype:'infected.runner'})):entries.filter(e=>e.model==='npc.civilian-woman-b.aftermath'),out='test-results/final-g/G-17';mkdirSync(out,{recursive:true});
const receipt={...provenance(),offset,totalIdentities:entries.length,inventory:entries,method:'Low quality, production game camera atzoom1.5; normal wander/chase after explicit SceneLab pose setup. Eight frames15ticks apart per state. Courier hidden for wander; converted civilian bodies use actual instant-infection path. Read-only pose/travel metrics. No pose tuning.',cells:[],errors:[]};
const s=shared;
try{if(!s.isOpen)await s.open();for(const entry of chosen)for(const mode of ['wander','chase']){try{
 const ped=entry.model.startsWith('npc.'),courier={id:'courier',kind:'courier',at:mode==='wander'?[35,35]:[-12,0],...(mode==='chase'?{state:{run:[[-12,0],[30,0]]}}:{})};
 await s.load({name:`G-17-${entry.model}-${mode}`,seed:5,size:100,ground:'asphalt',time:'L3',trace:true,actors:[courier,ped?{id:'z',kind:'pedestrian',at:mode==='wander'?[0,0]:[-19,0],look:{model:entry.model},state:{infect:{instant:true}}}:{id:'z',kind:'infected',archetype:entry.archetype,at:mode==='wander'?[0,0]:[-19,0],look:{model:entry.model},state:mode==='chase'?{chase:'courier'}:'idle'}],camera:{mode:'follow',actor:'z',zoom:1.5},frames:0});
 if(!ped)await s.page.evaluate(model=>{const lab=window.__SCENE__,e=lab.game.world.entities.get(lab.actors.get('z').entity);delete e.appearance;e.infected.model=model;if(model.startsWith('inf.')&&['inf.common-worker','inf.jogger','inf.cashier','inf.delivery-driver','inf.suburban-mom','inf.bbq-dad','inf.bathrobe-neighbor'].includes(model)){lab.game.world.scenario='L4';e.infected.variant=model;}},entry.model);
 if(mode==='wander')await s.page.evaluate(()=>{const lab=window.__SCENE__,g=lab.game,e=g.world.entities.get(lab.actors.get('z').entity);g.world.entities.get(1).hidden=true;delete e.noiseTarget;delete e.infected.scripted;e.infected.state='idle';if(e.infected.l1){const b=e.infected.l1;b.mode='wander';b.targetId=0;b.hasGoal=false;b.pauseUntil=g.world.tick;delete b.focusId;delete b.focusUntil;}});
 await s.step(45);if(mode==='wander')for(let i=0;i<20;i++){const moving=await s.page.evaluate(()=>{const lab=window.__SCENE__,e=lab.game.world.entities.get(lab.actors.get('z').entity);return (e.motion?.speed??0)>.1;});if(moving)break;await s.step(15);}
 const captures=[];for(let frame=0;frame<8;frame++){await s.step(15);await s.ready();const file=`${out}/${entry.model}-${mode}-${frame}.jpg`;await s.page.screenshot({path:file,type:'jpeg',quality:85});captures.push({frame,file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')});}
 const metrics=await s.metrics();receipt.cells.push({entry,mode,actor:metrics.actors?.z,captures,identityMatched:metrics.actors?.z?.track?.at(-1)?.appearance?.model===entry.model});console.log(entry.model,mode);}catch(error){receipt.errors.push({entry,mode,error:String(error)});console.log('SETUP',entry.model,mode);}}
 receipt.errors.push(...s.errors);
}finally{writeFileSync('docs/reports/final-g/G-17-current.json',JSON.stringify(receipt,null,2)+'\n');}
}

{
/** Current production corpse fixtures; setup is authored, observations are read only. */

const out = 'test-results/final-g/G-14';
mkdirSync(out, { recursive: true });
const result = { ...provenance(), method: 'Authored permanent-corpse fixtures, native updates and renderer geometry bounds; no corpse placement or animation changes.', cells: [], errors: [] };
try {
  for (const tier of ['low']) {
    shared.options.tier=tier;const session=shared;
    try {
      if(!session.isOpen)await session.open();
      for (const [file, frames] of [
        ['tests/scenes/catalog/corpse-placement-pile.json', [180, 600]],
        ['tests/scenes/catalog/l4-corpses-persist.json', [120, 7320]],
      ]) {
        const spec = readSpec(file);
        await session.load(spec);
        let at = 0;
        for (const frame of frames) {
          await session.step(frame - at); at = frame;
          await session.ready();
          const sample = await session.page.evaluate(() => {
            const game = window.__SCENE__.game, world = game.world;
            return { tick: world.tick, corpses: [...world.entities.iterate()].filter(e => e.corpse).map(e => ({ id: e.id, at: { ...e.transform }, health: e.health.current })), layout: window.__SS__.debug.corpseLayout() };
          });
          const captures = [];
          for (const zoom of [.5, 1.5]) {
            await session.page.evaluate(async z => { const a = window.__SS__; a.camera.follow(); a.camera.zoom(z); await a.screenshotReady(); }, zoom);
            const path = `${out}/${tier}-${spec.name}-f${frame}-z${zoom}.png`;
            await session.screenshot(path);
            captures.push({ file: path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') });
          }
          result.cells.push({ tier, case: spec.name, frame, sample, metrics: await session.metrics(), captures });
          console.log(tier, spec.name, frame, sample.corpses.length);
        }
      }
      result.errors.push(...session.errors);
    } catch (error) { result.errors.push({ tier, error: String(error) }); }
    finally {  }
  }
} finally {  writeFileSync('docs/reports/final-g/G-14-low-scenes.json', JSON.stringify(result, null, 2) + '\n'); }
}

}finally{await shared.close();stopServer();}
