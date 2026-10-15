/** Player-facing labels for every authored campaign retry checkpoint. */
export const checkpointNames: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  L1: { start: 'the neighborhood', accident: 'the crash site', bat: 'the baseball bat' },
  L2: { start: 'the rescue route', axe: 'the fire axe', doors: 'the bus doors', escape: 'the escape route', cluster: 'the survivors' },
  L3: { start: 'the police station', armory: 'the armory', fallback: 'the police station', 'segment-2': 'the shopping street', 'segment-2b': 'the shopping street', 'segment-3': 'the main road', 'segment-3b': 'the army checkpoint' },
  L4: { start: 'the convoy', arrival: 'the military camp', turn: 'the plaza', 'line-1': 'the first defense line', nests: 'the gun nests', armor: 'the armored vehicles', 'line-break': 'the cellar entrance' },
  L5: { start: 'the neighborhood', outside: 'the safe house', 'survivor-1': 'the first survivor', 'survivor-2': 'the second survivor', 'survivor-3': 'the third survivor', 'survivor-4': 'the fourth survivor', 'survivor-5': 'the fifth survivor' },
  L6: { start: 'the shelter', shelter: 'the shelter', stop: 'the tunnel entrance', abandon: 'the tunnel entrance', retreat: 'the tunnel retreat', 'mid-tunnel': 'the middle of the tunnel', exit: 'the night exit', 'exit-platform': 'the station platform' },
  L7: { start: 'the evacuation route' },
  L8: { start: 'the zoo entrance', sanctuary: 'the sanctuary', breach: 'the breached sanctuary', 'escape-route': 'the escape route' },
  L9: { start: 'the crossing', 'crossing-start': 'the crossing', 'outskirts-approach': 'the outskirts' },
  L10: {
    start: 'the crash site', 'cure-crash': 'the crash site', 'cure-residential': 'the residential district',
    'cure-industrial': 'the industrial district', 'cure-military': 'the military zone',
    'cure-research-entry': 'the research campus', 'cure-research': 'the research lab',
    'cure-corridor': 'the ruined corridor', 'cure-complex': 'the dispersal complex',
    'cure-disperse-ready': 'the dispersal console',
  },
};

/** Resolves a checkpoint into a short phrase suitable after "Retry from". */
export function checkpointName(level: string, checkpoint: string | null): string {
  return checkpointNames[level]?.[checkpoint ?? 'start'] ?? 'the last checkpoint';
}
