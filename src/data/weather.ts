/** E28 authored weather. Campaign is one late-summer day; snow is replay-only. */
export const weatherKinds = ['clear', 'clouds', 'overcast', 'haze', 'fog', 'rain', 'thunderstorm', 'wind', 'snow', 'ash', 'none'] as const;
export type WeatherKind = typeof weatherKinds[number];
export interface WeatherPreset { rain: number; flakes: number; fog: number; wind: number; clouds: number }
export const weatherPresets: Record<WeatherKind, WeatherPreset> = {
  clear: { rain: 0, flakes: 0, fog: 0, wind: .12, clouds: 0 },
  clouds: { rain: 0, flakes: 0, fog: 0, wind: .2, clouds: .4 },
  overcast: { rain: 0, flakes: 0, fog: .08, wind: .25, clouds: 1 },
  haze: { rain: 0, flakes: 0, fog: .25, wind: .4, clouds: .15 },
  fog: { rain: 0, flakes: 0, fog: 1, wind: .05, clouds: .5 },
  rain: { rain: 1, flakes: 0, fog: .18, wind: .35, clouds: .85 },
  thunderstorm: { rain: 1, flakes: 0, fog: .22, wind: .8, clouds: 1 },
  wind: { rain: 0, flakes: 0, fog: 0, wind: .9, clouds: .3 },
  snow: { rain: 0, flakes: 1, fog: .15, wind: .25, clouds: .65 },
  ash: { rain: 0, flakes: .35, fog: .12, wind: .04, clouds: .1 },
  none: { rain: 0, flakes: 0, fog: .08, wind: 0, clouds: 0 },
};
export interface WeatherKey { tick: number; kind: WeatherKind }
export const weatherTimelines: Record<string, readonly WeatherKey[]> = {
  L1: [{ tick: 0, kind: 'clear' }], L2: [{ tick: 0, kind: 'clear' }],
  L3: [{ tick: 0, kind: 'haze' }], L4: [{ tick: 0, kind: 'clear' }],
  L5: [{ tick: 0, kind: 'ash' }], L6: [{ tick: 0, kind: 'none' }],
  'weather-lab': weatherKinds.filter(k => k !== 'none').map((kind, i) => ({ tick: i * 600, kind })),
  'storm-street': [{ tick: 0, kind: 'thunderstorm' }],
};
export const weatherLabels: Record<WeatherKind, string> = { clear: '☀ Clear', clouds: '☁ Clouds', overcast: '☁ Overcast', haze: '◌ Haze', fog: '≋ Fog', rain: '☂ Rain', thunderstorm: 'ϟ Thunderstorm', wind: '≈ Wind', snow: '❄ Snow', ash: '⁙ Ash fall', none: 'Underground' };
