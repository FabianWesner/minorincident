import type { EntitySnapshot } from '../sim/world/types';
import type { SoundPosition } from '../data/audioEvents';

/** Use the telegraph's camera visibility and the sim's sight blockers, including L1 gates/curtains. */
export function isMusicThreat(entity: EntitySnapshot, listener: SoundPosition,
    inView: (position: SoundPosition) => boolean,
    lineOfSight: (from: SoundPosition, to: SoundPosition) => boolean): boolean {
    return !entity.hidden && !!entity.infected && entity.health.current > 0 && entity.infected.state !== 'dead'
        && Math.hypot(entity.transform.x - listener.x, entity.transform.z - listener.z) <= 12
        && inView(entity.transform) && lineOfSight(listener, entity.transform);
}
