// Shared world systems: interaction rings/devices/doors, pickups, explosions/hazards and barricades are authored in
// every level from the same catalogs. Each test drives the real system through a scenario.
import { afterEach, expect, test } from 'vitest';
import { blastDamage, explosionDef } from '../../src/data/explosions';
import { destructionDamage, destructionMaterial } from '../../src/data/destruction';
import type { Pickup } from '../../src/sim/interact/Pickups';
import { NavGrid } from '../../src/sim/world/NavGrid';
import type { GameEvent } from '../../src/sim/world/types';
import { BoxGeometry, Group, Mesh, MeshBasicNodeMaterial } from 'three/webgpu';
import { DestructionView } from '../../src/render/DestructionView';
import { loadL3 } from '../../tools/sim-runner/l3Bots';
import { rotate } from '../../src/sim/destruction/Destruction';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { verifyDestructionRollout } from './destruction-rollout.fixture';

const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds.splice(0)) w.dispose(); });
async function world(name = 'combat-arena', god = false) { const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario(name, 1); if (w.combat) w.combat.damage.god = god; return w; }
const step = (w: SimWorld, n: number) => { for (let i = 0; i < n; i++) w.update(); };
const events = <T extends GameEvent['type']>(w: SimWorld, type: T) => w.events.events().filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
function move(w: SimWorld, x: number, z = 0) { const p = w.entities.get(1)!; Object.assign(p.transform, { x, z }); w.physics.playerBody!.setTranslation(p.transform, true); w.spatial.set(1, x, z); }

test('interaction: rings fill and decay, complete once, nearest instant wins in range, damage floors interruptible progress', async () => {
  const w = await world(), id = w.interactables!.spawn('switch', { x: 0, z: 0 }, { holdTime: 2 });
  step(w, 60); expect(w.entities.get(id)!.interactable!.progress).toBeCloseTo(.5);
  move(w, 4); step(w, 15); expect(w.entities.get(id)!.interactable!.progress).toBeCloseTo(.25);
  move(w, 0); step(w, 90); expect(w.entities.get(id)!.interactable!.progress).toBe(1);
  step(w, 120); expect(events(w, 'interact.completed')).toHaveLength(1);

  const n = await world(), a = n.interactables!.spawn('button', { x: .2, z: 0 }), b = n.interactables!.spawn('radio', { x: .8, z: 0 });
  n.setInput({ interact: true }); step(n, 1); n.clearInput();
  expect(n.entities.get(a)!.interactable!.completed).toBe(true); expect(n.entities.get(b)!.interactable!.progress).toBe(0);

  const g = await world(), gen = g.interactables!.spawn('generator', { x: 0, z: 0 }, { holdTime: 4, fuel: 10 });
  step(g, 155); g.player!.damage(1, g.tick);
  expect(g.entities.get(gen)!.interactable!.progress).toBe(.5);
});

test('doors: locked hint, key requirement, open/close updates navigation and colliders in the same tick', async () => {
  const w = await world(), nav = new NavGrid([-3, -1], [4, 2]); nav.cells.fill(1); w.interactables!.nav = nav;
  const id = w.interactables!.spawn('door', { x: 1, z: 0 }, { key: 'key.house', halfX: .4, halfZ: 2 });
  const closedHash = nav.hash;
  expect(nav.flood([-2, 0])[nav.index(3, 0)]).toBe(0);
  w.setInput({ interact: true }); step(w, 1);
  expect(w.entities.get(id)!.interactable!.hint).toBe('locked'); expect(w.entities.get(id)!.interactable!.open).toBe(false);
  w.clearInput(); step(w, 60);
  w.interactables!.giveItem('key.house'); w.setInput({ interact: true }); step(w, 1); w.clearInput();
  expect(w.entities.get(id)!.interactable!.open).toBe(true);
  expect(nav.flood([-2, 0])[nav.index(3, 0)]).toBe(1);
  expect(nav.hash).not.toBe(closedHash);
  const colliders = w.physics.colliderCount;
  move(w, -3); step(w, 1); move(w, 0); w.setInput({ interact: true }); step(w, 1);
  expect(w.entities.get(id)!.interactable!.open).toBe(false);
  expect(w.physics.colliderCount).toBe(colliders + 1);
  expect(nav.hash).toBe(closedHash);
  const overlap = { x: -1, z: 0, halfX: .4, halfZ: .4 };
  nav.block(100, overlap); nav.block(101, overlap);
  const overlapHash = nav.hash;
  expect(overlapHash).not.toBe(closedHash);
  nav.unblock(100); expect(nav.hash).toBe(overlapHash);
  nav.unblock(101); expect(nav.hash).toBe(closedHash);
});

