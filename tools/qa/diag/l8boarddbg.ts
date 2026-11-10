/* eslint-disable @typescript-eslint/no-explicit-any -- one-off diagnostic (r27-l8board) */
// Usage: node --import tsx/esm tools/qa/diag/l8boarddbg.ts [seed] [atS]  -- why does the boarding head get no corpse detour
import { loadLevel } from '../../sim-runner/levels';
import { followFrustum } from '../../sim-runner/l3Bots';
import { LevelEightBot } from '../../../src/debug/bot/LevelEightBot';
import { preset } from '../../../src/sim/progression/Campaign';
import { corpseDetour } from '../../../src/sim/missions/missionHelpers';
import { actorRadius, solidLargeCorpse } from '../../../src/sim/world/SolidRegistry';
const seed = Number(process.argv[2] ?? 1), at = Number(process.argv[3] ?? 552);
const campaign: any = preset('L8-default' as any); campaign.seed = seed; campaign.settings.quality = 'low';
const w: any = await loadLevel('L8', seed, campaign, 0, { quality: 'low' } as any);
const bot: any = new LevelEightBot(w, 'complete'); const zoo = w.missions.l8;
for (let i = 0; i < at * 60; i++) { followFrustum(w); w.applyInput(bot.sample(), 'keyboard'); w.update(); }
const id = zoo.passengers().find((p: number) => w.entities.get(p)?.companion) ?? zoo.passengers()[0];
const head = w.entities.get(id), door = w.vehicles.passengerDoor(zoo.state.carId);
console.log('head', id, JSON.stringify(head.transform), 'door', JSON.stringify(door), 'r', actorRadius(head));
console.log([...w.entities.iterate()].filter((b: any) => solidLargeCorpse(b)).map((b: any) => `${b.id}@${b.transform.x.toFixed(1)},${b.transform.z.toFixed(1)} r=${actorRadius(b)}`));
console.log('blocking', w.solids.blockingBody(id)?.id, 'detour', JSON.stringify(corpseDetour(w, head, door)));
console.log('clear(bodies)', w.solids.clear(head.transform, actorRadius(head), id), 'clear(no bodies)', w.solids.clear(head.transform, actorRadius(head), id, false));
for (let k = 0; k < 360; k++) {
  followFrustum(w); w.applyInput(bot.sample(), 'keyboard'); w.update();
  if (k % 15) continue;
  const h = w.entities.get(id), st = h.locomotion, d = zoo.boardingDetours.get(id);
  console.log(k, h.transform.x.toFixed(2), h.transform.z.toFixed(2), 'yaw', h.transform.yaw.toFixed(2), 'v', st?.vx?.toFixed(2), st?.vz?.toFixed(2), 'block', w.solids.blockingBody(id)?.id, 'ex', h.contactExempt, 'detour', d?.path.length, JSON.stringify(d?.path[0]));
}
process.exit(0);
