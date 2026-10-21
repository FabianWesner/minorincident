import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { levelTwoLayouts } from '../../../src/levels/L2/layout';
import { levelThreeLayouts } from '../../../src/levels/L3/layout';
import { levelFourLayouts } from '../../../src/levels/L4/layout';
import { levelFiveLayouts } from '../../../src/levels/L5/layout';
import { levelSevenLayouts } from '../../../src/levels/L7/layout';
import { compositions } from '../../../src/levels/compositions';
import { missionIds, resolveCampaignMission } from '../../../src/levels/missions';
import { DistrictWorld } from '../../../src/sim/world/DistrictWorld';
import { objectiveRingRadius, searchAnchors } from '../../../src/sim/missions/markerAnchor';
import { LevelSixSubway } from '../../../src/sim/missions/LevelSixSubway';
import type { DistrictLayout } from '../../../src/levels/districts/types';
import type { Anchor, MissionDef, Trigger } from '../../../src/sim/missions/types';
import type { Mission } from '../../../src/sim/missions/Mission';

const levels: { id: string; world: DistrictWorld; mission: MissionDef }[] = [];
beforeAll(() => {
  const transforms: Partial<Record<string, (l: DistrictLayout[]) => DistrictLayout[]>> = { L2: levelTwoLayouts, L3: levelThreeLayouts, L4: levelFourLayouts, L5: levelFiveLayouts, L7: levelSevenLayouts };
  for (const id of missionIds) {
    const comp = compositions[id], raw = comp.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8')) as DistrictLayout);
    const world = new DistrictWorld(comp, transforms[id]?.(raw) ?? raw, 1), mission = resolveCampaignMission(id, world);
    if (id === 'L6') for (const x of [90,150,210]) mission.anchors[`wait-${x}`] = { ...LevelSixSubway.gateWait(x), y: .6, radius: 1.7 };
    levels.push({ id, world, mission });
  }
},120_000);
const triggerAnchors = (t: Trigger): string[] => 'anchor' in t ? [t.anchor] : 'triggers' in t ? t.triggers.flatMap(triggerAnchors) : [];
const rings = (m: MissionDef): [string, Anchor][] => [...new Set([
  ...m.steps.filter(s=>s.waypoint!==false).flatMap(s=>[s.anchor,...triggerAnchors(s.complete)]),
  ...Object.keys(m.anchors).filter(n=>n.startsWith('l5-ring-')||n.startsWith('wait-')||n==='l7-corridor-west'),
])].map(n=>[n,m.anchors[n]]);

test('PO 10-21 #2 every objective trigger covers the complete drawn ring, all ten levels', () => {
  for (const {id,mission} of levels) for (const [name,a] of [...rings(mission),...mission.steps.map(s=>[s.anchor,mission.anchors[s.anchor]] as [string,Anchor])]) expect(a.radius,`${id}/${name}`).toBeGreaterThanOrEqual(objectiveRingRadius);
});
test('PO 10-21 #4 every objective ring clears shipped solid geometry at its ground height, all ten levels', () => {
  const overlaps: string[] = [];
  for (const {id,mission,world} of levels) for (const [name,a] of rings(mission)) {
    const ground=world.groundHeight(a.x,a.z);
    for (const d of world.districts) for (const c of d.decay.colliders) {
      if(c.walkable||c.aabb.navOnly||c.aabb.max[1]<=ground+.1||c.aabb.min[1]>=ground+1.8)continue;
      const x=Math.max(c.aabb.min[0]+d.origin[0],Math.min(c.aabb.max[0]+d.origin[0],a.x)),z=Math.max(c.aabb.min[2]+d.origin[1],Math.min(c.aabb.max[2]+d.origin[1],a.z));
      if(Math.hypot(x-a.x,z-a.z)<objectiveRingRadius-.001)overlaps.push(`${id}/${name}: ${c.id}`);
    }
  }
  expect(overlaps).toEqual([]);
});
test('PO 10-21 #3 the complete Metro ring lies inside its true stair arrival box', () => {
  const m=levels.find(l=>l.id==='L5')!.mission,a=m.anchors['l5-metro-in'],door=m.anchors['l5-metro-shutter'];
  for(let i=0;i<32;i++){
    const x=a.x+Math.cos(i*Math.PI/16)*objectiveRingRadius,z=a.z+Math.sin(i*Math.PI/16)*objectiveRingRadius;
    expect(Math.abs(x-door.x)).toBeLessThanOrEqual(1);expect(z).toBeLessThan(door.z-.65);expect(z).toBeGreaterThan(door.z-5);
  }
});
test('PO 10-21 #5 each hidden L5 search spot has a visible marker at its reachable discovery anchor', () => {
  const {mission:def,world}=levels.find(l=>l.id==='L5')!;
  const keys=['dale','rosa','okafor','mia','sam'];
  const m={def,state:{l5:{phase:'search',survivors:keys.map(key=>({key,status:'hidden'}))}}} as unknown as Mission;
  const markers=searchAnchors(m);expect(markers).toHaveLength(5);
  const exit=def.anchors['l5-out'],reachable=world.nav.flood([exit.x,exit.z]);
  for(const a of markers)expect(reachable[world.nav.index(a.x,a.z)]).toBe(1);
  m.state.l5!.survivors[0].status='following';expect(searchAnchors(m)).toHaveLength(4);
  m.state.l5!.phase='shelter';expect(searchAnchors(m)).toEqual([]);
});

test('PO #90 L8 publishes its boarding objective and waypoint on the mission start frame', () => {
  const mission=levels.find(l=>l.id==='L8')!.mission, escape=mission.steps.find(s=>s.id==='escape')!;
  expect(escape.start).toEqual({kind:'start'});
  expect(escape.text).toMatch(/survivors.*armored vehicle/i);
  expect(escape.waypoint).toBe(true);
  expect(mission.anchors[escape.anchor]).toBeDefined();
});
