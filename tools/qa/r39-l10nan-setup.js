window.__fireOn = true;
window.__forceGrab = false;
const w = window; w.__nan = { first: null, ring: [], frames: 0, err: null };
const fin = v => typeof v === 'number' ? (Number.isFinite(v) ? +v.toFixed(3) : String(v)) : v;
const shallow = o => { const r = {}; if (!o) return o; for (const [k, v] of Object.entries(o)) { if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') r[k] = fin(v); else if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length < 8) r[k] = Object.fromEntries(Object.entries(v).map(([a, b]) => [a, fin(b)])); } return r; };
w.__force = { tries: 0, grabbedAt: null, on: !!w.__forceGrab };
const force = () => {
  const f = w.__force; if (!f.on || f.grabbedAt !== null || g.world.tick < 240) return;
  const m = g.world.megaPursuit && g.world.megaPursuit.entity(), p = g.world.entities.get(1); if (!m || !p) return;
  const sp = m.infected.specialAttack;
  if (sp && sp.grabbedId === 1) { f.grabbedAt = g.world.tick; return; }
  if (sp) f.seen = (f.seen || '') .slice(-300) + `${g.world.tick}:${sp.move}/${sp.stage};`;
  if (sp || g.world.tick % 30) return;
  m.transform.x = p.transform.x + .8; m.transform.z = p.transform.z; g.world.spatial.set(m.id, m.transform.x, m.transform.z);
  m.combat.staggerUntil = 0; m.infected.cooldown = 0; m.infected.specialRecoveryUntil = 0; m.infected.specialCooldowns = {}; m.infected.megaStaggerReady = g.world.tick + 400;
  f.tries++; f.ok = (f.ok || '') + (g.world.infected.startSpecial(m.id, 'alpha.grab-throw', { id: 1, x: p.transform.x, z: p.transform.z }, { x: m.transform.x, z: m.transform.z, radius: 1.5, dx: -1, dz: 0 }) ? 'Y' : 'n');
};
w.__ev = []; let evTick = -1;
const evs = () => {
  const list = g.world.events.events(evTick); evTick = g.world.tick;
  for (const e of list) if (/^(explosion|hazard|player\.|prop\.|blast|knock)/.test(e.type) || e.targetId === 1 && e.type !== 'combat.hit' || e.type === 'combat.hit' && e.targetId === 1 && e.amount > 0 || e.type === 'telegraph' && e.move) { w.__ev.push(`${e.tick}:${e.type}${e.move ? '/' + e.move : ''}${e.amount ? '=' + Math.round(e.amount) : ''}${e.kind ? '/' + e.kind : ''}${e.actionId ? '/' + e.actionId : ''}`); if (w.__ev.length > 80) w.__ev.shift(); }
};
w.__stage = { hooked: false, first: null, log: [] };
const nanNode = root => { let bad = null; root.traverse(n => { if (bad) return; for (const v of [n.position.x, n.position.y, n.position.z, n.quaternion.x, n.quaternion.w]) if (!Number.isFinite(v)) { bad = n.name; break; } }); return bad; };
const hook = () => {
  const cv = g.view.character; if (!cv || !cv.characters) return;
  for (const [variant, ch] of cv.characters) {
    if (ch.__hooked) continue; ch.__hooked = true; w.__stage.hooked = true;
    const root = ch.model, an = ch.animator;
    const wrap = (obj, key, label) => { if (!obj || !obj[key]) return; const orig = obj[key].bind(obj); obj[key] = (...args) => {
      const before = nanNode(root); const r = orig(...args); const after = nanNode(root);
      if (!before && after && !w.__stage.first) w.__stage.first = { label, variant, tick: g.world.tick, node: after, args: JSON.stringify(args.map(a => typeof a === 'object' && a ? Object.keys(a).length > 12 ? '[obj]' : a : a)).slice(0, 900),
        acts: label === 'mixer.update' ? an.mixer._actions.filter(a => a.isRunning() || a.getEffectiveWeight() && a.getEffectiveWeight() !== 1).map(a => ({ nanTracks: a._interpolants.map((ip, i) => { const v = Array.from(ip.evaluate(a.time)); return v.some(x => !Number.isFinite(x)) || v.length === 4 && Math.hypot(...v) < 1e-6 ? a.getClip().tracks[i].name + '=' + JSON.stringify(v) : null; }).filter(Boolean).slice(0, 6), pmNaN: a._propertyBindings.map(pb => pb && Array.from(pb.buffer).some(x => !Number.isFinite(x)) ? pb.binding.path + ':' + pb.cumulativeWeight + '/' + pb.cumulativeWeightAdditive + ' ' + JSON.stringify(Array.from(pb.buffer)) : null).filter(Boolean).slice(0, 4), clip: a.getClip().name, dur: a.getClip().duration, t: a.time, w: a.getEffectiveWeight(), ts: a.getEffectiveTimeScale(), ts0: a.timeScale, en: a.enabled, loop: a.loop, run: a.isRunning(), wi: a._weightInterpolant && a._weightInterpolant.parameterPositions, tsi: a._timeScaleInterpolant && a._timeScaleInterpolant.parameterPositions })) : null, mixerTime: an.mixer.time, an: { locoSpeed: an.locoSpeed, phase: an.phase, locoWeight: an.locoWeight, contactWeight: an.contactWeight, lunge: an.lunge, carryWeight: an.carryWeight, mode: an.mode, clip: an.clip, lastTime: an.lastTime, time: an.time } };
      return r; }; };
    wrap(an, 'update', 'animator.update'); wrap(an.ground, 'update', 'ground.update'); wrap(an.ground, 'groundPose', 'ground.groundPose'); wrap(an.mixer, 'update', 'mixer.update');
    wrap(ch.living, 'present', 'living.present'); wrap(ch.aim, 'update', 'aim.update'); wrap(ch.aim, 'aim', 'aim.aim');
    for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(ch.aim))) if (k !== 'constructor' && typeof ch.aim[k] === 'function' && !['update','aim'].includes(k)) wrap(ch.aim, k, 'aim.' + k);
    for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(cv))) if (k !== 'constructor' && typeof cv[k] === 'function' && !['update'].includes(k) && !/^get |^set /.test(k)) { try { wrap(cv, k, 'view.' + k); } catch { /* not wrappable */ } }
    wrap(cv, 'update', 'view.update');
  }
};
w.__fire = { n: 0, at: [] };
const fire = () => {
  if (!w.__fireOn || w.__fire.n >= 8 || g.world.tick < 300 || g.world.tick % 150) return;
  const p = g.world.entities.get(1); if (!p || p.survivor.animation !== 'run') return;
  g.world.hazards.spawn('fire', { x: p.transform.x + p.survivor.velocity.x * .3, z: p.transform.z + p.survivor.velocity.z * .3 }, { duration: 3, radius: 2 }); w.__fire.n++; w.__fire.at.push(g.world.tick);
};
const chk = () => {
  try {
    force(); fire(); evs(); if (!w.__stage.hooked) hook();
    const c = g.view.character, p = g.world.entities.get(1);
    w.__nan.frames++;
    if (c && p) {
      let bad = null;
      c.traverse(n => { if (bad) return; const e = n.matrixWorld.elements; for (let i = 0; i < 16; i++) if (!Number.isFinite(e[i])) { bad = (n.name || n.type) + '@' + (n.parent ? n.parent.name : ''); break; } });
      const local = [c.position.x, c.position.y, c.position.z, ...c.quaternion.toArray(), c.scale.x].map(fin);
      w.__nan.ring.push({ tick: g.world.tick, local, bad, anim: p.survivor && p.survivor.animation, t: [p.transform.x, p.transform.y, p.transform.z, p.transform.yaw].map(fin) });
      if (w.__nan.ring.length > 40) w.__nan.ring.shift();
      if (bad && !w.__nan.first) w.__nan.first = { tick: g.world.tick, node: bad, local, survivor: shallow(p.survivor), combat: shallow(p.combat), ring: w.__nan.ring.slice(-25) };
    }
  } catch (err) { w.__nan.err = String(err && err.stack || err).slice(0, 400); }
  requestAnimationFrame(chk);
};
requestAnimationFrame(chk);
return 'nan-probe installed';
