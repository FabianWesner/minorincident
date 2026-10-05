/** Authoritative palette tokens from 01-art-direction §3; shared by placeholders and imported assets. */
import tokens from '../assets/palette.json';
export const palette = tokens;
export type PaletteToken = keyof typeof palette;
export const paletteTokens = Object.keys(palette) as PaletteToken[];