test('pickups: exact one-time effects with caps, rack join/replacement, dead players wait, inventory survives respawn', async () => {
  const w = await world(), p = w.entities.get(1)!, pickups = w.pickups!;
  w.player!.damage(80, w.tick);
  const med = pickups.spawn('medkit', { x: 0, z: 0 }); step(w, 1); expect(p.health.current).toBe(70);
  pickups.spawn('soda', { x: 0, z: 0 }); step(w, 1); expect(p.health.current).toBe(85);
  pickups.spawn('medkit', { x: 0, z: 0 }); step(w, 1); expect(p.health.current).toBe(100);
  const full = pickups.spawn('medkit', { x: 0, z: 0 }); step(w, 1); expect((w.entities.get(full)!.pickup as Pickup).collected).toBe(false);
  w.combat!.setLoadout(['weapon.bat'], ['weapon.grenade']);
  const grenade = w.combat!.runner.loadout.current('RIGHT'); grenade.charges = 0; grenade.nextCharge = w.tick + 600;
  pickups.spawn('throwable', { x: 0, z: 0 }); step(w, 1); expect(grenade.charges).toBe(1);
  pickups.spawn('weapon', { x: 0, z: 0 }, 'weapon.pistol'); step(w, 1);
  expect(w.combat!.runner.loadout.state.LEFT.rack.map(s => s.id)).toContain('weapon.pistol');
  step(w, 60); expect(events(w, 'pickup.collected').filter(e => 'id' in e && e.id === med)).toHaveLength(1);
  w.player!.damage(100, w.tick); const key = pickups.spawn('item', { x: 0, z: 0 }, 'key.house'); step(w, 1);
  expect((w.entities.get(key)!.pickup as Pickup).collected).toBe(false);
  step(w, 150); expect(p.inventory).toContain('key.house');
  w.player!.damage(100, w.tick); step(w, 150); expect(p.inventory).toContain('key.house');
  expect(() => pickups.spawn('weapon', { x: 0, z: 0 }, 'unknown')).toThrow();

  const r = await world(); r.combat!.setLoadout(['weapon.bat', 'weapon.knife', 'weapon.crowbar'], ['weapon.grenade']);
  const rack = r.combat!.runner.loadout; rack.state.LEFT.index = 1;
  r.pickups!.spawn('weapon', { x: 0, z: 0 }, 'weapon.katana'); step(r, 1);
  expect(rack.current('LEFT').id).toBe('weapon.katana');
  expect(r.query({ kind: 'pickup' })[0].pickup).toEqual({ actionId: 'weapon.knife', armed: false, dropped: true });

  // L6's headlamp must collect while crossing its radius, with E released.
  const h = await world(); move(h, -4);
  const lampId = h.interactables!.spawn('switch', { x: 0, z: 0 }, { radius: 2, holdTime: .3 });
  const lamp = h.entities.get(lampId)!; lamp.archetype = 'pickup.headlamp'; lamp.transform.y = .9;
  lamp.pickup = { kind: 'item', item: 'headlamp', radius: 1.5, collected: false };
  lamp.interactable!.enabled = false;
  h.setInput({ move: { x: 1, z: 0 }, interact: false }); step(h, 10);
  expect((lamp.pickup as Pickup).collected).toBe(false);
  expect(lamp.transform.x).toBe(0);
  let approach: { distance: number; speed: number } | undefined;
  for (let i = 0; i < 60; i++) {
    step(h, 1);
    if (!approach && h.entities.get(1)!.inventory?.includes('headlamp')) {
      const courier = h.entities.get(1)!;
      approach = { distance: Math.hypot(courier.transform.x, courier.transform.z), speed: Math.hypot(courier.survivor!.velocity.x, courier.survivor!.velocity.z) };
    }
  }
  expect(approach?.distance).toBeLessThanOrEqual(1.5);
  expect(approach?.speed).toBeGreaterThan(1);
  expect(lamp.interactable).toMatchObject({ completed: true, enabled: false });
  expect(events(h, 'interact.completed').filter(e => e.id === lampId)).toHaveLength(0);
  expect(events(h, 'pickup.collected').filter(e => 'id' in e && e.id === lampId)).toHaveLength(1);
});

