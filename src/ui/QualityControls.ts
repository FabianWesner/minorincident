import type { Quality, QualitySetting } from '../core/Quality';
/** Small settings integration until E14 owns the complete settings menu. */
export class QualityControls {
  private readonly element = document.createElement('label');
  readonly select = document.createElement('select');
  constructor(quality: Quality, set: (setting: QualitySetting) => void) {
    this.element.dataset.qualityControls = '';
    this.element.style.cssText = 'position:fixed;top:calc(190px + env(safe-area-inset-top));right:max(12px,env(safe-area-inset-right));padding:8px;background:#182333;color:white;font:14px sans-serif;z-index:4';
    this.element.append('Quality '); this.select.setAttribute('aria-label', 'Graphics quality');
    for (const value of ['auto', 'high', 'low'] as const) { const option = document.createElement('option'); option.value = value; option.textContent = value; this.select.append(option); }
    this.select.value = quality.setting;
    this.select.addEventListener('change', () => set(this.select.value as QualitySetting));
    this.element.append(this.select); document.body.append(this.element);
  }
  dispose(): void { this.element.remove(); }
}
