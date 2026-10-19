import { expect, test } from 'vitest';
import { devicePrompt } from '../../../src/ui/devicePrompt';

test.each([
  ['Let everyone pass · E to close the gate', 'Let everyone pass · ACTION to close the gate'],
  ['Push glowing crates onto the line · E to brace', 'Push glowing crates onto the line · ACTION to brace'],
  ['Barricade the gap: press E / middle-click to brace the crates', 'Barricade the gap: tap ACTION to brace the crates'],
  ['E / middle-click · wear the headlamp', 'ACTION · wear the headlamp'],
  ['Hold still or press E: open the truck cab', 'Hold still or tap ACTION: open the truck cab'],
  ['Stand here or press E to ride', 'Stand here or tap ACTION to ride'],
  ['Press E or tap the console action', 'Tap ACTION or tap the console action'],
  ['Stand / F / MMB', 'Stand / ACTION'],
  ['Let everyone pass', 'Let everyone pass'],
])('touch prompt: %s', (desktop, touch) => {
  expect(devicePrompt(desktop, true)).toBe(touch);
  expect(devicePrompt(desktop, false)).toBe(desktop);
});
