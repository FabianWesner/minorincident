import { expect, test } from 'vitest';
import { l3Anchors } from '../../src/data/l3';
import { l3Roadblocks } from '../../src/levels/L3/layout';
import { emptyInput } from '../../src/input/InputFrame';
import { followFrustum, loadL3 } from '../../tools/sim-runner/l3Bots';

test('@E21 @E21-route L3 wreck lines close both sidewalks for player and NPCs; the connected detour crosses Oak, Boulevard and the elevated highway', async () => {
  const {world:w,mission:m} = await loadL3(1);
  try {
    const nav=w.infected!.nav, path:number[]=[];
    for(const b of l3Roadblocks) for(const radius of [.35,.65]) {
      expect(nav.visible({x:b.x-6,z:b.z},{x:b.x+6,z:b.z},radius)).toBe(false);
      for(let z=b.z-b.halfWidth;z<=b.z+b.halfWidth;z+=.25) expect(nav.clear(b.x,z,radius),`block ${b.x},${z}`).toBe(false);
    }
    for(const e of w.entities.iterate()) if(e.hazard?.kind==='fire') e.hazard.activeUntil=-1;
    const courier=w.entities.get(1)!;
    for(const b of l3Roadblocks) {
      const at={x:b.x-6,y:.72+(w.districts?.groundHeight(b.x-6,b.z)??0),z:b.z};
      Object.assign(courier.transform,at);w.physics.playerBody!.setTranslation(at,true);w.spatial.set(1,at.x,at.z);
      for(let tick=0;tick<180;tick++) {w.applyInput({...emptyInput(),move:{x:1,z:0},walk:true},'keyboard');w.update();}
      expect(courier.transform.x,`physical wreck line ${b.x},${b.z}`).toBeLessThan(b.x-1);
    }
    const start=l3Anchors['l3-start'], end=l3Anchors['l3-zone'];
    const original={x:start[0],y:.72,z:start[1]};Object.assign(courier.transform,original);w.physics.playerBody!.setTranslation(original,true);w.spatial.set(1,original.x,original.z);

    expect(nav.path(nav.nearestCell(...start,.45),nav.nearestCell(...end,.45),path,100000)).toBe(true);
    const points=path.map(i=>({x:nav.x(i),z:nav.z(i)}));
    const length=points.slice(1).reduce((s,p,i)=>s+Math.hypot(p.x-points[i].x,p.z-points[i].z),0);
    expect(length).toBeGreaterThanOrEqual(301*1.5);expect(length).toBeLessThanOrEqual(301*1.8);
    let walkingM=0;
    for(let i=0;i<points.length-1;) {
      let next=i+1;
      for(let k=points.length-1;k>i;k--) if(nav.visible(points[i],points[k],.45)) {next=k;break;}
      walkingM+=Math.hypot(points[next].x-points[i].x,points[next].z-points[i].z);i=next;
    }
    expect(walkingM).toBeGreaterThanOrEqual(296.6*1.5);expect(walkingM).toBeLessThanOrEqual(296.6*1.8);
    expect(points.some(p=>p.x<-60&&p.z>24)).toBe(true);
    expect(points.some(p=>p.x>0&&p.z<-24)).toBe(true);
    expect(points.some(p=>p.x>165&&p.x<180&&w.districts!.groundHeight(p.x,p.z)>5)).toBe(true);
    for(const id of m.state.l3!.officerIds) if(!m.state.l3!.squadIds.includes(id)) w.entities.get(id)!.health.current=0;
    for(const e of w.entities.iterate()) if(e.hazard?.kind==='fire') e.hazard.activeUntil=-1;
    m.completeObjective('armory');m.completeObjective('defend');
    const state=m.state.l3!;state.pending=[];state.waves=[];state.populated=[true,true,true];
    for(const e of w.infected!.active) e.health.current=0;
    // Stop before the compound so the proof observes all officers before normal mission closure.
    const goal={x:207,z:0}, player=w.entities.get(1)!;
    for(let tick=0;tick<12000&&Math.hypot(player.transform.x-goal.x,player.transform.z-goal.z)>1;tick++) {
      // Isolate locomotion from the separate complete-bot combat pass.
      state.pending=[];for(const e of w.infected!.active) e.health.current=0;
      followFrustum(w);w.applyInput({...emptyInput(),moveTarget:goal,navigation:true},'mouse-only');w.update();
      if(tick%120===0 && m.state.marker === 'l3-route') expect(nav.visible(player.transform,m.def.anchors['l3-route'],.35),'objective guides to visible walkable route').toBe(true);
    }
    expect(player.transform.x,JSON.stringify(player.transform)).toBeGreaterThan(205);
    for(let tick=0;tick<300;tick++) {w.applyInput(emptyInput(),'mouse-only');w.update();}
    expect(state.lost.filter(q=>q.cause==='separated')).toHaveLength(0);
    for(const q of state.squad) {
      const e=w.entities.get(q.id)!;
      expect(e.health.current).toBeGreaterThan(0);
      expect(Math.hypot(e.transform.x-player.transform.x,e.transform.z-player.transform.z),JSON.stringify({officer:e.transform,player:player.transform})).toBeLessThanOrEqual(8);
    }
    expect(state.squad).toHaveLength(4);
    expect(m.state.marker).toBe('l3-route');
    const marker=m.def.anchors['l3-route'];
    expect(nav.visible(player.transform,marker,.35)).toBe(true);
  } finally {w.dispose();}
},360000);
