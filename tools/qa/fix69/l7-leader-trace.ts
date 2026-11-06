/** fix69-r diagnostic: courier per-tick vs half-second displacement during the L7 passive corridor start. Read-only replay. */
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
const campaign = preset('L7-default'); campaign.seed = 1; campaign.settings.quality = 'low';
let start = -1;
const hist: { x: number; z: number }[] = [];
await runLevel('L7', 'complete', 1, undefined, 'auto', campaign, undefined, 0, { quality: 'low', passive: true, beforeBegin: w => {
  const old = w.update.bind(w);
  w.update = () => {
    const before = w.tick, p = w.entities.get(1)!.transform, at = { x: p.x, z: p.z };
    old();
    if (w.tick === before) return;
    if (start < 0 && w.missions!.state.steps.corridor?.status === 'active') start = w.tick;
    if (start < 0) return;
    hist.push({ x: p.x, z: p.z });
    const t = w.tick - start;
    if (t % 30 || t > 1200) return;
    const tickSpeed = Math.hypot(p.x - at.x, p.z - at.z) * 60;
    const back = hist[Math.max(0, hist.length - 31)], windowSpeed = Math.hypot(p.x - back.x, p.z - back.z) * 2;
    let path = 0; for (let i = Math.max(1, hist.length - 30); i < hist.length; i++) path += Math.hypot(hist[i].x - hist[i - 1].x, hist[i].z - hist[i - 1].z);
    let near = 99, touching = 0; for (const o of w.infected!.active) if (o.health.current > 0) { const d = Math.hypot(o.transform.x - p.x, o.transform.z - p.z); near = Math.min(near, d); if (d < 1.2) touching++; }
    console.log(JSON.stringify({ t: t / 60, tickSpeed: +tickSpeed.toFixed(2), windowNet: +windowSpeed.toFixed(2), windowPath: +(path * 2).toFixed(2), x: +p.x.toFixed(2), z: +p.z.toFixed(2), near: +near.toFixed(2), touching }));
  };
} });
