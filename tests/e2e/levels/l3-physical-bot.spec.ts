import {mkdirSync,writeFileSync} from 'node:fs';
import {test,expect,boot,testUrl} from '../fixtures';
const out='test-results/epics/E21';
/** Reuse the single-seed policy as a planner; every movement, attack and interaction goes through DOM input. */
for(const level of ['L3','L4'] as const) test(`T-${level}-physical @${level==='L3'?'E21':'E22'} real keyboard and mouse ${level==='L3'?'completion and group rescue':'alarm visibility'}`,async({page})=>{
 test.setTimeout(900_000);mkdirSync(out,{recursive:true});await boot(page,`${testUrl}&ui=1`);await page.evaluate(async level=>{const a=window.__SS__!;await a.loadLevel(level,{seed:1,progression:level==='L3'?'L3-default':'L4-default'});a.pause();},level);
 await page.getByRole('button',{name:'Begin mission'}).click();await page.evaluate(()=>window.__SS__!.pause());await page.mouse.wheel(0,400);await page.evaluate(()=>window.__SS__!.step(60));
 let held=new Set<string>(),lastL3:{crossedAt?:number;barrierClosedAt?:number}|null=null,lastPursuit=0,closedGroup:{id:number;x:number}[]|null=null,alarm=0,visibleAt=0;
 for(let i=0;i<16000;i++){
  const s=await page.evaluate(()=>{const a=window.__SS__!,m=a.missions.state()!;return{phase:m.phase,scenario:a.getState().scenario,l3:m.l3,l4:m.l4,tick:a.tick(),player:a.getEntity(1)?.transform};});
  if(s.scenario==='L3'&&s.l3)lastL3=s.l3;
  // PO 10-11: entering the ring continues straight into L4 (no reward screen), so completion is doneAt / the scenario change.
  if(level==='L3'&&(['progression','result'].includes(s.phase)||s.scenario!=='L3'||s.l3?.doneAt))break;
  if(level==='L4'&&s.l4?.warAt){alarm=s.l4.warAt;const n=await page.evaluate(()=>{const a=window.__SS__!;return a.query({kind:'infected'}).filter(e=>e.health.current>0&&!e.hidden).filter(e=>{const q=a.camera.project(e.transform.x,e.transform.y+.6,e.transform.z);return Math.abs(q[0])<1&&Math.abs(q[1])<1&&Math.abs(q[2])<1;}).length;});if(n){visibleAt=s.tick;break;}if(s.tick-alarm>600)break;}
  if(i%600===0)console.log(JSON.stringify({level,i,tick:s.tick,phase:s.phase,l3:s.l3?.phase,l4:s.l4?.phase,player:s.player}));
  const p=await page.evaluate(()=>window.__SS__!.bot.plan());
  const dx=p.frame.move.x,dz=p.frame.move.z,x=(dx-dz)/Math.SQRT2,y=(dx+dz)/Math.SQRT2,keys=new Set<string>();
  if(x>.25)keys.add('d');if(x<-.25)keys.add('a');if(y>.25)keys.add('s');if(y<-.25)keys.add('w');if(p.frame.interact)keys.add('e');
  if(p.target&&p.slot>=0){await page.keyboard.up('Shift');held.delete('Shift');keys.add('Shift');await page.keyboard.press(`Digit${p.slot+1}`);const q=await page.evaluate(t=>window.__SS__!.camera.project(t.x,t.y+.6,t.z),p.target);const v=page.viewportSize()!;await page.mouse.move((q[0]+1)*v.width/2,(1-q[1])*v.height/2);await page.mouse.down();}else await page.mouse.up();
  for(const key of held)if(!keys.has(key))await page.keyboard.up(key);for(const key of keys)if(!held.has(key))await page.keyboard.down(key);held=keys;
  // After the ring the game itself unpauses to load L4; a refused step then just ends the walk.
  const stepped=await page.evaluate(()=>window.__SS__!.step(12)).then(()=>true,e=>{if(level==='L3'&&lastL3?.crossedAt)return false;throw e;});if(!stepped)break;
  if(level==='L3'&&s.l3?.finaleAt){const r=await page.evaluate(()=>{const a=window.__SS__!,s=a.missions.state()?.l3,all=a.query({});if(!s)return null;return{tick:a.tick(),visible:all.some(e=>{if(e.kind!=='infected'||e.health.current<=0||e.hidden)return false;const q=a.camera.project(e.transform.x,e.transform.y+.6,e.transform.z);return Math.abs(q[0])<1&&Math.abs(q[1])<1&&Math.abs(q[2])<1;}),group:s.barrierClosedAt?all.filter(e=>e.id===1||e.companion||s.officerIds.includes(e.id)&&e.health.current>0&&e.civilian?.ally&&!e.infection).map(e=>({id:e.id,x:e.transform.x})):null};});if(r?.visible)lastPursuit=r.tick;if(r?.group)closedGroup=r.group;}
 }
 for(const key of held)await page.keyboard.up(key);await page.mouse.up();const m=await page.evaluate(()=>window.__SS__!.missions.state());const l3s=m?.l3??lastL3;
 await page.evaluate(()=>window.__SS__!.screenshotReady());await page.screenshot({path:`${out}/physical-${level}.png`});writeFileSync(`${out}/physical-${level}.json`,JSON.stringify({phase:m?.phase,stats:m?.stats,alarm,visibleAt,lastPursuit,closedGroup,l3:l3s},null,2));
 if(level==='L4'){expect(visibleAt).toBeGreaterThan(alarm);expect((visibleAt-alarm)/60).toBeLessThanOrEqual(10);}else{expect(!!l3s?.crossedAt||['progression','result'].includes(m?.phase??'')).toBe(true);expect(closedGroup).not.toBeNull();expect(closedGroup!.every(e=>e.x>=216)).toBe(true);expect((l3s!.barrierClosedAt!-lastPursuit)/60).toBeLessThanOrEqual(30);}
});
