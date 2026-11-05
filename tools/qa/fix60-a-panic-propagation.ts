/** Controlled runner stimulus on existing station civilians, no actor injection. */
import{loadL2}from'../sim-runner/l2Bots';import{emptyInput}from'../../src/input/InputFrame';import{l1v2}from'../../src/data/l1v2';import{writeFileSync}from'node:fs';import{gzipSync}from'node:zlib';import{provenance}from'./accept/probe';
const runs=[];
for(const tier of ['low','high']as const)for(let index=0;index<4;index++){
 const{world:w,mission:m}=await loadL2(1,tier);try{
 const ids=m.state.l2!.benchIds,runner=w.entities.get(ids[index])!,p=runner.transform,o=w.npcs!.civilians.outbreak!;const frames=[];let previous={...p};
 for(let tick=0;tick<30;tick++){w.applyInput(emptyInput(),'keyboard');w.update();}
 const stimulus={id:runner.id,at:{...p},threat:{x:p.x-Math.cos(p.yaw)*5,z:p.z+Math.sin(p.yaw)*5}};o.panic(runner,stimulus.threat);
 for(let i=0;i<600;i++){w.applyInput(emptyInput(),'keyboard');w.update();const speed=Math.hypot(p.x-previous.x,p.z-previous.z)*60;previous={...p};const candidates=ids.filter(id=>id!==runner.id).map(id=>{const e=w.entities.get(id)!,c=e.civilian!,dx=p.x-e.transform.x,dz=p.z-e.transform.z,d=Math.hypot(dx,dz),dot=(dx*Math.cos(e.transform.yaw)-dz*Math.sin(e.transform.yaw))/(d||1),clear=w.combat!.query.visible(e.transform,p,runner.id)&&(!o.blockers||o.blockers.clear(e.transform,p));return{id,state:c.state,at:{...e.transform},distance:d,dot,clear,scripted:!!c.story,canSeeRunner:d<=l1v2.civilians.noticeRangeM&&dot>=Math.cos(l1v2.civilians.noticeConeDeg/2*Math.PI/180)&&clear};});frames.push({tick:w.tick,runner:{id:runner.id,state:runner.civilian!.state,at:{...p},speed},candidates});}
 const visibleCalm=frames.flatMap(f=>f.candidates.filter(c=>c.canSeeRunner&&c.state==='calm'&&!c.scripted&&f.runner.speed>2).map(c=>({tick:f.tick,id:c.id,distance:c.distance,dot:c.dot})));
 runs.push({tier,index,stimulus,frames,visibleCalm});console.log(tier,index,visibleCalm.length,visibleCalm[0]);
 }finally{w.dispose();}}
writeFileSync(process.env.PANIC_PROPAGATION_OUT ?? 'docs/reports/fix60-a/L2-13-propagation-ledger.json.gz',gzipSync(JSON.stringify({...provenance(),method:'Controlled stimulus: panic ONE preexisting bench civilian via production outbreak.panic; all other existing actors untouched. No actor injection/relocation; no infected/gunfire/alarm during ten-second observation. Each tick actual speed, production sight cone/range, combat+outbreak LOS and calm neighbor state. This isolates runner-to-calm propagation, not an ordinary player route.',runs})));
