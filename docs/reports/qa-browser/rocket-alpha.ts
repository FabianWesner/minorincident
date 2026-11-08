/** Controlled health check: production L7 spawn and rockets, stationary isolated target. */
import { mkdirSync,writeFileSync } from 'node:fs';
import { SceneSession,stopServer } from '../../../tools/scenelab/session';
const out='docs/reports/qa-browser/rocket-safety';mkdirSync(out,{recursive:true});const rows=[];
const s=new SceneSession({backend:'webgl2',tier:'low',viewport:{width:1280,height:800},query:{ui:'1'}});
try{await s.open();for(const tier of ['low','high'] as const){
 s.options.tier=tier;await s.load({name:'L7-alpha-direct',size:60,time:'night',ground:'asphalt',hud:true,dof:false,actors:[{id:'courier',kind:'courier',at:[0,0],god:false,loadout:[['weapon.fists'],['weapon.rocket-launcher']]}],camera:{mode:'follow',actor:'courier',zoom:1.5},frames:0});
 await s.page.evaluate(()=>window.__SS__!.input.clear());await s.page.keyboard.press('Digit7');await s.page.evaluate(()=>window.__SS__!.step(60));
 const before=await s.page.evaluate(()=>{const a=window.__SS__!,w=window.__SCENE__.game.world;w.scenario='L7';const id=a.spawn('infected.alpha',{x:8,z:0});window.qaAlpha=id;window.qaAlphaEvents=[];w.events.on('combat.attack',e=>window.qaAlphaEvents.push(e));w.events.on('combat.hit',e=>window.qaAlphaEvents.push({...e,hp:w.entities.get(id).health.current}));w.infected.update=()=>{};return{id,hp:w.entities.get(id).health,method:'Native L7 spawn sets 450 HP; AI update disabled only for stationary direct-hit isolation. Physical Digit7, aim and LMB; no player god mode or health writes.'};});
 await s.ready();const aim=await s.page.evaluate(()=>window.__SS__!.input.project({x:8,z:0},'destination'));await s.page.mouse.move(aim.x,aim.y);await s.page.mouse.down();
 for(let i=0;i<170;i++){const alive=await s.page.evaluate(async()=>{await window.__SS__!.step(1);return window.__SCENE__.game.world.entities.get(window.qaAlpha).health.current>0;});if([40,90,140].includes(i))await s.page.screenshot({path:`${out}/alpha-${tier}-${i}.jpg`,type:'jpeg',quality:75});if(!alive)break;}
 await s.page.mouse.up();const after=await s.page.evaluate(()=>{const w=window.__SCENE__.game.world,e=w.entities.get(window.qaAlpha);return{hp:e.health,events:window.qaAlphaEvents,god:w.combat.damage.god,quality:window.__SS__!.getState().render.quality};});
 const hits=after.events.filter(e=>e.type==='combat.hit'&&e.targetId===before.id&&e.actionId==='weapon.rocket-launcher');const shots=after.events.filter(e=>e.type==='combat.attack'&&e.sourceId===1&&e.actionId==='weapon.rocket-launcher');
 rows.push({tier,before,after,hits,shots,pass:before.hp.max===450&&hits.length===3&&hits[0].hp>0&&hits[1].hp>0&&hits[2].hp===0&&shots.slice(1).every((e,i)=>e.tick-shots[i].tick===50)});console.log(tier,rows.at(-1).pass,hits.map(e=>({tick:e.tick,hp:e.hp,amount:e.amount})));
 }}catch(error){rows.push({error:String(error)});process.exitCode=1;console.error(error);}finally{writeFileSync(`${out}/alpha.json`,JSON.stringify({rows,errors:s.errors},null,2));await s.close();stopServer();}
