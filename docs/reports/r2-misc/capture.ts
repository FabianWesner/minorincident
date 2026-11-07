import { mkdirSync, writeFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../../../tools/scenelab/session';
import type { Game } from '../../../src/Game';
const level = process.env.CAP_LEVEL ?? 'L3', label = process.env.CAP_LABEL ?? 'before', out = `test-results/r2-misc/${level}-${label}`;
mkdirSync(out, { recursive: true });
try {
    for (const tier of ['low', 'high'] as const) {
        const s = new SceneSession({ tier, backend: 'webgl2', query: { ui: '1' } });
        try {
            await s.open();
            await s.page.evaluate('window.__name=f=>f');
            await s.page.evaluate(async ({ tier, level }) => { const a = window.__SS__!, g = (window.__SCENE__ as unknown as {
                game: Game;
            }).game; await a.loadLevel(level, { seed: 1, progression: level === 'L3' ? 'L3-default' : 'L9-default' }); a.settings.set({ quality: tier, vfx: true, cameraShake: false, cheapDof: false }); a.missions.begin(); a.pause(); a.camera.follow(); if (level === 'L3') {
                a.cheats.god(true);
                a.teleport(1, { x: 177.14456, z: -.22628 });
                g.view.view.reset(g.world.entities.get(1)!.transform);
                await a.step(600);
            }
            else {
                const c = g.world.vehicles!.cars.get(g.world.missions!.l9!.state.carId)!;
                g.world.vehicles!.damage(c.entity.id, c.entity.health.max);
                g.driver = null;
                g.ui.show(null);
                g.input.release();
                g.world.clearInput();
            } }, { tier, level });
            if (level === 'L9') {
                await s.page.locator('canvas').first().focus();
                await s.page.keyboard.down('KeyW');
                await s.page.evaluate(() => window.__SS__!.resume());
                await new Promise(r => setTimeout(r, 4000));
                await s.page.evaluate(() => window.__SS__!.pause());
                await s.page.keyboard.up('KeyW');
            }
            for (const zoom of [.5, 1.5]) {
                await s.page.evaluate(async (z) => { window.__SS__!.camera.zoom(z); await window.__SS__!.screenshotReady(); }, zoom);
                await s.page.screenshot({ path: `${out}/${tier}-z${zoom}.png` });
            }
            const state = await s.page.evaluate(() => { const g = (window.__SCENE__ as unknown as {
                game: Game;
            }).game; return { tick: g.world.tick, player: g.world.entities.get(1)!.transform, vfx: g.view.vfx?.snapshot(), vehicles: [...g.world.entities.iterate()].filter(e => e.vehicle).map(e => ({ id: e.id, hp: e.health.current, transform: e.transform, vehicle: e.vehicle })) }; });
            writeFileSync(`${out}/${tier}.json`, JSON.stringify({ state, errors: s.errors }, null, 2));
            console.log(level, tier, JSON.stringify(state));
        }
        finally {
            await s.close();
        }
    }
}
finally {
    stopServer();
}