test('explosions: every class follows its damage curve, full cover shields, rails take damage, chains are paced and capped, fires burn out', async () => {
  expect(destructionDamage('weapon.fire-axe', 'wood', 10)).toBe(8);
  expect(destructionDamage('weapon.handgun', 'wood', 10)).toBe(.8);
  expect(destructionDamage('weapon.shotgun', 'glass', 10)).toBe(12);
  expect(destructionDamage('weapon.rocket-launcher', 'concrete', 10)).toBe(15);
  expect(destructionDamage('weapon.unlisted', 'brick', 10)).toBeCloseTo(.12);
  expect(destructionMaterial('prop.fence')).toBe('wood');
  expect(destructionMaterial('veh.sedan-blue')).toBe('metal');
  expect(destructionMaterial('bld.farmhouse')).toBe('brick');
  for (const id of ['explosion.pipe-bomb', 'explosion.propane', 'explosion.car', 'explosion.gas-tanks', 'explosion.molotov', 'explosion.toxic']) {
    const w = await world('blast-lab', true), d = explosionDef(id), at = { x: 0, z: -18 };
    const ids = [0, .5, 1].map(f => w.spawnDummy('infected.dummy', { x: at.x + d.radius * f * (f === 1 ? .999 : 1), z: at.z }, { hp: 5000 }));
    w.explosions!.blast(id, at);
    [0, .5, .999].forEach((f, i) => {
      const expected = blastDamage(d, d.radius * f), dealt = 5000 - w.entities.get(ids[i])!.health.current;
      expect(Math.abs(dealt - expected), `${id} at ${f}`).toBeLessThanOrEqual(Math.max(.02 * expected, 1e-6));
    });
  }
  const c = await world('blast-lab', true), behind = c.spawnDummy('infected.dummy', { x: -7, z: 0 }, { hp: 500 }), open = c.spawnDummy('infected.dummy', { x: -1.5, z: 3.5 }, { hp: 500 });
  const rail = c.barricades!.spawn({ id: 'blast-rail', groupId: 'g', a: { x: 2, z: 2 }, b: { x: 4, z: 2 }, height: 1, initialHp: 300 });
  c.explosions!.blast('explosion.propane', { x: -4.5, z: 0 });
  expect(c.entities.get(behind)!.health.current).toBe(500); expect(c.entities.get(open)!.health.current).toBeLessThan(500);
  c.explosions!.blast('explosion.propane', { x: 3, z: 0 });
  expect(c.entities.get(rail)!.health.current).toBeCloseTo(300 - 100 * (5 - 2) / 5, 5);

  const h = await world('combat-arena', true), tanks = [-6, -3, 0, 3, 6].map(x => h.hazards!.spawn('propane', { x, z: 8 }));
  h.hazards!.hit(tanks[0], 100, 'bullet'); step(h, 200);
  const blasts = events(h, 'hazard.exploded');
  expect(blasts.map(e => e.id)).toEqual(tanks);
  for (let i = 1; i < blasts.length; i++) { const dt = (blasts[i].tick - blasts[i - 1].tick) / 60; expect(dt).toBeGreaterThanOrEqual(.15); expect(dt).toBeLessThanOrEqual(.3); }
  const big = await world('combat-arena', true), stack = Array.from({ length: 14 }, (_, i) => big.hazards!.spawn('propane', { x: i * .2, z: 8 }));
  big.hazards!.hit(stack[0], 100, 'bullet'); step(big, 240);
  const ticks = events(big, 'hazard.exploded').map(e => e.tick);
  expect(ticks).toHaveLength(14);
  for (const t of ticks) expect(ticks.filter(u => u >= t && u < t + 60).length).toBeLessThanOrEqual(8);

  const f = await world('combat-arena', true);
  f.explosions!.blast('explosion.barrel', { x: 8, z: 8 });
  const fires = () => f.entities.values().filter(e => e.hazard?.kind === 'fire' && f.tick < e.hazard.activeUntil);
  expect(fires().length).toBeGreaterThan(0);
  step(f, 18 * 30 + 30 * 60 + 2); expect(fires()).toHaveLength(0);

  // Production L3 placement ownership: real player input hits the facade, then a blast opens nav/LOS.
  const {world: street, mission} = await loadL3(17, 'low'); worlds.push(street);
  const destruction=street.destruction!, house=destruction.objects.find(o=>!o.protected&&o.placement.assetId==='bld.house-a')!;
  expect(house).toBeDefined(); expect(destruction.objects.filter(o=>!o.protected)).toHaveLength(4);
  const glass=house.parts.findIndex(p=>p.id==='window_front'), bounds=house.parts[glass].bounds;
  const local=[bounds.max[0]+2,1.2,(bounds.min[2]+bounds.max[2])/2], pos=rotate(local,house.home.q), dir=rotate([-1,0,0],house.home.q);
  move(street,house.home.p[0]+pos[0],house.home.p[2]+pos[2]);street.combat!.damage.god=true;
  const pristine=destruction.snapshot();
  // A restored timeline can reach the same revision by breaking a different window: invalidate the view cache.
  const view=new DestructionView(), prototype=new Group(), geometry=new BoxGeometry(6.6,3,7).translate(0,1.5,0), material=new MeshBasicNodeMaterial();
  prototype.add(new Mesh(geometry,material));view.extract(house,prototype);
  const indices=()=>{const arrays:number[][]=[];view.traverse(n=>{if(n instanceof Mesh&&n.geometry.index)arrays.push(Array.from(n.geometry.index.array));});return arrays;};
  const breakWindow=(name:string)=>{const part=house.parts.findIndex(p=>p.id===name);destruction.damage({object:house,part,local:house.parts[part].bounds.min,distance:0,normal:[0,1,0]},'weapon.handgun',20);view.update(destruction);};
  breakWindow('window_left');const firstIndices=indices();
  destruction.restore(pristine);view.update(destruction);breakWindow('window_rearL');
  expect(indices(), 'same revision after restore draws the newly broken part').not.toEqual(firstIndices);
  view.dispose();geometry.dispose();material.dispose();destruction.restore(pristine);

  street.combat!.setLoadout(['weapon.handgun'],['weapon.grenade']);
  street.setInput({aim:{x:dir[0],z:dir[2]},aimSource:'pointer',left:{down:true,held:true,up:false}}); step(street,40);street.clearInput();
  expect(house.state.revision, 'real handgun input reaches the placement').toBeGreaterThan(0);
  expect(house.state.hp[glass], 'window shatters').toBe(0);
  const fireAt=(weapon:string, local:number[], aim:number[], ticks:number) => {
    const p=rotate(local,house.home.q),d=rotate(aim,house.home.q);
    move(street,house.home.p[0]+p[0],house.home.p[2]+p[2]);street.combat!.setLoadout([weapon],['weapon.grenade']);
    street.setInput({aim:{x:d[0],z:d[2]},aimSource:'pointer',left:{down:true,held:true,up:false}});step(street,ticks);street.clearInput();
  };
  destruction.restore(pristine);
  fireAt('weapon.shotgun',local,[-1,0,0],25);
  expect(house.state.hp[glass], 'pellets shatter the exposed front window').toBe(0);
  const door=house.parts.findIndex(p=>p.role==='door'), db=house.parts[door].bounds;
  // The authored porch shell stands ahead of this recessed door; successive swings clear it first.
  fireAt('weapon.fire-axe',[db.max[0]+1.2,1.2,(db.min[2]+db.max[2])/2],[-1,0,0],180);
  expect(house.state.hp[door], 'axe breaches a timber door').toBe(0);
  const mgPosition=rotate([-5,1.2,0],house.home.q), mgDirection=rotate([1,0,0],house.home.q);
  const origin={x:house.home.p[0]+mgPosition[0],y:1.2,z:house.home.p[2]+mgPosition[2]}, direction={x:mgDirection[0],y:0,z:mgDirection[2]};
  const covered=destruction.trace(origin,direction,3)!; expect(covered.object.id).toBe(house.id);
  expect(destruction.strike('weapon.army-mg',14,origin,direction,3), 'unrelated yard cover stops the round').toBe(false);
  const exposed=house.parts.filter(p=>p.role==='structure').flatMap(p=>[0,2].flatMap(axis=>[-1,1].map(sign=>{
    const at=p.bounds.min.map((v,i)=>(v+p.bounds.max[i])/2);at[1]=1.2;at[axis]=p.bounds[sign<0?'min':'max'][axis]+sign*.2;
    const way=[0,0,0];way[axis]=-sign;const a=rotate(at,house.home.q),d=rotate(way,house.home.q);
    return {origin:{x:house.home.p[0]+a[0],y:1.2,z:house.home.p[2]+a[2]},direction:{x:d[0],y:0,z:d[2]}};
  }))).find(ray=>{const hit=destruction.trace(ray.origin,ray.direction,2);return hit&&hit.object.id===house.id&&house.parts[hit.part].role==='structure'&&hit.distance>.05&&street.combat!.query.clearDistance(ray.origin,ray.direction,2)>=hit.distance-.08;});
  expect(exposed, 'at least one surviving facade is exposed').toBeDefined();
  const thinWall=destruction.trace(exposed!.origin,exposed!.direction,2)!;
  for(let i=0;i<40&&house.state.hp[thinWall.part]>0;i++)destruction.strike('weapon.army-mg',14,exposed!.origin,exposed!.direction,2);
  expect(house.state.hp[thinWall.part], 'sustained MG fire chews a thin wall').toBe(0);
  expect(house.state.marks.length).toBeLessThanOrEqual(8);
  const initial=destruction.snapshot(), navBefore=street.districts!.nav.cells.slice(), wallsBefore=street.interactables!.walls.length;
  const checkpoint=mission.def.checkpoints[0]; mission.checkpoint(checkpoint);
  street.explosions!.blast('explosion.rocket',{x:house.home.p[0],z:house.home.p[2]},{actionId:'weapon.rocket-launcher',radius:9});
  expect(house.state.collapsed).toBe(true);expect(house.parts.every((p,i)=>p.role!=='roof'||house.state.hp[i]===0)).toBe(true);
  expect(street.interactables!.walls.length).toBeLessThan(wallsBefore);
  expect(street.districts!.nav.cells.some((v,i)=>v===1&&navBefore[i]===0)).toBe(true);
  const destroyed=destruction.snapshot();
  mission.restore(checkpoint); expect(destruction.snapshot()).toEqual(initial);
  expect(street.interactables!.walls.length).toBe(wallsBefore);
  street.explosions!.blast('explosion.rocket',{x:house.home.p[0],z:house.home.p[2]},{actionId:'weapon.rocket-launcher',radius:9});
  expect(destruction.snapshot()).toEqual(destroyed); destruction.rebuild();expect(destruction.snapshot()).toEqual(destroyed);
  const protectedObject=destruction.objects.find(o=>o.protected)!;
  destruction.blast('weapon.rocket-launcher',{x:protectedObject.home.p[0],z:protectedObject.home.p[2]},20,1e6);
  expect(protectedObject.state.revision).toBe(0);
  const car=destruction.objects.find(o=>!o.protected&&o.placement.destruction!.class==='vehicle')!;
  destruction.blast('weapon.molotov',{x:car.home.p[0],z:car.home.p[2]},4,10);
  expect(car.state.burning).toBeGreaterThan(0);expect(car.state.fireEntity).toBeDefined();
  const remainingBurn=car.state.burning; mission.checkpoint(checkpoint);street.tick+=600;mission.restore(checkpoint);
  expect(car.state.burning).toBe(remainingBurn);
  expect(street.entities.get(car.state.fireEntity!)!.hazard!.activeUntil, 'restored fire survives the shifted checkpoint clock').toBeGreaterThan(street.tick);
  // Isolate fixed-tick fire from the mission director; no rendering or wall-clock timer participates.
  for(let tick=0;tick<310;tick++){street.tick++;destruction.update();}
  expect(car.state.exploded).toBe(true);expect(car.state.burning).toBe(0);
  expect(street.hazards!.debris.pieces.length).toBeLessThanOrEqual(32);
  street.hazards!.debris.update(street.tick+481);expect(street.hazards!.debris.snapshot()).toHaveLength(0);

  destruction.restore(pristine);
  expect(destruction.impact(protectedObject.id,'boss.gorilla.smash',10000)).toBe(false);
  expect(destruction.impact(house.id,'boss.gorilla.smash',150)).toBe(true);
  expect(house.state.collapsed).toBe(true);
  destruction.restore(pristine);
  const vehiclePolicy=car.placement.destruction!;
  car.placement.destruction={class:'fuel-tank'};
  expect(destruction.impact(car.id,'boss.mega.charge',100)).toBe(true);
  expect(car.state.burning).toBe(60);
  for(let tick=0;tick<60;tick++){street.tick++;destruction.update();}
  expect(car.state.exploded).toBe(true);
  const explosionRevision=car.state.revision;
  for(let tick=0;tick<60;tick++){street.tick++;destruction.update();}
  expect(car.state.revision).toBe(explosionRevision);
  const fuelBody=street.props!.items.find(p=>p.id===car.id)!;
  expect(fuelBody.body.isEnabled(),'exploded movable tank relinquishes its collider').toBe(false);
  destruction.restore(pristine);
  expect(fuelBody.body.isEnabled(),'checkpoint restores the tank body').toBe(true);
  car.placement.destruction=vehiclePolicy;
  destruction.blast('weapon.molotov',{x:car.home.p[0],z:car.home.p[2]},4,10);
  const tierFire=street.entities.get(car.state.fireEntity!)!;
  const state=destruction.snapshot(); street.setTier(street.districts!.composition.tier===6?5:6);expect(destruction.snapshot()).toEqual(state);
  expect(car.present,'tier 6 removes this authored car placement').toBe(false);
  expect(tierFire.hazard!.activeUntil).toBe(street.tick);
  expect(destruction.impact(car.id,'boss.mega.charge',10000),'inactive tiers cannot take damage').toBe(false);
  expect(destruction.snapshot()).toEqual(state);
  street.setTier(5);expect(car.present).toBe(true);expect(tierFire.hazard!.activeUntil).toBeGreaterThan(street.tick);
  // A fire and a queued blast can outlive the physics chunk that owned the car.
  destruction.restore(pristine);
  const streamed=street.props!.items.find(p=>p.id===car.id)!;
  const streamedState=street.props!.chunkState(streamed.entityId)!;
  destruction.blast('weapon.rocket-launcher',{x:car.home.p[0],z:car.home.p[2]},4,3000,5);
  street.props!.unloadChunk(streamed.entityId);
  expect(streamed.body.isValid()).toBe(false);
  expect(()=>{for(let tick=0;tick<310;tick++){street.tick++;destruction.update();}}).not.toThrow();
  expect(car.state.exploded).toBe(true);
  street.props!.loadChunk(streamed.entityId,streamedState);
  const reloaded=street.props!.items.find(p=>p.id===car.id)!;
  expect(reloaded.body.isValid()).toBe(true);
  destruction.update();expect(destruction.pose(car)).toBe(reloaded.pose);
  destruction.restore(pristine);
  verifyDestructionRollout();


});

