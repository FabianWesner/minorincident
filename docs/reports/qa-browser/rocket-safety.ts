/** Isolated mortal fixtures; physical selection, aim and LMB only. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../../../tools/scenelab/session';
const out='docs/reports/qa-browser/rocket-safety';mkdirSync(out,{recursive:true});
const rows:unknown[]=[];
const s=new SceneSession({backend:'webgl2',tier:'low',viewport:{width:1280,height:800},query:{ui:'1'}});
try{
 await s.open();
 for(const tier of ['low','high'] as const)for(const caseName of ['near-aim','forward-four','behind-four','clear-far','early-cover'] as const){
  if(process.env.QA_CASE_FILTER&&caseName!==process.env.QA_CASE_FILTER)continue;
  s.options.tier=tier;
  await s.page.evaluate(tier=>{window.__SCENE__.game.params.set('quality',tier);window.__SS__!.settings.set({quality:tier});},tier);
  await s.load({name:`rocket-${caseName}`,size:60,ground:'asphalt',time:'night',hud:true,dof:false,
   actors:[{id:'courier',kind:'courier',at:[0,0],god:false,loadout:[['weapon.fists'],['weapon.rocket-launcher']]},
    ...(caseName==='forward-four'?[{id:'enemy',kind:'infected' as const,at:[4,0] as [number,number],state:'idle' as const}]:caseName==='behind-four'?[{id:'enemy',kind:'infected' as const,at:[-4,0] as [number,number],state:'idle' as const}]:caseName==='clear-far'?[{id:'enemy',kind:'infected' as const,at:[8,0] as [number,number],state:'idle' as const}]:[])],
   ...(caseName==='early-cover'?{props:[{id:'cover',asset:'prop.cure-drum-stack',at:[3.5,0]}]}:{}),camera:{mode:'follow',actor:'courier',zoom:1.5},frames:0});
  await s.page.evaluate(()=>{document.documentElement.dataset.sceneHud='1';document.querySelectorAll('#hud,.hud').forEach(n=>n.setAttribute('data-scene-hud',''));window.qaSafetyEvents=[];const w=window.__SCENE__.game.world;for(const name of ['combat.attack','combat.empty','combat.hit','combat.kill','combat.exploded'])w.events.on(name,e=>window.qaSafetyEvents.push(e));});
  await s.page.evaluate(scenario=>{if(scenario)window.__SCENE__.game.world.scenario=scenario;window.__SS__!.input.clear();},process.env.QA_SCENARIO??null);await s.page.keyboard.press('Digit7');await s.page.evaluate(()=>window.__SS__!.step(60));
  const before=await s.page.evaluate(()=>{const a=window.__SS__!,w=window.__SCENE__.game.world;return{tick:a.tick(),scenario:w.scenario,slot:{...w.combat.runner.loadout.current('RIGHT')},hp:a.getEntity(1)!.health.current,enemies:a.query({kind:'infected'}).map(e=>({id:e.id,hp:e.health.current,at:{...e.transform}})),god:w.combat.damage.god,backend:a.getState().render.backend,quality:a.getState().render.quality,zoom:a.getState().render.camera.zoom};});
  const aim=await s.page.evaluate(x=>window.__SS__!.input.project({x,z:0},'destination'),caseName==='near-aim'?2:8);
  await s.page.mouse.move(aim.x,aim.y);await s.page.mouse.down();const projectileFrames=await s.page.evaluate(async()=>{const frames=[];for(let i=0;i<24;i++){await window.__SS__!.step(1);frames.push({tick:window.__SS__!.tick(),projectiles:window.__SCENE__.game.world.combat.projectiles.map(p=>({x:p.x,y:p.y,z:p.z,travelled:p.travelled}))});}return frames;});await s.page.mouse.up();await s.ready();
  const file=`${process.env.QA_SCENARIO?process.env.QA_SCENARIO+'-':''}${tier}-${caseName}.jpg`;await s.page.screenshot({path:`${out}/${file}`,type:'jpeg',quality:75});
  await s.page.evaluate(()=>window.__SS__!.step(75));
  const after=await s.page.evaluate(()=>{const a=window.__SS__!,w=window.__SCENE__.game.world;return{tick:a.tick(),scenario:w.scenario,slot:{...w.combat.runner.loadout.current('RIGHT')},hp:a.getEntity(1)!.health.current,hint:document.querySelector('.hud-weapon-hint')?.textContent,events:window.qaSafetyEvents,enemies:a.query({kind:'infected'}).map(e=>({id:e.id,hp:e.health.current,at:{...e.transform}})),blasts:a.explosions.state()};});
  const shots=after.events.filter(e=>e.type==='combat.attack'&&e.sourceId===1&&e.actionId==='weapon.rocket-launcher'),rejected=after.events.filter(e=>e.type==='combat.empty'&&e.reason==='too-close');
  const blocked=caseName==='near-aim'||caseName==='forward-four';
  const hits=after.events.filter(e=>e.type==='combat.hit'&&e.actionId==='weapon.rocket-launcher');
  const seenProjectile=projectileFrames.some(f=>f.projectiles.length>0), disappearedEarly=seenProjectile&&projectileFrames.at(-1)!.projectiles.length===0&&Math.max(...projectileFrames.flatMap(f=>f.projectiles.map(p=>p.travelled)))<5;
  const pass=before.god===false&&before.quality===tier&&(blocked?shots.length===0&&rejected.length>0:shots.length>0)&&(caseName!=='early-cover'||hits.length===0&&after.hp===before.hp&&disappearedEarly&&!after.events.some(e=>e.type==='combat.exploded'));
  rows.push({scenario:process.env.QA_SCENARIO??'scene-lab',tier,caseName,fixture:'Shared production rocket action; isolated physical input, not native mission route proof',file,aim,before,after,projectileFrames,pass});
  console.log(`${tier}/${caseName}: ${pass?'PASS':'FAIL'} shots=${shots.length} rejected=${rejected.length} hits=${hits.length}`);
 }
}catch(error){rows.push({error:String(error)});console.error(error);process.exitCode=1;}
finally{writeFileSync(`${out}/${process.env.QA_SCENARIO??process.env.QA_CASE_FILTER??'receipt'}.json`,JSON.stringify({rows,errors:s.errors},null,2));await s.close();stopServer();}
