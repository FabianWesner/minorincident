// Read-only prediction of the next normal arena-projectile solid-cover query.
window.__s42Cover = { blocks: [], flights: [], error: null };
const coverSeen = new Set();
const sampleCover = () => {
  try {
    const w = g.world;
    for (const e of w.infected?.active ?? []) {
      const a = e.infected?.specialAttack, f = a?.projectile;
      if (!f || f.fromY === undefined || a.move !== 'gorilla.grab-throw' || coverSeen.has(a.attackId)) continue;
      if (w.tick + 1 <= f.started) continue; // Lifted props exist before launch; never extrapolate backwards.
      const next = Math.min(f.range, (w.tick + 1 - f.started) * (f.speed ?? 12) / 60);
      const point = d => { const t = d / f.range, x = f.x + f.dx * d, z = f.z + f.dz * d, floor = w.districts?.groundHeight(x, z) ?? 0; return { x, z, y: f.fromY * (1 - t) + (f.toY ?? floor) * t + Math.sin(Math.PI * t) * 1.2 }; };
      const from = point(f.distance), to = point(next);
      window.__s42Cover.flights.push({ tick: w.tick, attackId: a.attackId, from, to, target: { ...a.target }, distance: f.distance, range: f.range });
      if (window.__s42Cover.flights.length > 120) window.__s42Cover.flights.shift();
      if (w.combat.query.visible(from, to)) continue;
      coverSeen.add(a.attackId);
      const pillars = (w.destruction?.objects ?? []).filter(o => o.id.includes('l8-gorilla-pillar') && !o.state.collapsed).map(o => ({ id: o.id, x: o.home.p[0], z: o.home.p[2], distance: Math.hypot(to.x - o.home.p[0], to.z - o.home.p[2]) })).sort((u, v) => u.distance - v.distance);
      window.__s42Cover.blocks.push({ tick: w.tick, attackId: a.attackId, from, to, distance: f.distance, range: f.range, pillar: pillars[0], playerHp: w.entities.get(1)?.health.current });
      window.__s42Shot = { tick: w.tick, id: e.id, move: 'gorilla.cover-block', stage: 'solid' };
    }
  } catch (error) { window.__s42Cover.error = String(error); }
  requestAnimationFrame(sampleCover);
};
requestAnimationFrame(sampleCover);
