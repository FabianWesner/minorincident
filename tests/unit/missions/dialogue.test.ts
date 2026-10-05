import { expect, test } from 'vitest';
import { dialogue } from '../../../src/data/dialogue';
import { campaignMission, missionIds } from '../../../src/levels/missions';
import { validateMission } from '../../../src/sim/missions/schema';
import type { ScriptAction } from '../../../src/sim/missions/types';
test('T-E12-10 @E12 @E12-AC10 every campaign radio line has a stable existing subtitle ID',()=>{
  const used=new Set<string>();
  for(const id of missionIds){
    const def=campaignMission(id,()=>({x:0,z:0,radius:2}));expect(validateMission(def)).toEqual([]);
    const lists:ScriptAction[][]=[def.onStart,def.onComplete,...def.steps.flatMap(s=>[s.onStart??[],s.onComplete??[],s.onFail??[]]),...Object.values(def.cinematics).map(c=>c.actions)];
    for(const actions of lists)for(const a of actions)if(a.kind==='radio'){used.add(a.id);expect(dialogue[a.id]).toBeTruthy();}
  }
  expect(used.size).toBeGreaterThanOrEqual(12);
});
