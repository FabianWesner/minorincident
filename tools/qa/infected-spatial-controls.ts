/** E07 per-move spatial controls, using real Scene Lab actors and solid fences.
 * Run headless through tools/e2e-lock.sh with E2E_UNITS=1. Sim tests retain the
 * exact damage/arc/expiry assertions; these captures prove their browser wiring. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import { infectedSpecialMoves, type InfectedSpecialMove } from '../../src/data/infected';
import type { ActorSpec, SceneSpec } from '../../src/debug/scenelab/spec';
import { SceneSession, stopServer } from '../scenelab/session';

const out = 'test-results/ac-close-shared/spatial'; mkdirSync(out, { recursive: true });
const proof: unknown[] = [];
const s = new SceneSession({ backend: 'webgl2', tier: 'high', viewport: { width: 1280, height: 720 } });
const human = (id: string, x: number, z: number): ActorSpec => ({ id, kind: 'pedestrian', at: [x, z], state: 'idle' });

function fixture(move: InfectedSpecialMove, wall: boolean, outside = false): SceneSpec {
  const timing = infectedSpecialMoves[move], roar = move.endsWith('.roar'), throwing = move.endsWith('grab-throw');
  const actors: ActorSpec[] = [
    { id: 'courier', kind: 'courier', at: [20, 0], god: false, state: 'idle' },
    { id: 'source', kind: 'infected', archetype: timing.archetype, at: [0, 0], yaw: 0, state: 'idle' },
  ];
  const spec: SceneSpec = { name: `${move}-${wall ? 'wall' : outside ? 'outside' : 'boundary'}`, seed: 7, size: 70, time: 'L4', ground: 'asphalt', dof: false,
    actors, props: [], script: [], camera: { mode: 'game', target: [4, 0], zoom: 1 } };
  if (move === 'zebra.stampede' || move === 'flamingo.dive') {
    actors.push({ id: 'member1', kind: 'infected', archetype: timing.archetype, at: [-2, 0], state: 'idle' });
    if (move === 'flamingo.dive') actors.push({ id: 'member2', kind: 'infected', archetype: timing.archetype, at: [0, -2], state: 'idle' });
  }
  if (throwing) {
    actors.push({ id: 'body', kind: 'infected', archetype: 'infected.runner', at: [1, 0], state: 'idle' });
    spec.script!.push({ frame: 0, actor: 'body', do: { corpse: true } });
    actors[0].at = [8, 0];
  }
  if (roar) {
    const radius = move === 'alpha.roar' ? 18 : 20;
    actors[0].at = [0, 6];
    actors.push({ id: 'inside', kind: 'infected', archetype: 'infected.runner', at: [radius - .01, 0], state: 'idle' },
      { id: 'outside', kind: 'infected', archetype: 'infected.runner', at: [-radius - .01, 0], state: 'idle' },
      { id: 'covered', kind: 'infected', archetype: 'infected.runner', at: [12, 0], state: 'idle' });
    spec.camera = { mode: 'game', target: [0, 0], zoom: .5 };
  } else if (move === 'lion.pounce') {
    actors[0].at = [outside ? 20 : 6, 0];
  } else if (move === 'lion.flank') {
    actors[0].at = [8, 0];
  } else if (move === 'flamingo.dive') {
    actors[0].at = [5, 0]; actors.push(human('inside', 5, 2.99), human('outside', 5, -3.01));
  } else if (move === 'alpha.ground-slam' || move === 'gorilla.pound') {
    const radius = move === 'alpha.ground-slam' ? 4 : 5;
    actors.push(human('inside', 0, radius - .01), human('outside', 0, -radius - .01));
    spec.camera = { mode: 'game', target: [0, 0], zoom: 1 };
  } else if (move === 'elephant.swipe') {
    actors.push(human('inside', 1.6, 2.4), human('outside', 1.6, -2.6), human('outside-arc', .4, 2.8));
  } else if (move === 'zebra.kick') {
    actors.push(human('inside', -1.3, 1.3), human('outside', -1.3, -1.6), human('outside-arc', 1.8, 0));
    spec.camera = { mode: 'game', target: [0, 0], zoom: 1.3 };
  } else {
    const halfWidth = move === 'elephant.charge' ? 1.75 : move === 'zebra.stampede' ? .75 : 1;
    actors.push(human('inside', 5, halfWidth - .01), human('outside', 5, -halfWidth - .01));
  }
  if (wall) {
    // Separate wall fixture prevents cover from interfering with the open-space
    // inside/outside controls. The roar is audible through cover; damaging moves
    // and thrown bodies must not hit a courier behind these actual solids.
    const close = move === 'zebra.kick' ? -.9 : move === 'elephant.swipe' ? 1.6 : move === 'alpha.ground-slam' || move === 'gorilla.pound' ? 1.5 : roar ? 6 : 4;
    actors[0].at = [move === 'zebra.kick' ? -1.8 : move === 'elephant.swipe' ? 2.9 : move === 'alpha.ground-slam' || move === 'gorilla.pound' ? 3 : roar ? 0 : 8, roar ? 6 : 0];
    spec.actors = actors.filter(a => ['courier', 'source', 'body', 'covered', 'member1', 'member2'].includes(a.id!));
    spec.props = [-4, -2, 0, 2, 4].map(z => ({ id: `wall-${z}`, asset: 'prop.privacy-fence', at: [close, z], yaw: 0 }));
    spec.camera = { mode: 'game', target: [close, 0], zoom: 1 };
  }
  return spec;
}

async function snapshot() {
  await s.ready();
  return s.page.evaluate(() => {
    const a = window.__SS__!, lab = window.__SCENE__!;
    const w = (lab as unknown as { game: Game }).game.world;
    return { tick: a.tick(), actors: [...lab.actors.values()].map(actor => ({ name: actor.id, entity: a.getEntity(actor.entity)! })),
      controls: { inspectionGhost: w.inspectionGhost, god: w.combat!.damage.god },
      events: a.events().filter(e => ['telegraph', 'infected.special', 'combat.hit', 'infected.roar-buff'].includes(e.type)), markers: a.getState().render.vfx!.telegraphs };
  });
}
async function run(move: InfectedSpecialMove, wall: boolean, outside = false) {
  const spec = fixture(move, wall, outside); await s.load(spec); await s.step(1);
  const before = await s.page.evaluate(({ move, windup }) => {
    const lab = window.__SCENE__!, w = (lab as unknown as { game: Game }).game.world;
    // A cover control needs a live, damageable courier. Inspection ghost mode
    // suppresses player damage and would make that control a false positive.
    w.inspectionGhost = false;
    for (const actor of lab.actors.values()) {
      const e = w.entities.get(actor.entity)!;
      if (e.civilian) { e.civilian.state = 'calm'; e.civilian.pauseUntil = w.tick + 100000; e.civilian.panicReaction = 'freeze'; }
      if (e.infected && actor.id !== 'source') {
        e.infected.until = w.tick + 100000;
        // Range probes must stay on their authored side of a 1 cm boundary.
        // A normal stagger holds these regular infected through the roar's
        // activation; it does not remove their eligibility for the roar buff.
        if (move.endsWith('.roar') && ['inside', 'outside', 'covered'].includes(actor.id)) e.combat!.staggerUntil = w.tick + windup + 1;
      }
    }
    lab.command('source', { special: move, target: 'courier' });
    return [...lab.actors.values()].map(a => ({ name: a.id, entity: structuredClone(w.entities.get(a.entity)!) }));
  }, { move, windup: infectedSpecialMoves[move].windup });
  await s.step(infectedSpecialMoves[move].windup - 1);
  const pre = await snapshot(); await s.screenshot(`${out}/${spec.name}-before.png`);
  assert.deepEqual(pre.controls, { inspectionGhost: false, god: false });
  for (const a of pre.actors.filter(a => a.name !== 'body')) assert.equal(a.entity.health.current, before.find(b => b.name === a.name)!.entity.health.current, `${move}: no windup damage`);
  // End at this move's real recovery boundary, before unrelated ordinary AI can
  // add another attack. Every participant resolves through its normal controller.
  for (let i = 0; i < 181; i++) {
    await s.step(1);
    const pending = await s.page.evaluate(move => {
      const lab = window.__SCENE__!, a = window.__SS__!;
      return [...lab.actors.values()].some(actor => {
        const attack = a.getEntity(actor.entity)?.infected?.specialAttack;
        return attack?.move === move && (attack.stage === 'telegraph' || attack.stage === 'active');
      });
    }, move);
    if (!pending) break;
  }
  const after = await snapshot(); await s.screenshot(`${out}/${spec.name}-after.png`);
  writeFileSync(`${out}/${spec.name}-proof.json`, JSON.stringify({ move, spec, before, pre, after, pass: false }, null, 2));
  const actor = (name: string) => after.actors.find(a => a.name === name)!.entity;
  const hp = (name: string) => before.find(a => a.name === name)!.entity.health.current;
  if (move.endsWith('.roar')) {
    if (wall) assert.ok(actor('covered').infected!.roar, `${move}: audible through cover`);
    else { assert.ok(actor('inside').infected!.roar, `${move}: inside radius`); assert.equal(actor('outside').infected!.roar, undefined, `${move}: outside radius`); }
  } else if (wall || move === 'lion.flank' || outside) {
    assert.equal(actor('courier').health.current, hp('courier'), `${move}: no hit through cover/outside path`);
    if (move === 'lion.pounce' && outside) assert.ok(actor('source').transform.x <= 8.001, 'pounce stops at eight metres');
    if (move === 'lion.flank' && !wall) assert.ok(Math.abs(actor('source').transform.z) > 2, 'flank follows its side destination');
  } else if (move === 'lion.pounce') assert.equal(actor('courier').health.current, hp('courier') - 30);
  else {
    assert.ok(actor('inside').health.current < hp('inside'), `${move}: inside target hit`);
    assert.equal(actor('outside').health.current, hp('outside'), `${move}: outside target untouched`);
    if (after.actors.some(a => a.name === 'outside-arc')) assert.equal(actor('outside-arc').health.current, hp('outside-arc'), `${move}: outside arc`);
  }
  assert.deepEqual(s.errors, []);
  const record = { move, spec, before, pre, after, pass: true };
  proof.push(record);
  writeFileSync(`${out}/${spec.name}-proof.json`, JSON.stringify(record, null, 2));
  writeFileSync(`${out}/proof.json`, JSON.stringify(proof, null, 2));
  console.log(`${spec.name}: pass`);
}
try {
  await s.open();
  const only = process.argv[2];
  for (const move of Object.keys(infectedSpecialMoves) as InfectedSpecialMove[]) {
    if (only && !only.split(',').includes(move)) continue;
    if (!process.argv.includes('--wall-only')) {
      await run(move, false);
      if (move === 'lion.pounce') await run(move, false, true);
    }
    await run(move, true);
  }
} finally { await s.close(); stopServer(); }
