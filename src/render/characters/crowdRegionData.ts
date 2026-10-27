/** Texel classes of textured crowd atlases, stored as alpha = (class + 1) / 7 (never 0: premultiplying tools erase colour there) (tools/assets/skin-crowd-regions.ts).
 * hair/skin/shirt/trousers take the person's crowd tint; skinMask only marks uniformed skin for the infection mask;
 * authored paint keeps its colour. An opaque atlas (6) predates the classes and keeps the painted-skin heuristic. */
export const crowdRegion = { hair: 0, skin: 1, shirt: 2, trousers: 3, skinMask: 4, authored: 5 } as const;
export const crowdRegionLegacy = 6;
/** Linear luminance each tinted region is normalised to at build time; the shader divides by it to recover shading. */
export const crowdRegionLuminance = { hair: .05, skin: .38, shirt: .24, trousers: .06 } as const;
