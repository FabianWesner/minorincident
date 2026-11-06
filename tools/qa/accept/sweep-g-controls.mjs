/** Physical desktop controls, with a read-only input/attack/facing trace. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SceneSession, stopServer } from '../../scenelab/session.ts';
import { provenance } from './probe.ts';
const out='test-results/sweep-g/G-15';mkdirSync(out,{recursive:true});
const receipt={...provenance(),method:'Isolated production courier with requested weapon; physical Playwright WASD/mouse only, fixed60Hz simulation stepping; read-only input/attack/render-yaw samples. Camera follows courier; no injected InputFrame.',cells:[],errors:[]};
try{for(const tier of ['low','high']){
 const s=new SceneSession({backend:'webgl2',tier});try{await s.open();
 for(const weapon of ['weapon.bat','weapon.handgun','weapon.rocket-launcher']){
  await s.load({name:'G-15-'+weapon,ground:'sidewalk',size:80,time:'L3',actors:[{id:'courier',kind:'courier',at:[0,0],look:{model:'female',gearTier:0},loadout:[[weapon],['weapon.kick']]}],camera:{mode:'follow',actor:'courier',zoom:1.5},frames:1});
  await s.page.evaluate(()=>{const g=window.__SCENE__.game;g.input.clear();g.world.clearInput();window.__SS__.settings.set({aimAssist:'Off'});window.__sweepAttacks=[];g.world.events.on('combat.attack',e=>{if(e.sourceId===1)window.__sweepAttacks.push({tick:e.tick,actionId:e.actionId,direction:{...e.direction},aim:{...g.world.inputFrame.aim}});});});
  const cell={tier,weapon,samples:[],captures:[]};
  async function observe(stage,index){return s.page.evaluate(({stage,index})=>{const g=window.__SCENE__.game,p=g.world.entities.get(1),f=g.world.inputFrame,pose=g.view.labProbes().character.getState();return{stage,index,tick:g.world.tick,position:{...p.transform},velocity:{...p.survivor.velocity},renderYaw:pose.yaw,move:{...f.move},aim:{...f.aim},left:{...f.left},aimSource:f.aimSource,mouseAttack:f.mouseAttack??false,moveTarget:f.moveTarget??null};},{stage,index});}
  async function frames(stage,count){for(let i=0;i<count;i++){await s.page.evaluate(()=>window.__SS__.step(1));cell.samples.push(await observe(stage,i));}}
  async function capture(stage){const file=`${out}/${tier}-${weapon}-${stage}.png`;await s.screenshot(file);cell.captures.push({stage,file,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')});}
  await frames('idle',30);const cursor=await s.page.evaluate(()=>{const g=window.__SCENE__.game,p=g.world.entities.get(1).transform,a=g.view.view.azimuth;return window.__SS__.input.project({x:p.x+Math.cos(a)*1.5,z:p.z-Math.sin(a)*1.5},'destination');});
  cell.cursor=cursor;cell.canvasHit=await s.page.evaluate(at=>document.elementFromPoint(at.x,at.y)===window.__SCENE__.game.view.renderer.domElement, cursor);if(!cell.canvasHit)throw Error('Projected pointer target misses canvas');await s.page.mouse.move(cursor.x,cursor.y);await s.page.mouse.down();await frames('ground-click',1);await s.page.mouse.up();await frames('click-without-WASD',60);await capture('click');
  await s.page.keyboard.down('KeyA');await frames('move-only',60);await capture('move');
  await s.page.mouse.down();await frames('move-aim-held',60);await capture('held');await s.page.mouse.up();await frames('released',26);await capture('release26');await frames('released-late',20);await capture('release46');await s.page.keyboard.up('KeyA');
  cell.attacks=await s.page.evaluate(()=>window.__sweepAttacks);cell.runtime=await s.page.evaluate(()=>({backend:window.__SS__.perf().backend,quality:window.__SCENE__.game.quality.snapshot().tier}));receipt.cells.push(cell);
 }
 receipt.errors.push(...s.errors);
 }finally{await s.close();}
}}finally{stopServer();writeFileSync('docs/reports/sweep-g/G-15-controls.json',JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify(receipt.cells.map(c=>({tier:c.tier,weapon:c.weapon,attacks:c.attacks.length}))));
