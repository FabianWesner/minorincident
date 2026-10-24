// Adapted from folio-2025 Options.js by Bruno Simon (MIT, 41046b5): persisted options.
import type { AimAssistSetting } from '../sim/combat/AimAssist';
export interface UISettings {
  textSize: 1 | 1.25 | 1.5;
  aimAssist: AimAssistSetting;
  gore: 'Off' | 'Reduced' | 'Full';
  cameraShake: boolean;
  flashReduction: boolean;
  colorblind: boolean;
  quality: 'high' | 'low' | 'auto';
  muted: boolean;
  /** E27 bullet time on big nearby blasts. */
  slowMotion: boolean;
}
export const settingsKey = 'minor-incident.ui.v1';
const defaults: UISettings = { textSize: 1, aimAssist: 'Default', gore: 'Full', cameraShake: true, flashReduction: false, colorblind: false, quality: 'auto', muted: false, slowMotion: true };
export class Settings {
  readonly value: UISettings = { ...defaults };
  constructor(private readonly storage?: Pick<Storage, 'getItem' | 'setItem'>) {
    try { this.patch(JSON.parse(storage?.getItem(settingsKey) ?? '{}'), false); } catch { /* Safe defaults. */ }
  }
  patch(patch: Partial<UISettings>, save = true): void {
    for (const key of Object.keys(defaults) as (keyof UISettings)[]) {
      const value = patch[key];
      const valid = typeof defaults[key] === 'boolean' ? typeof value === 'boolean'
        : key === 'textSize' ? [1, 1.25, 1.5].includes(value as number)
        : key === 'aimAssist' ? ['Off', 'Low', 'Default', 'High'].includes(String(value))
        : key === 'gore' ? ['Off', 'Reduced', 'Full'].includes(String(value))
        : ['high', 'low', 'auto'].includes(String(value));
      if (valid) Object.assign(this.value, { [key]: value });
    }
    if (save) { try { this.storage?.setItem(settingsKey, JSON.stringify(this.value)); } catch { /* Session settings still work. */ } }
  }
}
