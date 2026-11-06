/** fix69-r diagnostic: per-tick move intent vs resolved motion for one L7 follower right after pickup. Read-only replay. */
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
const id = Number(process.argv[2] ?? 64), from = Number(process.argv[3] ?? 0), span = Number(process.argv[4] ?? 90);
const campaign = preset('L7-default'); campaign.seed = 1; campaign.settings.quality = 'low';
let start = -1;
await runLevel('L7', 'complete', 1, undefined, 'auto', campaign, undefined, 0, { quality: 'low', passive: true, beforeBegin: w => {
  const old = w.update.bind(w);
  w.update = () => {
    const npcs = w.npcs!;
    if (!(npcs as unknown as { traced?: boolean }).traced) {
      (npcs as unknown as { traced?: boolean }).traced = true;
      const move = npcs.move.bind(npcs);
      npcs.move = (e, target, speed, path, stop, budget, nav) => {
        const before = { x: e.transform.x, z: e.transform.z };
        const ok = move(e, target, speed, path, stop, budget, nav);
        if (e.id === id && start >= 0 && w.tick - start >= from && w.tick - start < from + span) {
          const p = w.entities.get(1)!.transform;
          let near = 99; for (const o of w.infected!.active) if (o.health.current > 0) near = Math.min(near, Math.hypot(o.transform.x - e.transform.x, o.transform.z - e.transform.z));
          let civ = 99; for (const o of w.entities.iterate()) if (o.civilian && o.id !== e.id && o.health.current > 0) civ = Math.min(civ, Math.hypot(o.transform.x - e.transform.x, o.transform.z - e.transform.z));
          console.log(JSON.stringify({ t: w.tick - start, ok, speed: +speed.toFixed(2), tx: +target.x.toFixed(2), tz: +target.z.toFixed(2), dT: +Math.hypot(target.x - e.transform.x, target.z - e.transform.z).toFixed(2),
            step: +(Math.hypot(e.transform.x - before.x, e.transform.z - before.z) * 60).toFixed(2), lv: e.locomotion ? +Math.hypot(e.locomotion.vx, e.locomotion.vz).toFixed(2) : null,
            x: +e.transform.x.toFixed(2), z: +e.transform.z.toFixed(2), px: +p.x.toFixed(2), pz: +p.z.toFixed(2), nearInf: +near.toFixed(2), nearCiv: +civ.toFixed(2) }));
        }
        return ok;
      };
    }
    old();
    if (start < 0 && w.missions!.state.steps.corridor?.status === 'active') start = w.tick;
  };
} });
