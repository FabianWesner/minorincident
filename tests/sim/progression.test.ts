import { afterEach,beforeEach,expect,test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { applyCampaign,modifiedActions } from '../../src/sim/progression/apply';
import { newCampaign,preset,gearTier } from '../../src/sim/progression/Campaign';
import { catalog } from '../../src/data/actions/catalog';
let world:SimWorld;
beforeEach(async()=>{world=new SimWorld();await world.init();world.loadScenario('combat-arena');});
afterEach(()=>world.dispose());
test('T-E13-02 @E13 @E13-AC02 melee damage is exactly +20% and every firearm magazine grows by two, including reload',()=>{
  const save=newCampaign();save.ownedActions.push('weapon.bat','weapon.pistol');save.racks={LEFT:['weapon.bat'],RIGHT:['weapon.pistol']};save.upgrades=['upgrade.melee.1','upgrade.handling.1'];applyCampaign(world,save);
  const target=world.spawnDummy('infected.test',{x:1,z:0},{hp:1000});world.setInput({aim:{x:1,z:0},left:{down:true,held:false,up:false}});world.update();world.clearInput();for(let i=0;i<6;i++)world.update();
  const hit=world.events.events().find(e=>e.type==='combat.hit'&&e.targetId===target);expect(hit).toMatchObject({amount:catalog['weapon.bat'].damage*1.2});
  for(const d of Object.values(catalog).filter(d=>d.category==='ranged')){
    world.combat!.setLoadout(['weapon.bat'],[d.id]);const l=world.combat!.runner.loadout;
    expect(l.current('RIGHT').magazine).toBe(d.magazine+2);
    const def=l.definition(d.id);for(let i=0;i<def.magazine;i++)l.spend('RIGHT',world.tick,def,false);
    expect(l.current('RIGHT').reloadUntil).toBeGreaterThan(world.tick);l.update(l.current('RIGHT').reloadUntil,()=>{});expect(l.current('RIGHT').magazine).toBe(d.magazine+2);
  }
  expect(catalog['weapon.bat'].damage).toBe(25);expect(catalog['weapon.pistol'].magazine).toBe(6);
});
test('T-E13-07-sim @E13 @E13-AC07 L5 default equips its expected upgraded loadout in sim',()=>{
  const save=preset('L5-default');save.settings.aimAssist='High';applyCampaign(world,save);expect(world.combat!.assist.setting).toBe('High');
  expect(save.racks).toEqual({LEFT:['weapon.bat','weapon.kick','weapon.fists'],RIGHT:['weapon.pipe-bomb','weapon.rocket-launcher','weapon.machine-gun']});
  expect(world.getState().progression!.campaign).toEqual(save);expect(world.player!.entity.survivor!.gearTier).toBe(3);
  for(const side of ['LEFT','RIGHT']as const)expect(world.player!.entity.weapons![side].rack.map(s=>s.id)).toEqual(save.racks[side]);
});
test('T-E13-08-sim @E13 @E13-AC08 default progression applies all five gear tiers',()=>{
  for(const level of [2,3,4,5,6]as const){const save=preset(`L${level}-default`);applyCampaign(world,save);expect(world.getState().player!.survivor!.gearTier).toBe(level-2);expect(gearTier(save)).toBe(level-2);}
});
test('@E13 action hooks, player stats and vehicle perks materialize once without mutating base definitions',()=>{
  const save=newCampaign();save.upgrades=['upgrade.health.1','upgrade.speed.1','upgrade.throwables.1','upgrade.knockback.1','upgrade.vehicle.1','upgrade.perk.1'];save.ownedActions.push('weapon.bat');applyCampaign(world,save);const defs=modifiedActions(save);
  expect(world.player!.entity.health.max).toBe(130);world.setInput({move:{x:1,z:0}});world.update();expect(world.player!.locomotion.speedScale).toBeCloseTo(4.72/4.5);
  expect(defs['weapon.grenade'].charges).toBe(3);expect(defs['weapon.grenade'].splash!.radius).toBeCloseTo(4*1.15);expect(defs['weapon.bat'].damage).toBeCloseTo(25*1.15);expect(defs['weapon.bat'].knockback).toBeCloseTo(.5*1.2);
  const id=world.vehicles!.spawn('vehicle.sedan',{x:4,z:4}),hp=world.entities.get(id)!.health.current;world.vehicles!.damage(id,100);expect(world.entities.get(id)!.health.current).toBe(hp-90);world.update();expect(world.vehicles!.cars.get(id)!.physics.boostScale).toBe(1.1);
  expect(catalog['weapon.grenade'].charges).toBe(2);
});

test('T-E13-04-sim @E13 @E13-AC04 pickups replace full campaign racks instead of exceeding level capacity',()=>{
  for(const level of [1,2,3,4,5,6]as const){const save=level===1?newCampaign():preset(`L${level}-default`);applyCampaign(world,save);const l=world.combat!.runner.loadout;const capacity=level<2?1:level<4?2:3;
    for(const id of ['weapon.bat','weapon.pistol','weapon.shotgun','weapon.grenade'])l.collect('LEFT',id);
    expect(l.state.LEFT.rack).toHaveLength(capacity);expect(()=>world.combat!.setLoadout(Array(capacity+1).fill('weapon.bat'),['weapon.kick'])).toThrow();
  }
});

test('@E13 @E13-AC02 nail-bat bleeding uses its action hook and Hazmat poison immunity does not block it',()=>{
  const save=newCampaign();save.ownedActions.push('weapon.nail-bat');save.upgrades=['upgrade.nail-bat-bleed'];save.racks.LEFT=['weapon.nail-bat'];applyCampaign(world,save);
  const id=world.spawnDummy('infected.hazmat',{x:1,z:0},{hp:1000});world.setInput({aim:{x:1,z:0},left:{down:true,held:false,up:false}});world.update();world.clearInput();for(let i=0;i<240;i++)world.update();
  expect(world.entities.get(id)!.health.current).toBe(1000-catalog['weapon.nail-bat'].damage-15);
  expect(world.combat!.runner.loadout.definition('weapon.nail-bat').status!.kind).toBe('bleeding');expect(catalog['weapon.nail-bat'].status).toBeNull();
});
