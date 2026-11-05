import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';
import { provenance, type NativeReceipt } from './probe';
import { atomicJson } from './report';
import { ThreatObserver } from '../threat/observer';

const identity = provenance(), rows = [];
const bodyClearance = process.argv.includes('--body-clearance');
const lead = process.argv.includes('--lead');
const side = process.argv.includes('--side');
const humanRouted = process.argv.includes('--human-routed');
const sideOffset = Number(process.env.FIX55_SIDE ?? '1.6');
const trial = process.argv.includes('--limit-waypoint-speed') || bodyClearance || lead || side || humanRouted;
const finalTag = process.argv.includes('--after') ? 'after' : 'trace';
for (const tier of process.argv.includes('--low-only') ? ['low'] as const : ['low', 'high'] as const) {
  const control = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L7-${tier}-complete.json`, 'utf8')) as NativeReceipt;
  assert.equal(control.sourceHash, identity.sourceHash);
  const campaign = preset('L7-default'); campaign.settings.quality = tier;
  const samples: object[] = [];
  let finalHash = '', lastMove: object | null = null;
  let stalledTicks = 0, longestFarStallTicks = 0, maximumLag = 0;
  let threat: ThreatObserver | undefined;
  let pacePhases: object[] = [];
  const run = await runLevel('L7', 'complete', 1, 240, 'auto', campaign, undefined, 0, {
    quality: tier,
    beforeBegin: world => {
      threat = new ThreatObserver(world, 'L7');
      if (process.argv.includes('--limit-waypoint-speed') || humanRouted) {
        const step = world.npcs!.moveStep.bind(world.npcs);
        world.npcs!.moveStep = (actor, dx, dz, nav = world.infected!.nav) => {
          const route = actor.companion ?? (humanRouted && actor.civilian?.survivor?.mode === 'follow' ? actor.civilian : undefined);
          const cell = route?.path[route.pathIndex];
          if (cell !== undefined) {
            const routed = Math.hypot(nav.x(cell)-actor.transform.x, nav.z(cell)-actor.transform.z);
            const scale = Math.min(1, routed*4/(Math.hypot(dx,dz)*60 || 1)); dx *= scale; dz *= scale;
          }
          step(actor, dx, dz, nav);
        };
      }
      const move = world.npcs!.move.bind(world.npcs);
      world.npcs!.move = (...args) => {
        const velocity = world.entities.get(1)!.survivor!.velocity;
        if (lead && args[0].companion && args[4] === 2 && Math.hypot(velocity.x,velocity.z) > 2)
          args[1] = { x: args[1].x + velocity.x*.35, z: args[1].z + velocity.z*.35 };
        if (side && args[0].companion && args[4] === 2 && Math.hypot(velocity.x,velocity.z) > 2) {
          const speed = Math.hypot(velocity.x,velocity.z);
          const target = { x: args[1].x-velocity.z/speed*sideOffset, z: args[1].z+velocity.x/speed*sideOffset };
          if (world.infected!.nav.clear(target.x,target.z,.44)) { args[1] = target; args[4] = .5; }
        }
        let result;
        if (bodyClearance && args[0].companion) {
          const nav = world.infected!.nav;
          const bodyNav = new Proxy(nav, { get(target, key) {
            if (key === 'clear') return (x: number, z: number, radius: number, strict?: boolean) => strict ? false : target.clear(x,z,radius);
            const value = Reflect.get(target,key); return typeof value === 'function' ? value.bind(target) : value;
          } });
          result = move(args[0],args[1],args[2],args[3],args[4],args[5],bodyNav);
        } else result = move(...args);
        if (args[0].companion) lastMove = { tick: world.tick, target: { ...args[1] }, speed: args[2], stop: args[4], result };
        return result;
      };
      const update = world.update.bind(world);
      world.update = () => {
        update();
        const dog = [...world.entities.iterate()].find(actor => actor.companion)!, player = world.entities.get(1)!;
        if (!dog.hidden && dog.passengerOf === undefined && world.missions!.state.phase === 'playing') {
          const lag = Math.hypot(dog.transform.x-player.transform.x, dog.transform.z-player.transform.z);
          maximumLag = Math.max(maximumLag,lag);
          stalledTicks = lag > 6 && (dog.motion?.speed ?? 0) < .05 ? stalledTicks+1 : 0;
          longestFarStallTicks = Math.max(longestFarStallTicks,stalledTicks);
        }
        if (world.tick % 30 || world.missions!.state.steps.departure?.status !== 'active') return;
        const c = dog.companion!, nav = world.infected!.nav;
        samples.push({ tick: world.tick, player: { ...player.transform }, requested: { ...player.survivor!.velocity },
          dog: { ...dog.transform }, speed: dog.motion?.speed, companion: structuredClone(c), lastMove,
          distance: Math.hypot(dog.transform.x-player.transform.x, dog.transform.z-player.transform.z),
          clear: nav.clear(dog.transform.x, dog.transform.z, .35), visible: nav.visible(dog.transform, player.transform, .35),
          route: c.path.map(cell => ({ x: nav.x(cell), z: nav.z(cell) })),
          neighbours: [...world.entities.iterate()].filter(actor => actor.id !== dog.id && Math.hypot(actor.transform.x-dog.transform.x, actor.transform.z-dog.transform.z) < 4).map(actor => ({ id: actor.id, archetype: actor.archetype, hp: actor.health.current, transform: { ...actor.transform }, corpse: actor.corpse, passengerOf: actor.passengerOf })),
        });
      };
    },
    beforeDispose: world => { finalHash = stateHash(world.getState()); pacePhases = threat!.finish().phases.filter(p=>p.key.startsWith('step/')).map(p=>({ key:p.key, followers:p.followerSpeeds })); },
  });
  assert(run.completed); if (!trial) assert.equal(finalHash, control.nativeStateHash, 'read-only companion trace preserves canonical run');
  const path = `docs/reports/fix55-c/G-13-L7-${tier}-${humanRouted ? 'human-routed' : side ? `side-${sideOffset}` : lead ? 'lead' : bodyClearance ? 'body-clearance' : trial ? 'trial' : finalTag}.json.gz`, bytes = gzipSync(JSON.stringify(samples)); writeFileSync(path, bytes);
  rows.push({ tier, run, nativeStateHash: finalHash, controlIdentical: finalHash === control.nativeStateHash, maximumLag, longestFarStallTicks, pacePhases, samples: samples.length, path, sha256: createHash('sha256').update(bytes).digest('hex') });
  console.log(tier, run.outcome, samples.length, 'departure samples; trial=', trial);
}
atomicJson(`docs/reports/fix55-c/G-13-L7-${humanRouted ? 'human-routed' : side ? `side-${sideOffset}` : lead ? 'lead' : bodyClearance ? 'body-clearance' : trial ? 'trial' : finalTag}.json`, { ...identity, trial, sideOffset,
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), rows });
