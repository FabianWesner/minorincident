/** fix69-r diagnostic: L4 passive perimeter state once breach-south opens. Read-only replay (qa:threat passive policy, low, seed 1). */
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { l4BreachApproaches } from '../../../src/data/l4';
const campaign = preset('L4-default'); campaign.seed = 1; campaign.settings.quality = 'low';
await runLevel('L4', 'complete', 1, 250, 'auto', campaign, undefined, 0, { quality: 'low', passive: true, beforeBegin: w => {
  const old = w.update.bind(w);
  w.update = () => {
    old();
    const s = w.missions?.state.l4; if (!s?.breaches?.south?.openAt || w.tick % 60) return;
    const ai = w.infected!, p = w.entities.get(1)!.transform;
    const south = l4BreachApproaches.filter(a => a.side === 'south').map(a => {
      const at = { x: a.at[0], z: a.at[1] };
      return { at: a.at, d: +Math.hypot(at.x - p.x, at.z - p.z).toFixed(1), off: ai.director.offscreen(at), occ: ai.director.occluded(at) };
    });
    let bodies = 0; for (const e of w.entities.iterate()) if (e.faction === 'infected' && e.health.current <= 0 && !e.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) <= 6) bodies++;
    console.log(JSON.stringify({ t: +(w.tick / 60).toFixed(1), phase: s.phase, step: Object.entries(w.missions!.state.steps).find(([, v]) => v.status === 'active')?.[0], arrivals: s.breaches.south.arrivals ?? 0, pending: s.perimeterPending, perimeterAt: s.perimeterAt ? +(s.perimeterAt / 60).toFixed(1) : null,
      count: ai.director.count, cap: ai.director.cap, reserved: ai.director.reserved, p: [+p.x.toFixed(1), +p.z.toFixed(1)], bodies6: bodies, south }));
  };
} });