test('look-l6-l9 decor is render-only: L6 nav hash, colliders and pushables match the layout without it, a re-preparation adds none, L9 has none; L10 crossing scenes stay clear and grounded', async () => {
  // New baked ground overlays must enter the shared layer graph, including exact-height ties.
  const { groundPriorities, groundConflicts, groundGroup } = await import('../../tools/layouts/ground-layers');
  const triangles = [0, .0002, .0002].map((y,i) => ({id:String(i),material:`m${i}`,y,points:[[0,0],[0,2],[2,0]] as [number,number][]}));
  const ranks = groundPriorities(triangles);
  expect(triangles.map(t=>ranks.get(groundGroup(t)))).toEqual([0,1,2]);
  expect(groundConflicts(triangles)).toHaveLength(3);
  expect(groundConflicts([triangles[0],{...triangles[1],points:[[3,0],[3,2],[5,0]]}])).toHaveLength(0);
  const ramps=triangles.map(t=>({...t,slope:[.15,-.05] as [number,number]}));
  expect(groundConflicts(ramps)).toHaveLength(3);
  const rampRanks=groundPriorities(ramps);
  expect(ramps.map(t=>rampRanks.get(groundGroup(t)))).toEqual([0,1,2]);
  expect(groundConflicts([ramps[0],{...ramps[1],slope:[.25,-.05]}])).toHaveLength(0);
  const { readdirSync } = await import('node:fs');
  const { execFileSync } = await import('node:child_process');
  // Decode the real GLBs outside Vitest's module transformer. The same CLI is
  // usable after any authoring tool, including the separately generated W6.
  const paths = readdirSync('public/assets/layouts').filter(p=>/\.(base|w\d+)\.glb$/.test(p)).map(p=>`public/assets/layouts/${p}`);
  expect(() => execFileSync(process.execPath,['--import','tsx','tools/layouts/audit-ground.ts',...paths,'--together','--check'],{timeout:45_000,stdio:'pipe'})).not.toThrow();
  const { groundDepth, groundLayers } = await import('../../src/render/GroundLayers');
  const { MeshBasicNodeMaterial } = await import('three/webgpu');
  const depth = groundDepth(new MeshBasicNodeMaterial(),groundLayers.puddle);
  expect([depth.polygonOffset,depth.polygonOffsetFactor,depth.polygonOffsetUnits]).toEqual([true,0,-56]); 
  const { staticBatch, staticBatchSharingKey } = await import('../../src/assets/staticBatch');
  const { Group, Mesh, PlaneGeometry } = await import('three/webgpu');
  const source = new Group(), a = groundDepth(new MeshBasicNodeMaterial(),0), b = groundDepth(new MeshBasicNodeMaterial(),1);
  expect(staticBatchSharingKey('static-body',a)).not.toBe(staticBatchSharingKey('static-body',b));
  const geometry = new PlaneGeometry(2,2);source.add(new Mesh(geometry,a),new Mesh(geometry,b));
  const batched = staticBatch(source,true);
  expect(batched.children.map(o=>(o as import('three').Mesh).material).map(m=>(m as import('three').Material).userData.groundLayer)).toEqual([0,1]);
  for(const o of batched.children){const mesh=o as import('three').Mesh;mesh.geometry.dispose();(mesh.material as import('three').Material).dispose();}
  geometry.dispose();a.dispose();b.dispose();depth.dispose();

  const { DistrictWorld } = await import('../../src/sim/world/DistrictWorld');
  const { compositions } = await import('../../src/levels/compositions');
  const { districtDecor } = await import('../../src/levels/decor');
  const layout = (await import('../../public/assets/layouts/D-SUBWAY.layout.json')).default;
  const build = (skip: boolean) => { const copy = structuredClone(layout) as unknown as { geometryHash: string }; if (skip) copy.geometryHash = 'scene-lab'; return new DistrictWorld(compositions.L6, [copy as never], 1); };
  const plain = build(true), dressed = build(false), d = dressed.districts[0], p = plain.districts[0];
  expect(d.decay.placements.filter(q => q.decor).length).toBeGreaterThan(60);
  expect(dressed.nav.hash).toBe(plain.nav.hash);
  expect(d.decay.colliders).toEqual(p.decay.colliders);
  expect(d.pushables.map(q => q.id)).toEqual(p.pushables.map(q => q.id));
  expect(new DistrictWorld(compositions.L6, dressed.districts.map(x => x.layout), 1).districts[0].decay.placements.length).toBe(d.decay.placements.length);
  expect(districtDecor('D-CROSSING', [])).toEqual([]);

  // r9-l10pace (vqa58 "minutes of empty dark grass"): L10 crossing scenes. The belt keeps its pieces; the scenes are
  // deterministic, lit, clear of the walked line, roads, encounter slots (lane-shifted groups: their x band at any z) and the
  // console; tall pieces are solids, small ones render-only; nothing intersects an existing solid; all stand on the ground.
  const { cureCrossingLines, cureCrossingStories, crossingScenesBlock } = await import('../../src/levels/L10/crossingStories');
  const { cureRoadsideBelt } = await import('../../src/levels/L10/roadsideBelt');
  const { cure } = await import('../../src/levels/L10/district');
  const { cureEncounters, cureEncounterSlots } = await import('../../src/levels/L10/encounters');
  const { placementColliders } = await import('../../src/levels/districts/staticCollision');
  type P = [number, number];
  const cureLayout = (await import('../../public/assets/layouts/D-CURE.layout.json')).default as unknown as import('../../src/levels/districts/types').DistrictLayout;
  const { levelTenLayouts } = await import('../../src/levels/L10/layout');
  const assembled = new DistrictWorld(compositions.L10, levelTenLayouts([cureLayout]), 42);
  const actualFarm = assembled.districts[0].layout.placements;
  expect(actualFarm.filter(p => p.assetId === 'veg.corn-block').length).toBeGreaterThan(100);
  expect(actualFarm.some(p => p.id.startsWith('decor-cure-vignette-'))).toBe(true);
  expect(actualFarm.filter(p => p.id.startsWith('l10-barn-grave-'))).toHaveLength(3);
  expect(actualFarm.some(p => p.id === 'l10-find-farm-barn')).toBe(true);
  expect(new DistrictWorld(compositions.L10, assembled.districts.map(d => d.layout), 42).districts[0].layout.placements).toHaveLength(actualFarm.length);
  const belt = cureRoadsideBelt(cureLayout.placements), stories = cureCrossingStories([...cureLayout.placements, ...belt]);
  expect(cureCrossingStories([...cureLayout.placements, ...belt])).toEqual(stories);
  const { cureForecourtDecor } = await import('../../src/levels/L10/forecourts');
  const apron = cureForecourtDecor([...cureLayout.placements, ...belt, ...stories]);
  const { clearFarmFromSurfaces, cureFarmDecor, cureSouthernFieldDecor } = await import('../../src/levels/L10/farmLayout');
  const farm = cureFarmDecor([...cureLayout.placements, ...belt, ...stories, ...apron]);
  expect(farm.filter(p => p.assetId === 'veg.corn-block').length).toBeGreaterThan(100);
  const { cureVignetteCatalogue, cureVignettes } = await import('../../src/levels/L10/vignettes');
  const vignettes = cureVignettes([...cureLayout.placements, ...belt, ...stories, ...apron, ...farm]);
  const { cureEvacuationLane } = await import('../../src/levels/L10/vignettes');
  const clearedFarm = clearFarmFromSurfaces(farm, cureEvacuationLane(vignettes));
  expect(clearedFarm.filter(p => p.assetId === 'veg.corn-block').length).toBeGreaterThan(100);
  expect(clearedFarm.filter(p => p.assetId !== 'veg.corn-block').map(p => [p.id, p.assetId])).toEqual(farm.filter(p => p.assetId !== 'veg.corn-block').map(p => [p.id, p.assetId]));
  expect(clearedFarm.filter(p => p.assetId !== 'veg.corn-block' && !p.id.startsWith('decor-cure-farm-field-'))).toEqual(farm.filter(p => p.assetId !== 'veg.corn-block' && !p.id.startsWith('decor-cure-farm-field-')));
  const southernField = cureSouthernFieldDecor([...cureLayout.placements, ...belt, ...stories, ...apron, ...farm, ...vignettes]);
  expect(southernField.some(p => p.assetId === 'veg.corn-block' && p.position[2] < -100)).toBe(true);
  expect(districtDecor('D-CURE', cureLayout.placements)).toEqual([...belt, ...stories, ...apron, ...clearedFarm, ...vignettes, ...southernField]);
  expect(cureVignettes([...cureLayout.placements, ...belt, ...stories, ...apron, ...farm])).toEqual(vignettes);
  expect(cureVignetteCatalogue.every(v => v.pieces.length >= 3 && v.pieces.length <= 8)).toBe(true);
  const vignetteGroups = new Set(vignettes.map(p => p.id.replace(/-\d+$/, '')));
  expect(vignetteGroups.size).toBeGreaterThanOrEqual(85); // ~20/km over the 4.3 km authored route.
  expect(vignettes.every(p => p.decor && p.fixed)).toBe(true);
  const farmOverlaps = vignettes.flatMap(p => clearedFarm.filter(q => p.visualAabb.min[0] < q.visualAabb.max[0] && p.visualAabb.max[0] > q.visualAabb.min[0] && p.visualAabb.min[2] < q.visualAabb.max[2] && p.visualAabb.max[2] > q.visualAabb.min[2]).map(q => [p.id, q.id]));
  expect(farmOverlaps, 'vignette footprints must clear corn and farm structures').toEqual([]);
  expect(placementColliders(vignettes, []).every(c => c.aabb.physicsOnly)).toBe(true);
  const { cureVignetteDecals, cureWallMessages } = await import('../../src/levels/L10/vignettes');
  const { CureVignetteDecals } = await import('../../src/render/district/CureVignetteDecals');
  const { DataTexture } = await import('three/webgpu');
  const rows = cureVignetteDecals(vignettes), paint = rows.filter(r=>!r.ground), casings = rows.filter(r=>r.cell===12);
  expect(paint).toHaveLength(35);
  expect(casings.filter(r=>r.highOnly)).toHaveLength(casings.length/2);
  expect(cureWallMessages).toEqual(['HELP — 3 INSIDE','AUTHORIZED PERSONNEL ONLY — BIOHAZARD LEVEL 4']);
  expect(paint.every(r=>r.cell===0||r.cell===1)).toBe(true);
  const serviceLane=cureEvacuationLane(vignettes);
  expect(serviceLane).toHaveLength(3);
  expect(serviceLane.every(s=>s.surface==='asphalt')).toBe(true);
  expect(serviceLane[0].polygon[2][0]-serviceLane[0].polygon[0][0]).toBeGreaterThan(128);
  const sample=casings[0],pair=casings.filter(r=>r.scene===sample.scene);
  const decals=new CureVignetteDecals(pair,new DataTexture(new Uint8Array([255,255,255,255]),1,1));
  const focus={x:sample.position[0],z:sample.position[2]};
  decals.update(focus,false);expect(decals.visibleIds()).toHaveLength(2);
  decals.update(focus,true);expect(decals.visibleIds()).toHaveLength(1);
  decals.update({x:0,z:0},true);expect(decals.visibleIds()).toHaveLength(0);decals.dispose();

  expect(apron.some(p => p.position[0] > 3900 && p.roadLife)).toBe(true);
  expect(stories.filter(q => q.fieldLight).length).toBeGreaterThan(60);
  for (const li of cureCrossingLines.keys()) expect(stories.some(q => q.id.startsWith(`decor-cure-cross-${li}-`) && q.fieldLight)).toBe(true);
  expect(stories.some(q => q.id.includes('-hero-r4-command'))).toBe(true);
  expect(stories.some(q => q.id.includes('-hero-r4-evac'))).toBe(true);
  expect(stories.some(q => q.id.includes('-hero-r6-triage'))).toBe(true);
  const seg = (q: P, a: P, b: P) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz, t = l ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / l)) : 0; return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dz); };
  const dist = (q: P, line: readonly P[]) => Math.min(...line.slice(1).map((b, i) => seg(q, line[i], b)));
  const roads: P[][] = [...cure.regions.map(r => r.route), ...cure.detours.map(r => r.route), [cure.regions[5].route[1], cure.anchors['corridor-breach'], cure.anchors['r6-r7-seam'], cure.regions[6].route[5]]];
  const shifted = (e: { id: string }) => e.id.includes('-direct-') || e.id.startsWith('corridor-');
  const slotsOf = (e: (typeof cureEncounters)[number]) => (['high', 'low'] as const).flatMap(t => cureEncounterSlots(e, t));
  const slots = cureEncounters.filter(e => !e.assault && !shifted(e)).flatMap(slotsOf), laneSlots = cureEncounters.filter(shifted).flatMap(slotsOf);
  const consoleAt = cure.anchors['cure-console'];
  for (const q of stories) {
    const a = q.visualAabb, line = cureCrossingLines[Number(q.id.split('-')[3])].line;
    for (const c of [[a.min[0], a.min[2]], [a.min[0], a.max[2]], [a.max[0], a.min[2]], [a.max[0], a.max[2]]] as P[]) {
      expect(dist(c, line)).toBeGreaterThanOrEqual(3.2);
      for (const r of roads) expect(dist(c, r)).toBeGreaterThanOrEqual(8);
    }
    expect(Math.hypot(q.position[0] - consoleAt[0], q.position[2] - consoleAt[1])).toBeGreaterThan(100);
    expect(slots.some(s => s.x > a.min[0] - 4 && s.x < a.max[0] + 4 && s.z > a.min[2] - 4 && s.z < a.max[2] + 4)).toBe(false);
    expect(laneSlots.some(s => s.x > a.min[0] - 4 && s.x < a.max[0] + 4)).toBe(false);
    expect(cureLayout.colliders.some(c => !c.walkable && c.aabb.max[1] > .05 && a.min[0] < c.aabb.max[0] && a.max[0] > c.aabb.min[0] && a.min[2] < c.aabb.max[2] && a.max[2] > c.aabb.min[2])).toBe(false);
  }
  const solids = stories.filter(q => q.decorSolid);
  expect(stories.every(q => q.decor)).toBe(true);
  expect(solids.length > 40).toBe(crossingScenesBlock);
  expect(placementColliders(stories.filter(q => !q.decorSolid), [])).toEqual([]);
  const solidColliders = placementColliders(solids, []), solidIds = new Set(solidColliders.map(c => c.id.split('/')[0]));
  // Physics-only: they stop the courier but are no AI nav wall (qa:accept L10-03: nav solids starved the corridor-breach group).
  expect(solidColliders.every(c => c.aabb.physicsOnly)).toBe(true);
  expect(solids.every(q => solidIds.has(q.id))).toBe(true);
  // Ground under each piece without the scenes (a sandbag pallet carries its own 25 cm walkable deck).
  const bare = new DistrictWorld(compositions.L10, [{ ...cureLayout, placements: [...cureLayout.placements, ...belt] }], 32);
  for (const q of stories) for (const [x, z] of [[q.visualAabb.min[0], q.visualAabb.min[2]], [q.visualAabb.max[0], q.visualAabb.max[2]]]) expect(Math.abs(bare.groundHeight(x, z))).toBeLessThan(.05);
  const platform = cureLayout.placements.find(q => q.assetId === 'kit.dispersal-platform')!;
  const [px, , pz] = platform.position;
  expect(bare.pavingHeight(px, pz)).toBeCloseTo(3.08);
  expect(bare.supportBelow(px, pz, 0), 'a ground-level infected under the deck stays below it').toBe(0);
  expect(bare.supportBelow(px + 8.1, pz, 0), 'the lowest stair tread remains a valid first step').toBeCloseTo(.1);
  const { heightRouteWaypoint } = await import('../../src/sim/ai/InfectedSystem');
  const waypoint = heightRouteWaypoint(bare, { transform: { x: px + 10, y: .7, z: pz, yaw: 0 } } as never, { x: px, y: 3.78, z: pz });
  expect(waypoint?.x).toBeCloseTo(px + 8.07, 1);
  const chase = await world('survivor', true);
  chase.districts = bare;
  chase.enableInfected();
  const infected = chase.infected!, walker = chase.entities.get(infected.spawn('infected.runner', { x: px + 10, z: pz }, { state: 'chase' }))!;
  const seek = infected as unknown as { seek(e: typeof walker, goal: { x: number; y: number; z: number }): void };
  for (let tick = 0; tick < 2400; tick++) {
    seek.seek(walker, { x: px, y: 3.78, z: pz });
    walker.transform.y = .7 + bare.supportBelow(walker.transform.x, walker.transform.z, walker.transform.y - .7);
    chase.tick++;
  }
  expect(walker.transform.y, 'a pursuer must walk all the way up the stairs onto the deck').toBeCloseTo(3.78);
}, 60_000);
