import { defaultBindings, type Action, type BindingMap } from '../data/bindings';
export const bindingStorageKey = 'minor-incident.bindings.v1';
const validCode = (code: string): boolean => /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Escape|Tab|Enter|Backspace|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|F([1-9]|1[0-2])|Mouse[012])$/.test(code);

/** Versioned action map. Invalid saved maps fall back to defaults; conflicts never replace a bind. */
export class Bindings {
  private map: BindingMap = structuredClone(defaultBindings);
  constructor(private readonly storage?: Pick<Storage, 'getItem' | 'setItem'>) {
    try {
      const text = storage?.getItem(bindingStorageKey);
      if (text) {
        const saved = JSON.parse(text);
        // Maps saved before Walk existed gain its defaults where those keys are still free.
        if (saved?.bindings && typeof saved.bindings === 'object' && !saved.bindings.walk) {
          const used = new Set(Object.values(saved.bindings as Record<string, unknown>).flat());
          saved.bindings.walk = defaultBindings.walk.filter(code => !used.has(code));
        }
        if (saved.version === 1 && this.valid(saved.bindings)) {
          this.map = saved.bindings;
          for (const name of Object.keys(this.map) as Action[]) this.map[name] = this.map[name].filter(code => code !== 'Mouse2');
          this.map.selector.unshift('Mouse2');
        }
      }
    } catch { /* Storage unavailable or corrupt: keep defaults. */ }
  }
  private valid(map: BindingMap): boolean {
    if (!map || Object.keys(map).length !== Object.keys(defaultBindings).length) return false;
    const seen = new Set<string>();
    for (const action of Object.keys(defaultBindings) as Action[]) {
      if (!Array.isArray(map[action]) || !map[action].length) return false;
      for (const code of map[action]) { if (typeof code !== 'string' || !validCode(code) || seen.has(code)) return false; seen.add(code); }
    }
    return true;
  }
  action(code: string): Action | null {
    for (const action in this.map) if (this.map[action as Action].includes(code)) return action as Action;
    return null;
  }
  /** Current keyboard glyph without copying the action map each HUD frame. */
  keyLabel(action: Action): string { return this.map[action].find(code => !code.startsWith('Mouse'))?.replace('Key', '') ?? ''; }
  get(): BindingMap { return structuredClone(this.map); }
  /** Replaces this action's keyboard alternatives, retaining its fixed mouse mirror. */
  rebind(action: Action, code: string): { ok: boolean; message: string } {
    if (!Object.hasOwn(defaultBindings, action) || !validCode(code) || code.startsWith('Mouse')) return { ok: false, message: 'Choose a valid keyboard code.' };
    if (/^(Digit[123]|ShiftLeft|ShiftRight)$/.test(code)) return { ok: false, message: `${code} is reserved for rack selection.` };
    const conflict = this.action(code);
    if (conflict && conflict !== action) return { ok: false, message: `${code} is already bound to ${conflict}.` };
    const next = structuredClone(this.map);
    next[action] = [...next[action].filter((key) => key.startsWith('Mouse')), code];
    try { this.storage?.setItem(bindingStorageKey, JSON.stringify({ version: 1, bindings: next })); }
    catch { return { ok: false, message: 'Bindings could not be saved.' }; }
    this.map = next; return { ok: true, message: `${action} bound to ${code}.` };
  }
}
