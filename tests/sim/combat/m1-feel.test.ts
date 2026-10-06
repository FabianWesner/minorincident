import { expect, test } from 'vitest';
import { arena } from './helpers';
import { emptyInput } from '../../../src/input/InputFrame';
import { Vfx } from '../../../src/render/vfx/Vfx';

test('M1-12 @E05 held attacks link three distinct beats then reset after recovery grace', async () => {
  for (const weapon of ['fists','bat','crowbar','machete','kick']) {
    const w = await arena(); w.combat!.setLoadout([`weapon.${weapon}`],['weapon.kick']);
    const frame = emptyInput(); frame.left.held = true; frame.aim = { x:1,z:0 };
    for (let i=0;i<130;i++) { w.applyInput(frame,'keyboard'); w.update(); }
    const attacks = w.events.events().filter(e => e.type === 'combat.attack');
    expect(attacks.slice(0,4).map(e => e.type === 'combat.attack' && e.combo)).toEqual(weapon === 'kick' ? [0,1,0,1] : weapon === 'fists' ? [0,1,2,4] : [0,1,2,0]);
    w.clearInput(); for(let i=0;i<100;i++) w.update(); w.applyInput(frame,'keyboard'); w.update();
    const last = w.events.events().filter(e=>e.type==='combat.attack').at(-1)!; if (weapon !== 'fists') expect(last.type==='combat.attack' && last.combo).toBe(0);
  }
});

test('M1-11 M1-12 @E05 connecting hits alternate reactions, kick tumbles into another infected, gore is bounded', async () => {
  const w = await arena(), a = w.spawnDummy('infected.dummy',{x:1,z:0}), b = w.spawnDummy('infected.dummy',{x:2,z:0});
  const fx = new Vfx(w,{ flash(){},detach(){},blood(){},clearGore(){},shake(){} });
  const hit = (actionId:string,knockback=0) => w.combat!.damage.apply({attackId:w.tick+1,actionId,sourceId:1,targetId:a,origin:{x:0,z:0},direction:{x:1,z:0},base:1,multiplier:1,type:'melee',knockback,stagger:.3});
  try {
    const reactions:number[]=[]; for(let i=0;i<5;i++){hit('weapon.fists');reactions.push(w.entities.get(a)!.combat!.reaction!.index%2);w.update();}
    expect(reactions.every((n,i)=>i===0||n!==reactions[i-1])).toBe(true);
    hit('weapon.kick',1.2); expect(w.entities.get(a)!.transform.x).toBeCloseTo(2.2); expect(w.entities.get(b)!.transform.x).toBeCloseTo(2.5); expect(w.entities.get(b)!.combat!.staggerUntil).toBeGreaterThan(w.tick);
    expect(fx.snapshot().lastSpray.direction).toEqual({x:1,z:0}); expect(fx.snapshot().lastSpray.chunks).toBeGreaterThan(0);
    fx.advance(.7);fx.advance(.7);expect(fx.snapshot().pendingSplats).toBe(0);expect(fx.decals.count).toBeGreaterThan(0);
    fx.set({gore:'Off'}); hit('weapon.bat'); fx.advance(1); expect(fx.decals.count).toBe(0); expect(fx.snapshot().lastSpray.chunks).toBe(0);
    fx.set({gore:'Reduced',quality:'low',colorblind:true}); for(let i=0;i<100;i++) hit('weapon.bat'); expect(fx.particles.count).toBeLessThanOrEqual(512); expect(fx.snapshot().lastSpray.chunks).toBe(0);
  } finally { fx.dispose(); }
});

test('@E03-AC20 unarmed retains varied moves across pauses, equal damage, slight kick knockback', async () => {
  const w = await arena(); w.combat!.setLoadout(['weapon.fists'], ['weapon.fists']);
  const frame = emptyInput(); frame.left.down = true; frame.aim = { x: 1, z: 0 };
  const moves: number[] = [], damages: number[] = [], knockbacks: number[] = [];
  for (let i = 0; i < 15; i++) {
    w.applyInput(frame, 'keyboard'); w.update();
    const attack = w.combat!.runner.running.LEFT!;
    moves.push(attack.combo); damages.push(attack.def.damage); knockbacks.push(attack.def.knockback);
    w.clearInput(); for (let tick = 0; tick < 100; tick++) w.update();
  }
  expect(new Set(moves).size).toBe(7); expect(moves.every((move, i) => !i || move !== moves[i - 1])).toBe(true);
  expect(new Set(damages).size).toBe(1); expect(damages[0]).toBeGreaterThan(0);
  // E19 §5.6: kicks shove 1.5–2.5 m; punches only flinch.
  expect(knockbacks[moves.indexOf(2)]).toBeGreaterThanOrEqual(1.5); expect(knockbacks[moves.indexOf(2)]).toBeLessThanOrEqual(2.5); expect(knockbacks[moves.indexOf(0)]).toBeLessThan(.5); expect(moves.filter(move => move === 6).length).toBe(2);
});


test('@E03-AC19 Shift melee never finishes a civilian in the glowing-eye state', async () => {
  const w = await arena(); w.loadScenario('horde-arena', 1);
  w.combat!.setLoadout(['weapon.fists'], ['weapon.fists']);
  const id = w.npcs!.civilians.spawn('cashier', { x: .8, z: 0 }), e = w.entities.get(id)!;
  Object.assign(e.civilian!, { state: 'down', entered: w.tick, until: w.tick + 60, downTicks: 60, eyesGlow: true });
  const frame = emptyInput(); frame.left.down = true; frame.attackInPlace = true; frame.aim = { x: 1, z: 0 };
  w.applyInput(frame, 'keyboard'); w.update(); w.clearInput();
  for (let i = 0; i < 14; i++) w.update();
  expect(e.civilian!.eyesGlow).toBe(true); expect(e.civilian!.state).toBe('down');
  expect(e.health.current).toBe(100);
  expect(w.events.events().some(event => event.type === 'civilian.finished' || event.type === 'civilian.turned' || ((event.type === 'combat.hit' || event.type === 'combat.kill') && event.targetId === id))).toBe(false);
});
