import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('@E14-AC05 #75 radar, weather and objective share vertical flow across responsive layouts', () => {
  const hud = readFileSync('src/ui/Hud.ts', 'utf8'), css = readFileSync('src/ui/ui.css', 'utf8');
  expect(hud).toContain('navigation.append(this.map, this.weatherIcon, this.tracker)');
  expect(hud).not.toContain("top:170px");
  expect(css).toMatch(/\.hud-navigation\{[^}]*display:flex;flex-direction:column;align-items:center;gap:8px/);
  expect(css).toMatch(/\.hud-navigation \.hud-map\{[^}]*position:relative;inset:auto/);
  expect(css).toMatch(/\.hud-navigation \.hud-tracker\{[^}]*position:relative;inset:auto/);
  expect(css).toMatch(/\.hud-pin-follower\{[^}]*background:#57aaff/);
});
