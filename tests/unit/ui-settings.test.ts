import { expect, test } from 'vitest';
import { Settings, settingsKey } from '../../src/ui/Settings';
test('@E14 settings persist valid values and reject corrupt values', () => {
  const saved = new Map<string, string>();
  const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value); } };
  const settings = new Settings(storage);
  settings.patch({ textSize: 1.5, cameraShake: false, aimAssist: 'Off' });
  expect(new Settings(storage).value).toMatchObject({ textSize: 1.5, cameraShake: false, aimAssist: 'Off' });
  saved.set(settingsKey, '{"textSize":4,"quality":"broken","muted":"yes"}');
  expect(new Settings(storage).value).toMatchObject({ textSize: 1, quality: 'auto', muted: false });
  saved.set(settingsKey, 'broken');
  expect(new Settings(storage).value.textSize).toBe(1);
});
