/** Atlas clip order shared by the renderer and CPU preparation workers. */
export const infectedClips = ['idle', 'run', 'swing', 'hurt', 'die', 'crawl', 'windup', 'walk', 'shamble', 'infected-run', 'npc-walk', 'npc-walk-relaxed', 'stagger-left', 'stagger-right', 'knockdown', 'get-up', 'flung', 'death-back', 'death-side', 'death-crumple', 'infection-stagger', 'infection-collapse', 'infection-rise',
  'infected-frail', 'infected-lurch', 'infected-sprint', 'infected-idle', 'infected-search', 'civ-startle', 'civ-flee', 'civ-grabbed', 'zebra-rear-kick', 'zebra-stampede', 'dog-gallop', 'dog-lunge-bite'] as const;
export const civilianClips = [...infectedClips.filter(clip => !clip.startsWith('zebra-') && !clip.startsWith('dog-')), 'npc-sit', 'npc-sit-down', 'npc-stand-up', 'npc-gesture', 'npc-look-around', 'npc-water', 'npc-carry', 'npc-cane',
  'npc-give', 'npc-wave', 'npc-glance', 'npc-sign', 'npc-wave-in', 'npc-bang', 'npc-plead', 'npc-press', 'npc-cower', 'npc-hug', 'ff-pry', 'npc-stand-back', 'shoot'] as const;
export const framesPerClip = 24;
/** r32-alphas: authored Alpha move set (alphaMoveClips.ts), baked only into the humanoid Alpha looks after the shared list,
 * so every shared clip keeps its atlas index. */
export const alphaMoveClips = ['alpha-strike', 'alpha-charge', 'alpha-slam', 'alpha-grab', 'alpha-heave', 'alpha-roar', 'alpha-pounce', 'alpha-bash'] as const;
export const alphaCrowdClips = [...infectedClips, ...alphaMoveClips] as const;
