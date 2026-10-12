import { expect, test } from 'vitest';
import { EventBus } from '../../../src/core/EventBus';

test('T-E29-19-event-dispatch @E29-AC19 cached dispatch preserves phase snapshots, nested emits and reset', () => {
  const bus = new EventBus<{ type: 'tick'; tick: number; position: { x: number } }>(), log: string[] = [];
  let first = true;
  const f = (e: { tick: number }) => log.push(`f${e.tick}`);
  const g = (e: { tick: number }) => log.push(`g${e.tick}`);
  const e = (e: { tick: number }) => log.push(`e${e.tick}`);
  let removeC = () => {};
  bus.on('tick', event => {
    log.push(`a${event.tick}`);
    if (first) {
      first = false; removeC(); bus.on('tick', g, 0); bus.on('tick', e, 1);
      bus.emit({ type: 'tick', tick: 2, position: { x: 2 } });
    }
  }, 0);
  bus.on('tick', event => { log.push(`b${event.tick}`); bus.on('tick', f, 3); }, 1);
  removeC = bus.on('tick', event => log.push(`c${event.tick}`), 1);
  bus.on('tick', event => log.push(`d${event.tick}`), 2);
  const event = { type: 'tick' as const, tick: 1, position: { x: 1 } };
  bus.emit(event); event.position.x = 99;
  bus.emit({ type: 'tick', tick: 3, position: { x: 3 } });
  expect(log).toEqual(['a1', 'a2', 'g2', 'b2', 'e2', 'd2', 'b1', 'e1', 'd1', 'a3', 'g3', 'b3', 'e3', 'd3', 'f3']);
  expect(bus.listenerCount).toBe(6); expect(bus.events().find(e => e.tick === 1)!.position.x).toBe(1);
  bus.reset(); expect(bus.listenerCount).toBe(0); expect(bus.events()).toEqual([]);
  bus.on('tick', event => log.push(`new${event.tick}`), 0);
  bus.emit({ type: 'tick', tick: 4, position: { x: 4 } }); expect(log.at(-1)).toBe('new4');
});
