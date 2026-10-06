import { expect, test } from 'vitest';
import { action } from '../../../src/data/actions/catalog';
import { noise, noiseForAction } from '../../../src/data/noise';
import { SimWorld } from '../../../src/sim/world/SimWorld';
test('T-E16-02 @E16 @E16-AC02 a pistol emits one 25m noise heard by AI and audio subscriber', async () => {
    const world = new SimWorld();
    await world.init();
    world.loadScenario('horde-arena');
    try {
        world.combat!.damage.god = true;
        const inside = world.infected!.spawn('infected.runner', { x: 24, z: 0 }, { state: 'idle' });
        const outside = world.infected!.spawn('infected.runner', { x: 26, z: 0 }, { state: 'idle' });
        const audio: unknown[] = [];
        world.events.on('noise', e => audio.push(e));
        world.combat!.setLoadout(['weapon.pistol'], ['weapon.fists']);
        world.setInput({ left: { down: true, held: true, up: false }, aim: { x: 0, z: 1 } });
        world.update();
        const events = world.events.events().filter(e => e.type === 'noise');
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ radius: noise.pistol.radius, loudness: 1, actionId: 'weapon.pistol' });
        expect(audio).toEqual(events);
        expect(world.entities.get(inside)!.infected!.state).toBe('alerted');
        expect(world.entities.get(outside)!.infected!.state).toBe('idle');
        expect(action('weapon.pistol').noiseRadius).toBe(25);
        for (const [id, radius] of [['pistol', 25], ['smg', 25], ['shotgun', 35], ['assault-rifle', 35], ['machine-gun', 40]] as const) {
            expect(action(`weapon.${id}`).noiseRadius).toBe(radius);
            expect(noiseForAction(`weapon.${id}`).radius).toBe(radius);
        }
    }
    finally {
        world.dispose();
    }
});
