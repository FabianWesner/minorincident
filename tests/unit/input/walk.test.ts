import { expect, test } from 'vitest';
import { Bindings, bindingStorageKey } from '../../../src/input/Bindings';
import { defaultBindings } from '../../../src/data/bindings';

const memory = () => { const entries = new Map<string, string>(); return { entries, storage: { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } } }; };

test('E19 @E19 @E19-AC13 Walk binds to C and Alt by default and is rebindable', () => {
  const { storage } = memory(), bindings = new Bindings(storage);
  for (const code of ['KeyC', 'AltLeft', 'AltRight']) expect(bindings.action(code)).toBe('walk');
  expect(bindings.keyLabel('walk')).toBe('C');
  expect(bindings.rebind('walk', 'KeyV')).toEqual({ ok: true, message: 'walk bound to KeyV.' });
  expect(new Bindings(storage).action('KeyV')).toBe('walk');
  expect(bindings.rebind('walk', 'ShiftLeft').ok).toBe(false); // Shift stays reserved for the rack.
});

test('E19 @E19 @E19-AC13 saved maps from before Walk keep their bindings and gain free walk keys', () => {
  const { entries, storage } = memory();
  const { walk: _walk, ...old } = structuredClone(defaultBindings); void _walk;
  entries.set(bindingStorageKey, JSON.stringify({ version: 1, bindings: { ...old, interact: ['Mouse1', 'KeyC'] } }));
  const bindings = new Bindings(storage);
  expect(bindings.action('KeyC')).toBe('interact'); expect(bindings.action('AltLeft')).toBe('walk'); expect(bindings.get().walk).toEqual(['AltLeft', 'AltRight']);
});
