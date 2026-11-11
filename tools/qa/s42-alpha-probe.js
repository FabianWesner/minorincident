// Read-only real-play probe; install with r28 --setup and read window.__s42Alpha.
window.__s42Alpha = { events: [], error: null };
const previous = new Map();
const sample = () => {
  try {
    for (const e of g.world.entities.values()) {
      const b = e.infected;
      if (!b || !b.alphaType && !['infected.gorilla', 'infected.lion', 'infected.zebra'].includes(e.archetype)) continue;
      const attack = b.specialAttack;
      const state = `${b.state}:${attack?.move ?? ''}:${attack?.stage ?? ''}`;
      if (previous.get(e.id) === state) continue;
      previous.set(e.id, state);
      if (attack) window.__s42Shot = { tick: g.world.tick, id: e.id, move: attack.move, stage: attack.stage };
      window.__s42Alpha.events.push({ tick: g.world.tick, id: e.id, type: b.alphaType ?? e.archetype, state: b.state, move: attack?.move, stage: attack?.stage, x: e.transform.x, z: e.transform.z, hp: e.health.current });
      if (window.__s42Alpha.events.length > 300) window.__s42Alpha.events.shift();
    }
  } catch (error) { window.__s42Alpha.error = String(error); }
  requestAnimationFrame(sample);
};
requestAnimationFrame(sample);
