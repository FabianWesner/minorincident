/** L9 damage variants of the E16 licensed engine-low/high and sputter sprites.
 * One pair of persistent engine voices, plus one roughness voice; no new recording or fire cue. */
export const apcEngineStages = [
  { rate: 1, lowpass: 20000, roughness: 0, roughRate: 1 },
  { rate: .96, lowpass: 4800, roughness: .12, roughRate: 1.12 },
  { rate: .89, lowpass: 3100, roughness: .28, roughRate: .98 },
  { rate: .78, lowpass: 1900, roughness: .5, roughRate: .84 },
  { rate: .64, lowpass: 1100, roughness: .8, roughRate: .65 },
] as const;
export const apcDamageCaptions = ['', 'Armor dented — engine straining', 'Glass cracked — engine running rough', 'Engine smoking — lights failing', 'Barely functional — heavy smoke, engine sputtering'] as const;
