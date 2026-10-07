// Adapted from Bruno Simon folio-2025 Debug.js (MIT).
import { Pane } from 'tweakpane';
import { missionControls } from '../sim/missions/controls';
import type { Game } from '../Game';
import { lookRanges } from '../data/lookPatch';
import { lookViewpoints } from '../data/lookViewpoints';
import type { WorldLook } from '../data/worldLook';
import type { PaletteToken } from '../data/palette';

/** One query-gated panel: dev ?debug and production ?lookdev share live renderer bindings. */
export class Debug {
  private readonly pane = new Pane({ title: 'Minor Incident · Look' });
  constructor(game: Game) {
    const container = this.pane.element.parentElement!;
    Object.assign(container.style, { zIndex: '100', maxHeight: '90vh', overflowY: 'auto', width: 'min(310px, 85vw)' });
    container.dataset.lookdev = 'panel';
    for (const event of ['pointerdown', 'wheel', 'keydown']) container.addEventListener(event, e => e.stopPropagation());
    const state = game.view.getState();
    const controls = { timeScale: 1, timeOfDay: state.lighting?.preset ?? 'golden', bloom: true, cheapDof: state.postFx?.dof ?? false, cameraShake: true, quality: game.quality.setting };
    const rendering = this.pane.addFolder({ title: 'Rendering', expanded: false });
    rendering.addBinding(controls, 'quality', { options: { auto: 'auto', high: 'high', low: 'low' } }).on('change', ({ value }) => game.setQuality(value));
    rendering.addBinding(controls, 'timeOfDay', { options: Object.fromEntries(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'golden', 'night'].map((name) => [name, name])) }).on('change', ({ value }) => game.view.settings({ timeOfDay: value }));
    for (const key of ['bloom', 'cheapDof', 'cameraShake'] as const) rendering.addBinding(controls, key).on('change', ({ value }) => game.view.settings({ [key]: value }));
    const status = document.createElement('output'); status.dataset.lookdev = 'status'; status.style.cssText = 'display:block;padding:8px;font:11px sans-serif;color:#ddd';
    const values: WorldLook = { ...game.view.look.values }, colours = { ...game.view.look.palette };
    const refresh = () => { Object.assign(values, game.view.look.values); Object.assign(colours, game.view.look.palette); this.pane.refresh(); };
    const folders = {
      surfaces: this.pane.addFolder({ title: 'Surface colours', expanded: false }),
      light: this.pane.addFolder({ title: 'Light & shadow', expanded: false }),
      fog: this.pane.addFolder({ title: 'Fog', expanded: false }),
      post: this.pane.addFolder({ title: 'Bloom · DOF · vignette', expanded: false }),
      nature: this.pane.addFolder({ title: 'Grass · foliage · wind', expanded: false }),
    };
    for (const key of Object.keys(values) as (keyof WorldLook)[]) {
      const folder = /^(fog)/.test(key) ? folders.fog : /^(dof|bloom|vignette)/.test(key) ? folders.post
        : /^(grass|foliage|wind|leaf|petal|dust|bird)/.test(key) ? folders.nature : /^(asphalt|sidewalk)/.test(key) ? folders.surfaces : folders.light;
      const options = typeof values[key] === 'number' ? (() => { const [min, max, step] = lookRanges[key as keyof typeof lookRanges]; return { min, max, step }; })() : {};
      folder.addBinding(values, key, options).on('change', () => {
        try { game.view.setLook({ version: 1, worldLook: { [key]: values[key] }, palette: {} }); status.textContent = 'Live edit applied'; }
        catch (error) { status.textContent = (error as Error).message; refresh(); }
      });
    }
    const palette = this.pane.addFolder({ title: 'Palette swatches', expanded: false });
    for (const key of Object.keys(colours) as PaletteToken[]) palette.addBinding(colours, key).on('change', () => {
      game.view.setLook({ version: 1, worldLook: {}, palette: { [key]: colours[key] } }); status.textContent = 'Live palette edit applied';
    });
    this.pane.addButton({ title: 'Export JSON patch' }).on('click', () => {
      const blob = new Blob([JSON.stringify(game.view.look.export(), null, 2) + '\n'], { type: 'application/json' });
      const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'world-look.patch.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); status.textContent = 'Exported world-look.patch.json';
    });
    this.pane.addButton({ title: 'Reset look' }).on('click', () => { game.view.resetLook(); refresh(); status.textContent = 'Restored checked-in look'; });
    const views = this.pane.addFolder({ title: 'Viewpoints & time', expanded: false });
    views.addButton({ title: 'Load L1' }).on('click', () => { void game.loadLevel('L1', { seed: 1 }); });
    for (const spot of lookViewpoints) views.addButton({ title: `${spot.id} ${spot.name}` }).on('click', () => {
      if (!game.world.districts) { status.textContent = 'Load L1 first'; return; }
      missionControls(game.world).teleport('player', spot); game.view.preset(spot.id);
    });
    views.addButton({ title: 'Lookdev fixture' }).on('click', () => { void game.loadScenario('lookdev'); });
    for (const spot of ['overview', 'street', 'shadow-probe']) views.addButton({ title: spot }).on('click', () => { if (game.world.scenario === 'lookdev') game.view.preset(spot); });
    views.addBinding(controls, 'timeScale', { min: 0, max: 20, step: .1 }).on('change', ({ value }) => game.clock.setTimeScale(value));
    views.addButton({ title: 'Pause' }).on('click', () => game.clock.pause());
    views.addButton({ title: 'Resume' }).on('click', () => game.clock.resume());
    views.addButton({ title: 'Step' }).on('click', () => { game.clock.pause(); void game.step(1); });
    this.pane.element.appendChild(status);
  }
  dispose(): void { this.pane.dispose(); }
}
