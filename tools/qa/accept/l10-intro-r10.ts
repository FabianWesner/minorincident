import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';
import { PathProbe } from '../threat/observer';
import { provenance, type NativeReceipt } from './probe';
import { atomicJson } from './report';
import { NavGrid } from '../../../src/sim/ai/NavGrid';

const identity = provenance(), rows = [];
for (const tier of ['low', 'high'] as const) {
  const control = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L10-${tier}-complete.json`, 'utf8')) as NativeReceipt;
  assert.equal(control.sourceHash, identity.sourceHash); assert.equal(control.observerHash, identity.observerHash);
  const campaign = preset('L10-default'); campaign.settings.quality = tier;
  const cues: object[] = [], paths = new PathProbe();
  let introduction: object | null = null, finalHash = '';
  const run = await runLevel('L10', 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
    quality: tier,
    beforeBegin: world => {
      world.events.on('mega.cue', event => { if (world.tick <= 7200) cues.push(structuredClone(event)); });
      const update = world.update.bind(world);
      world.update = () => {
        update();
        const pursuit = world.megaPursuit, actor = pursuit?.entity();
        if (introduction || !pursuit || !actor || !pursuit.state.id) return;
        const player = world.entities.get(1)!;
        const direct = Math.hypot(actor.transform.x - player.transform.x, actor.transform.z - player.transform.z);
        const residentPathMetres = paths.distance(pursuit.grid, actor, player.transform);
        // Residency deliberately omits the distant boss. Query the complete
        // authored colliders in this corridor without changing live streaming.
        const min = { x: Math.min(actor.transform.x,player.transform.x)-60, z: Math.min(actor.transform.z,player.transform.z)-60 };
        const max = { x: Math.max(actor.transform.x,player.transform.x)+60, z: Math.max(actor.transform.z,player.transform.z)+60 };
        const bounds = world.districts!.nav;
        min.x=Math.max(min.x,bounds.min[0]); min.z=Math.max(min.z,bounds.min[1]);
        max.x=Math.min(max.x,bounds.max[0]); max.z=Math.min(max.z,bounds.max[1]);
        const ground = { width:max.x-min.x, depth:max.z-min.z }, center = { x:(min.x+max.x)/2, z:(min.z+max.z)/2 };
        const walls = world.districts!.districts.flatMap(d=>d.decay.colliders.filter(c=>!c.walkable).map(c=>c.aabb).concat(d.blockers).filter(a=>!a.physicsOnly).map(a=>({
          x:(a.min[0]+a.max[0])/2+d.origin[0], z:(a.min[2]+a.max[2])/2+d.origin[1], y:(a.min[1]+a.max[1])/2,
          halfX:(a.max[0]-a.min[0])/2, halfZ:(a.max[2]-a.min[2])/2, halfY:(a.max[1]-a.min[1])/2, ...(a.navBlocker?{navBlocker:true}:{}),
        })));
        const full = new NavGrid(ground,walls,pursuit.radius,center);
        const pathMetres = paths.distance(full,actor,player.transform);
        const cut = { x:center.x,z:center.z,y:1,halfX:1,halfZ:ground.depth,halfY:1 };
        const severed = new NavGrid(ground,[...walls,cut],pursuit.radius,center);
        const negativePath = paths.distance(severed,actor,player.transform);
        assert(!Number.isFinite(negativePath), 'A full-width blocking wall must sever the independent route');
        introduction = { tick: pursuit.state.introducedAt, observedTick: world.tick, id: actor.id, position: { ...actor.transform }, player: { ...player.transform },
          direct, radius: actor.combat?.radius, pathMetres: Number.isFinite(pathMetres) ? pathMetres : null, hidden: actor.infected?.hidden,
          residentPathMetres:Number.isFinite(residentPathMetres)?residentPathMetres:null,
          fullSourceRoute:{ground,center,clearance:pursuit.radius,wallCount:walls.length,wallsSha256:createHash('sha256').update(JSON.stringify(walls)).digest('hex'),severedControlRejected:true},
          grid: { width: pursuit.grid.ground.width, depth: pursuit.grid.ground.depth, center: { ...pursuit.grid.center }, clearance: pursuit.grid.clearance, mask: !!pursuit.grid.mask } };
      };
    },
    beforeDispose: world => { finalHash = stateHash(world.getState()); },
  });
  assert(run.completed); assert.equal(finalHash, control.nativeStateHash, 'intro observation must preserve canonical control');
  rows.push({ tier, introduction, cues, nativeStateHash: finalHash, controlIdentical: true });
  console.log(tier, { introduction, cues: cues.slice(0, 4) });
}
atomicJson('docs/reports/fix51-r10c/L10-introduction-proof.json', { ...identity,
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  method: 'Read-only ordinary competent native routes, both tiers. Capture first persistent Mega appearance and actual roar/impact events through120s. Independent own-clearance path query uses all authored district colliders, including nonresident chunks, within a60m-padded introduction corridor; live residency and actor state are untouched. A full-width inserted wall must disconnect the route. The original resident-only query remains diagnostic. Final state equals canonical control.', rows });
