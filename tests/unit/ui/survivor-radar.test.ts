import { afterEach, expect, test, vi } from 'vitest';
import { EntityStore } from '../../../src/sim/world/EntityStore';
import { SurvivorRadar } from '../../../src/ui/SurvivorRadar';

function element() {
  const attributes = new Map<string, string>(), properties = new Map<string, string>();
  return {
    dataset: {}, className: '', hidden: false,
    setAttribute: (key: string, value: string) => attributes.set(key, value),
    getAttribute: (key: string) => attributes.get(key) ?? null,
    style: { setProperty: (key: string, value: string) => properties.set(key, value), getPropertyValue: (key: string) => properties.get(key) ?? '' },
  } as unknown as HTMLSpanElement;
}
afterEach(() => vi.unstubAllGlobals());

test('@E14-AC10 #72 group survivors and allied followers use persistent clamped pins; dead, hidden, absent and turned disappear', () => {
  const createElement = vi.fn(element); vi.stubGlobal('document', { createElement });
  const pins: HTMLSpanElement[] = [];
  const radar = new SurvivorRadar({ append: (pin: HTMLSpanElement) => pins.push(pin) } as unknown as HTMLElement);
  const entities = new EntityStore();
  vi.spyOn(entities, 'values').mockImplementation(() => { throw new Error('Radar must not allocate entity snapshots'); });
  const record = { archetype: 'civilian', kind: 'npc', faction: 'civilian', health: { current: 60, max: 60 }, transform: { x: 60, y: 0, z: 80, yaw: 0 } };
  entities.create(record); // player identity
  const survivor = entities.create(record);
  survivor.civilian = { survivor: { key: 'carried-from-L6', mode: 'follow' } } as typeof survivor.civilian;
  const ally = entities.create({ ...record, health: { current: 60, max: 60 } });
  ally.civilian = { ally: { follow: { targetId: 1 } } } as typeof ally.civilian;
  const hidden = entities.create(record); hidden.civilian = { survivor: { mode: 'hidden' } } as typeof hidden.civilian;
  radar.update(entities, 0, 0);
  expect(pins.filter(p => !p.hidden)).toHaveLength(2);
  expect(pins[0].getAttribute('data-clamped')).toBe('true');
  expect(Number.parseFloat(pins[0].style.getPropertyValue('left'))).toBeCloseTo(76.4);
  expect(Number.parseFloat(pins[0].style.getPropertyValue('top'))).toBeCloseTo(85.2);
  const created = createElement.mock.calls.length;
  survivor.transform.x = 3; survivor.transform.z = 0; radar.update(entities, 0, 0);
  expect(pins[0].getAttribute('data-clamped')).toBe('false');
  expect(pins[0].style.getPropertyValue('left')).toBe('54.4%');
  survivor.health.current = 0; radar.update(entities, 0, 0);
  expect(pins.filter(p => !p.hidden)).toHaveLength(1);
  expect(pins[0].getAttribute('data-entity-id')).toBe(String(ally.id));
  ally.hidden = true; radar.update(entities, 0, 0); expect(pins.every(p => p.hidden)).toBe(true);
  ally.hidden = false; ally.faction = 'infected'; radar.update(entities, 0, 0); expect(pins.every(p => p.hidden)).toBe(true);
  ally.faction = 'civilian'; ally.infection = {} as NonNullable<typeof ally.infection>; radar.update(entities, 0, 0); expect(pins.every(p => p.hidden)).toBe(true);
  delete ally.infection; radar.update(entities, 0, 0); expect(pins[0].hidden).toBe(false);
  entities.delete(ally.id); radar.update(entities, 0, 0); expect(pins.every(p => p.hidden)).toBe(true);
  expect(createElement).toHaveBeenCalledTimes(created);
});
