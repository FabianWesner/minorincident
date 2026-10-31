/** Batch 46 VQA (slim build), live levels: crowd/NPC clusters, infected attacking, corpses day/night, male courier.
 * SCENE_PORT=4892 E2E_PORT=4891 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/batch46-live.ts [high|low] [L1,L3,...]
 * Frames go to test-results/batch46-vqa/live (git-ignored).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer } from '../scenelab/session';

const tiers = (process.argv[2] ? [process.argv[2]] : ['high', 'low']) as ('high' | 'low')[];
const levels = (process.argv[3] ?? 'L1,L2,L3,L4,L7,L9').split(',');
const gearFor: Record<string, number> = { L1: 0, L2: 1, L3: 2, L4: 2, L7: 3, L9: 4 };
const out = process.env.VQA_OUT ?? 'test-results/batch46-vqa/live';
mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
try {
  for (const tier of tiers) {
    const s = new SceneSession({ tier, backend: 'webgpu', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
    const shot = async (name: string, zooms = [0.5, 1.5]) => {
      for (const zoom of zooms) {
        await s.page.evaluate(async zoom => { const a = window.__SS__!; a.camera.zoom(zoom); await a.step(1); await a.screenshotReady(); }, zoom);
        await s.page.screenshot({ path: `${out}/${name}-z${zoom}.jpg`, type: 'jpeg', quality: 82 });
      }
    };
    try {
      await s.open();
      for (const level of levels) {
        const gear = gearFor[level] ?? 2;
        const info = await s.page.evaluate(async ({ level, tier, gear }) => {
          const a = window.__SS__!;
          await a.loadLevel(level, { seed: 46, ...(level === 'L1' ? {} : { progression: `${level}-default` as never }) });
          a.pause(); a.cheats.god(true); a.settings.set({ quality: tier });
          await a.survivor.select('male', gear as never);
          a.camera.follow();
          if (a.missions.state()?.phase === 'briefing') a.missions.begin();
          a.resume(); await new Promise(r => setTimeout(r, 3000)); a.pause();
          // Leave a start vehicle (L4 bus) by a real interact press so the courier is on foot.
          if ((a.getEntity(1) as unknown as { riding?: number }).riding !== undefined || level === 'L4') { a.input.set({ interact: true }); await a.step(3); a.input.clear(); await a.step(90); }
          const h = a.getEntity(1)!.transform;
          // Densest clusters of civilians/infected (5 m cells), at least 12 m apart.
          const ents = [...a.query({ kind: 'civilian' }), ...a.query({ kind: 'infected' })].filter(e => !(e as unknown as { hidden?: boolean }).hidden);
          const cells = new Map<string, { x: number; z: number; n: number }>();
          for (const e of ents) { const k = `${Math.round(e.transform.x / 6)},${Math.round(e.transform.z / 6)}`; const c = cells.get(k) ?? { x: 0, z: 0, n: 0 }; c.x += e.transform.x; c.z += e.transform.z; c.n++; cells.set(k, c); }
          const picks: { x: number; z: number; n: number }[] = [];
          for (const c of [...cells.values()].sort((p, q) => q.n - p.n)) { const p = { x: c.x / c.n, z: c.z / c.n, n: c.n }; if (picks.every(o => Math.hypot(o.x - p.x, o.z - p.z) > 12)) picks.push(p); if (picks.length >= 2) break; }
          return { start: { x: h.x, z: h.z }, picks, count: ents.length };
        }, { level, tier, gear });
        await s.page.addStyleTag({ content: '#hud,.hud,.mission-tracker,.mission-minimap,.mission-marker,.story-bubble,.mission-toast,.mission-subtitle,#toasts,.toast,[data-testid=mission-button]{visibility:hidden!important}' });
        rows.push({ tier, level, ...info });
        console.log(JSON.stringify({ tier, level, ...info }));
        // Station 0: start, the crowd moving around the courier.
        await s.page.evaluate(async () => { const a = window.__SS__!; a.resume(); await new Promise(r => setTimeout(r, 600)); a.pause(); });
        await shot(`${level}-${tier}-start`);
        for (const [i, p] of info.picks.entries()) {
          await s.page.evaluate(async p => { const a = window.__SS__!; a.teleport(1, { x: p.x + 2.5, z: p.z + 2.5 }); a.resume(); await new Promise(r => setTimeout(r, 900)); a.pause(); }, p).catch(e => console.log('teleport', String(e)));
          await shot(`${level}-${tier}-crowd${i}`);
        }
        // Infected attacking the (god-mode) courier at the start spot (L4: the bus hides the start, use the first cluster).
        const fightAt = level === 'L4' && info.picks[0] ? { x: info.picks[0].x + 2.5, z: info.picks[0].z + 2.5 } : info.start;
        const fight = await s.page.evaluate(async start => {
          const a = window.__SS__!;
          a.teleport(1, start); await a.step(2);
          const ids: number[] = [];
          for (const [i, arch] of ['infected.runner', 'infected.sprinter', 'infected.runner', 'infected.sprinter', 'infected.runner'].entries()) {
            const ang = i * 1.26;
            try { ids.push(a.spawn(arch, { x: start.x + Math.cos(ang) * 3, z: start.z + Math.sin(ang) * 3 })); } catch (e) { return { error: String(e), ids }; }
          }
          a.resume(); await new Promise(r => setTimeout(r, 2200)); a.pause();
          return { ids };
        }, fightAt);
        console.log(JSON.stringify({ level, fight }));
        await shot(`${level}-${tier}-attack`);
        // Corpses: down everything near the courier, day then night.
        await s.page.evaluate(async () => { const a = window.__SS__!; a.cheats.killAll(); a.resume(); await new Promise(r => setTimeout(r, 2500)); a.pause(); });
        await shot(`${level}-${tier}-corpses`);
        if (level !== 'L9') {
          await s.page.evaluate(async () => { const a = window.__SS__!; a.settings.set({ timeOfDay: 'night' } as never); await a.step(2); });
          await shot(`${level}-${tier}-corpses-night`, [0.5]);
        }
        const probe = await s.page.evaluate(() => { const a = window.__SS__!; const g = (window.__SCENE__ as unknown as { game?: Game } | undefined)?.game; return { corpse: a.debug.corpseLayout(), figures: a.crowdFigures().length, lods: a.crowdFigures().reduce<Record<string, number>>((m, f) => { const l = (f as { lod?: string }).lod ?? '?'; m[l] = (m[l] ?? 0) + 1; return m; }, {}), game: !!g }; });
        rows.push({ tier, level, probe, errors: [...s.errors] });
        console.log(JSON.stringify({ level, probe, errors: s.errors.length }));
      }
    } finally { await s.close(); }
  }
} finally { writeFileSync(`${out}/rows-${tiers.join('-')}-${levels.join('-')}.json`, JSON.stringify(rows, null, 1)); stopServer(); }
