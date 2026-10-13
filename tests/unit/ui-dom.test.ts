import { expect, test } from 'vitest';
import { style } from '../../src/ui/dom';

test('unchanged fractional CSS positions are written once and external edits are repaired', () => {
  let actual = '', writes = 0;
  const element = { style: {
    getPropertyValue: () => actual,
    setProperty: (_name: string, value: string) => { writes++; actual = `${Number.parseFloat(value).toFixed(3)}px`; },
  } } as unknown as HTMLElement;
  for (let i = 0; i < 100; i++) style(element, 'left', '123.456789px');
  expect(writes).toBe(1); expect(actual).toBe('123.457px');
  actual = '0px'; style(element, 'left', '123.456789px');
  expect(writes).toBe(2); expect(actual).toBe('123.457px');
  style(element, 'left', '124.123456px');
  expect(writes).toBe(3); expect(actual).toBe('124.123px');
});
