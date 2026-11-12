import { footYaw, summarizeMotion, unplantedClips } from '../../src/debug/scenelab/motion';

export interface VehicleMotionFrame {
  frame: number; tick: number; clip: string; archetype: string; state: string; floor: number;
  feet: { heel: number[]; toe: number[] }[];
  reaction: { heavy: boolean; started: number; until: number } | null;
  special: string | null; rising: boolean;
  alphaType?: string; phase?: number; speed?: number;
}

/** Keep missing contacts distinct from zero slide, and verify every exclusion. */
export function vehicleTrackVerdict(key: string, frames: VehicleMotionFrame[]) {
  const motion = summarizeMotion(frames.map(f => ({ ...f,
    // Pounce/charge names alone cannot exempt planted feet from slide checks.
    clip: /^alpha-(pounce|charge)$/.test(f.clip) ? 'vehicle-special-motion' : f.clip,
    feet: f.feet.map(foot => ({ ...foot, yaw: footYaw(foot.heel, foot.toe) })),
  })));
  const feet = frames.length && /infected\.(dog|cat|lion|lioness|zebra|gorilla|elephant|monkey)$/.test(frames[0].archetype) ? 4 : 2;
  const complete = frames.length > 0 && frames.every(f => Number.isFinite(f.floor) && f.feet.length === feet
    && f.feet.every(foot => [foot.heel, foot.toe].every(point => point.length === 3 && point.every(Number.isFinite))));
  const airborne = (f: VehicleMotionFrame) => f.feet.every(foot => Math.min(foot.heel[1], foot.toe[1]) > f.floor + .012);
  const matchingAction = (f: VehicleMotionFrame) => /^(knockdown|flung|get-up)$/.test(f.clip) && f.reaction?.heavy
    && f.reaction.started <= f.tick && f.tick < f.reaction.until
    || f.clip === 'alpha-pounce' && f.special === 'alpha.pounce'
    || f.clip === 'alpha-pounce' && f.alphaType === 'leaper' && (f.speed ?? Infinity) <= .06 && Math.abs((f.phase ?? Infinity) - .22) <= 1e-6
    || f.clip === 'alpha-charge' && f.special === 'alpha.charge'
    || f.clip === 'infection-rise' && f.rising;
  const actionsMatched = frames.every(f => !unplantedClips.test(f.clip) || matchingAction(f));
  const airborneAttachment = complete && frames.every(f => f.state === 'attached' && airborne(f));
  const matchedReaction = complete && frames.every(f => matchingAction(f)
    && (!/^alpha-(pounce|charge)$/.test(f.clip) || airborne(f) && f.special === `alpha.${f.clip.slice(6)}`));
  const classification = motion.slideP95Cm !== null ? 'grounded' : airborneAttachment ? 'airborne-attachment' : matchedReaction ? 'matched-unplanted-action' : 'unproven';
  const pass = complete && actionsMatched && (classification === 'grounded' ? motion.slideMaxCm <= 15 && motion.slideP95Cm! <= 5 : classification !== 'unproven');
  return { key, classification, complete, actionsMatched, pass, motion };
}
