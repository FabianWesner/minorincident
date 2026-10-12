import { Matrix4 } from 'three';
import { afterEach, expect, test } from 'vitest';
import { l3, l3Anchors } from '../../../src/data/l3';
import { emptyInput } from '../../../src/input/InputFrame';
import { isLiveHuman } from '../../../src/sim/outbreak/humans';
import { loadL3, followFrustum } from '../../../tools/sim-runner/l3Bots';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
let world: SimWorld | undefined;
afterEach(() => world?.dispose());
test('T-E21-rescue @E21 @E21-AC17 boom waits for police and dog, reopens on an outside survivor; bus civilians stand safely', async () => {
  const {world:w,mission:m}=await loadL3(1);world=w;
  const s=m.state.l3!;
  expect(s.waitingIds).toHaveLength(5);
  for(const id of s.waitingIds!) {
    const e=w.entities.get(id)!;
    expect(e.civilian!.state).toBe('calm');expect(e.hidden).toBeFalsy();expect(isLiveHuman(e)).toBe(true);
    expect(w.infected!.hearing.humans.get(id)).toBeUndefined();
    expect(e.transform.x).toBeGreaterThan(l3.map.zoneX);
    m.world.npcs!.civilians.outbreak!.infect(e,0);
    expect(e.infection).toBeUndefined();
  }
  m.completeObjective('armory');m.completeObjective('defend');
  // Isolate closure from the encounter clock: every authored member has already emerged.
  s.finalePacks=l3.finale.packs.map(p=>p[1]);
  const ring=l3Anchors['l3-zone'];
  const place=(id:number,x:number,z=0)=>{const e=w.entities.get(id)!;Object.assign(e.transform,{x,z});w.spatial.set(id,x,z);if(id===1)w.physics.playerBody!.setTranslation({x,y:e.transform.y,z},true);};
  place(1,ring[0]-2.5);
  for(const id of s.officerIds)place(id,l3.map.zoneX+3,id%2?1:-1);
  const dog=[...w.entities.iterate()].find(e=>e.companion)!;
  place(dog.id,l3.finale.barrierX-2);
  const step=()=>{followFrustum(w);w.applyInput(emptyInput(),'keyboard');w.update();};
  step();expect(s.barrierClosedAt??0).toBe(0);
  place(dog.id,l3.map.zoneX+3,2);
  const officer=s.officerIds.at(-1)!;place(officer,l3.finale.barrierX-2,1);
  step();expect(s.barrierClosedAt??0).toBe(0);
  place(officer,l3.map.zoneX+3,1);step();expect(s.barrierClosedAt).toBeGreaterThan(0);
  place(officer,l3.finale.barrierX-2,1);step();expect(s.barrierClosedAt).toBe(0);
  expect(w.events.events().some(e=>e.type==='gate.changed'&&e.id==='l3-army-boom'&&e.open)).toBe(true);
},120_000);

test('T-E21-spawn-deck @E21 emergence tests the elevated silhouette rather than the ground beneath it',async()=>{
  const {world:w}=await loadL3(1);world=w;
  const matrix=new Matrix4().makeOrthographic(-10,10,1,-1,.1,100).multiply(new Matrix4().makeTranslation(0,-5,-10));
  w.infected!.director.setFrustum(matrix.elements);
  expect(w.infected!.director.offscreen({x:0,z:0})).toBe(true);
  expect(w.infected!.director.offscreen({x:0,z:0},5)).toBe(false);
},120_000);
