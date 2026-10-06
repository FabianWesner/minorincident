import { expect, test } from 'vitest';
import { Bindings, bindingStorageKey } from '../../../src/input/Bindings';
import { defaultBindings, type Action } from '../../../src/data/bindings';

test('T-E03-bindings @E03 @E03-AC09 each logical action can be rebound and persists without conflicts', () => {
  const entries = new Map<string, string>();
  const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
  const bindings = new Bindings(storage);
  for (const [index, action] of (Object.keys(defaultBindings) as Action[]).entries()) {
    const code = index < 12 ? `F${index + 1}` : 'KeyZ';
    expect(bindings.rebind(action, code).ok).toBe(true);
    expect(new Bindings(storage).action(code)).toBe(action);
  }
  expect(bindings.rebind('right', 'F1')).toEqual({ ok: false, message: 'F1 is already bound to moveUp.' });
  expect(bindings.action('Mouse0')).toBe('left'); expect(bindings.action('Mouse1')).toBe('interact');
  entries.set(bindingStorageKey, '{broken'); expect(new Bindings(storage).get()).toEqual(defaultBindings);
  entries.set(bindingStorageKey, JSON.stringify({ version: 1, bindings: { ...defaultBindings, right: ['KeyJ'] } }));
  expect(new Bindings(storage).get()).toEqual(defaultBindings);
});

test('T-E03-storage @E03 storage errors leave the existing bindings usable', () => {
  const bindings = new Bindings({ getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } });
  expect(bindings.get()).toEqual(defaultBindings);
  expect(bindings.rebind('left', 'KeyZ')).toEqual({ ok: false, message: 'Bindings could not be saved.' });
  expect(bindings.action('KeyJ')).toBe('left'); expect(bindings.action('KeyZ')).toBeNull();
});

test('@E03-AC02 saved old mouse mirror migrates RMB from attack to cycle', () => {
  const old = { ...defaultBindings, right: ['Mouse2', 'KeyK'], selector: ['KeyQ', 'KeyL'] };
  const bindings = new Bindings({ getItem: () => JSON.stringify({ version: 1, bindings: old }), setItem() {} });
  expect(bindings.action('Mouse2')).toBe('selector'); expect(bindings.action('KeyK')).toBe('right');
});
