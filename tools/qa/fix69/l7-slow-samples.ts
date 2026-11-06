/** fix69-r diagnostic: why do L7 passive followers walk slower with the opening pack at x259? Read-only replay. */
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
const out: Record<string, unknown>[] = [];
const campaign = preset('L7-default'); campaign.seed = 1; campaign.settings.quality = 'low';
await runLevel('L7', 'complete', 1, undefined, 'auto', campaign, undefined, 0, { quality: 'low', passive: true, beforeBegin: w => {
  const old = w.update.bind(w);
  w.update = () => {
    const before = w.tick, p = w.entities.get(1)!.transform, at = { x: p.x, z: p.z };
    old();
    if (w.tick === before || w.tick % 30 || w.missions!.state.steps.corridor?.status !== 'active' || w.storyLock) return;
    const leaderSpeed = Math.hypot(p.x - at.x, p.z - at.z) * 60;
    if (leaderSpeed <= .2) return;
    for (const e of w.entities.iterate()) {
      const c = e.civilian; if (!c?.survivor || c.survivor.mode !== 'follow' || e.health.current <= 0 || !e.motion) continue;
      if (e.motion.speed > leaderSpeed * .9) continue;
      let near = 99, close = 0;
      for (const o of w.infected!.active) if (o.health.current > 0) { const d = Math.hypot(o.transform.x - e.transform.x, o.transform.z - e.transform.z); near = Math.min(near, d); if (d < 1.2) close++; }
      out.push({ t: +(w.tick / 60).toFixed(1), id: e.id, speed: +e.motion.speed.toFixed(2), leader: +leaderSpeed.toFixed(2), state: c.state,
        stagger: (e.combat?.staggerUntil ?? 0) > w.tick, knocked: (c.knockedUntil ?? 0) > w.tick, statuses: (e.combat?.statuses ?? []).map(s => s.kind),
        hp: e.health.current, nearInf: +near.toFixed(2), within1_2: close, dLeader: +Math.hypot(e.transform.x - p.x, e.transform.z - p.z).toFixed(1),
        x: +e.transform.x.toFixed(1), z: +e.transform.z.toFixed(1), px: +p.x.toFixed(1) });
    }
  };
} });
for (const r of out) console.log(JSON.stringify(r));
