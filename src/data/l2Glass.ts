/** Supermarket glass planes and what the trapped civilians play at them (mirrors `LevelTwoRescue.glassClip`). */
export type GlassRoleName = 'bang' | 'press' | 'plead' | 'look' | 'cower' | 'hug' | 'child';
/** Inner face of the east front glass (plane x = value) and of the south loading-door side (plane z = value). */
export const GLASS_EAST_X = -51.57;
export const GLASS_SOUTH_Z = -38.25;
/** Hand mesh extends past the hand pivot. */
export const HAND_MARGIN_M = 0.1;
export const ROLE_CLIPS: Record<GlassRoleName, readonly string[]> = {
  bang: ['npc-glance', 'npc-bang', 'npc-press'],
  press: ['npc-glance', 'npc-press', 'npc-bang'],
  plead: ['npc-glance', 'npc-plead'],
  look: ['npc-plead', 'npc-glance'],
  hug: ['npc-hug'],
  cower: ['npc-cower'],
  child: ['npc-cower'],
};
/** Largest forward reach of any hand/forearm joint from the figure's root per clip (metres), measured with
 * `tools/scenelab/trapped-glass.ts` (rounded up). */
export const CLIP_REACH_M: Record<string, number> = { 'npc-glance': .5, 'npc-bang': .52, 'npc-press': .68, 'npc-plead': .56, 'npc-hug': .35, 'npc-cower': .52 };
export const GLASS_GAP_M = 0.05;
