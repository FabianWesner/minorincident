/** Native investigation of L3's real checkpoint restore and crowded ramp. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadLevel } from '../sim-runner/levels';
import { followFrustum } from '../sim-runner/l3Bots';
import { LevelThreeBot } from '../../src/debug/bot/LevelThreeBot';
import { strikeAt } from '../../src/debug/bot/helpers';
import { emptyInput } from '../../src/input/InputFrame';
import { highwayPoint } from '../../src/levels/L3/highway';
import type { SimWorld } from '../../src/sim/world/SimWorld';

const receipts: unknown[] = [];
function state(w: SimWorld) {
  const p = w.entities.get(1)!;
  return { tick: w.tick, player: { ...p.transform }, hp: p.health.current, pending: p.pendingAdmission,
    blocker: w.solids.blockingBody(1)?.id, failures: w.solids.failures,
    props: w.props!.items.filter(i => Math.hypot(i.pose.p[0] - p.transform.x, i.pose.p[2] - p.transform.z) < 2).map(i => ({ id: i.entityId, asset: i.assetId, pose: { p: [...i.pose.p], q: [...i.pose.q] }, enabled: i.body.isEnabled(), fixed: i.body.isFixed(), velocity: i.body.linvel(), contact: w.physics.playerCollider!.contactCollider(i.collider, .3) })),
    infected: w.infected!.active.filter(e => e.health.current > 0).length,
    downed: w.infected!.active.filter(e => e.health.current <= 0 && e.infected!.recoverAt >= 0).length };
}
mkdirSync('test-results/qa/l3-ramp-restore', { recursive: true });
for (const quality of (process.env.RAMP_TIER ? [process.env.RAMP_TIER as 'low' | 'high'] : ['low', 'high'] as const)) {
  const w = await loadLevel('L3', 1, undefined, 0, { quality });
  try {
    const mission = w.missions!, bot = new LevelThreeBot(w), fixture = `test-results/qa/l3-ramp-restore/checkpoint-${quality}.json`;
    if (process.env.RAMP_CACHE && existsSync(fixture)) mission.loadResume(JSON.parse(readFileSync(fixture, 'utf8')));
    else {
      while (w.tick < 30000 && mission.state.checkpoint !== 'segment-3b') {
        followFrustum(w, 1.5); w.applyInput(bot.sample(), 'keyboard'); w.update();
      }
      writeFileSync(fixture, JSON.stringify(mission.saveResume()));
    }
    if (mission.state.checkpoint !== 'segment-3b') throw new Error('No actual segment-3b snapshot');
    console.log(JSON.stringify({ quality, phase: 'checkpoint', ...state(w) }));
    for (const restore of (process.env.RAMP_OBSTACLES ? ['downed', 'corpses', 'followers', 'props', 'debris', 'crowd', 'linger'] as const : ['death', 'retry'] as const).filter(c => !process.env.RAMP_CASE || c === process.env.RAMP_CASE)) {
      w.clearInput();
      if (restore === 'death') {
        w.player!.damage(1000, w.tick, true);
        for (let t = 0; t < 121; t++) { followFrustum(w, 1.5); w.update(); }
      } else { mission.state.phase = 'retry'; mission.restore(); }
      console.log(JSON.stringify({ quality, phase: restore, ...state(w) }));
      const start = state(w), player = w.entities.get(1)!;
      const nav = w.infected!.nav, route = { path: [] as number[], goal: -1, pathIndex: 0 };
      nav.steer(player.transform, { x: 139, z: 0 }, route, .45, { x: 0, z: 0 }, Infinity, true, 10);
      const ramp = w.districts!.districts.flatMap(d => d.decay.placements).find(p => p.id === 'kit.highway-onramp:991')!;
      const points = [...route.path.map(c => [nav.x(c), 0, nav.z(c)]), [139, 0, 0], ...Array.from({ length: 61 }, (_, i) => highwayPoint(ramp, 1 - i / 60))];
      let waypoint = 0;
      let installed = false, lingered = false;
      for (let tick = 0; tick < 2400 && waypoint < points.length; tick++) {
        if (restore === 'linger' && !lingered && player.transform.x >= 158.5) {
          lingered = true;
          w.setInput({ move: { x: 0, z: 1 } });
          for (let i = 0; i < 35; i++) { followFrustum(w, 1.5); w.update(); }
          for (let i = 0; i < 3600; i++) { const frame = bot.sample(); frame.move = { x: 0, z: 0 }; followFrustum(w, 1.5); w.applyInput(frame, 'keyboard'); w.update(); }
          console.log(JSON.stringify({ quality, restore, phase: 'after-linger', ...state(w) }));
        }
        if (!installed && player.transform.x > 137) {
          installed = true;
          const locations = [[140, .15, 0], [142, .5, 0], ...[.98, .9, .75, .5, .4, .3, .15, .02].map(t => highwayPoint(ramp, t))];
          if (restore === 'downed' || restore === 'corpses' || restore === 'crowd') {
            const actors = w.infected!.active.filter(e => e.health.current > 0).slice(0, locations.length);
            actors.forEach((e, i) => {
              const [x, y, z] = locations[i]!;
              if (restore !== 'crowd') w.combat!.damage.apply({ attackId: 100000 + i, actionId: 'weapon.handgun', sourceId: 1, targetId: e.id, origin: e.transform, direction: { x: 1, z: 0 }, base: 1000, multiplier: 1, type: 'bullet', permanent: restore === 'corpses', knockback: 0, stagger: 0 });
              Object.assign(e.transform, { x, y: y + .7, z }); w.spatial.set(e.id, x, z); w.solids.forget(e);
              if (restore === 'crowd' && e.infected!.l1) { e.infected!.l1.mode = 'chase'; e.infected!.l1.targetId = 1; }
            });
          }
          if (restore === 'followers') {
            const actors = [...w.entities.iterate()].filter(e => e.companion || e.civilian?.ally?.follow?.targetId === 1);
            actors.forEach((e, i) => { const [x, y, z] = locations[i % locations.length]!; Object.assign(e.transform, { x, y: y + (e.companion ? .3 : .7), z }); w.spatial.set(e.id, x, z); w.solids.forget(e); });
          }
          if (restore === 'props') locations.forEach(([x, y, z], i) => w.props!.spawn({ id: `ramp-prop-${i}`, assetId: 'prop.traffic-cone', position: [x, y, z], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: '', visualAabb: { min: [x, y, z], max: [x, y, z] } }));
          if (restore === 'debris') locations.slice(0, 4).forEach(([x, y, z], i) => w.hazards!.debris.spawn(100000 + i, { x, z }, w.tick, { y: y + .1 }));
        }
        const target = points[waypoint]!, dx = target[0] - player.transform.x, dz = target[2] - player.transform.z, distance = Math.hypot(dx, dz);
        if (distance < .4) { waypoint++; continue; }
        // Living infected retain physical contact. Use the carried axe when one
        // intercepts the route; cosmetic bodies and props must clear by movement alone.
        const blocker = w.solids.blockingBody(1), defend = !!blocker?.infected && blocker.health.current > 0;
        const frame = emptyInput(); frame.move = { x: dx / distance, z: dz / distance };
        if (defend) { frame.selectedWeaponKey = 3; strikeAt(frame, blocker!, 'LEFT', player.transform, false); }
        w.applyInput(frame, 'keyboard'); followFrustum(w, 1.5); w.update();
        if (tick % 300 === 299) console.log(JSON.stringify({ quality, restore, waypoint, target, ...state(w) }));
      }
      const receipt = { quality, restore, start, arrived: waypoint === points.length, waypoint, target: points[waypoint], final: state(w) };
      receipts.push(receipt); console.log(JSON.stringify(receipt));
    }
  } finally { w.dispose(); }
}
writeFileSync(`test-results/qa/l3-ramp-restore/${process.env.RAMP_OBSTACLES ? 'obstacles' : 'native'}.json`, JSON.stringify(receipts, null, 2) + '\n');
if (receipts.some(r => !(r as { arrived: boolean }).arrived)) throw new Error('A restored ramp traversal did not arrive; inspect the saved receipt');
