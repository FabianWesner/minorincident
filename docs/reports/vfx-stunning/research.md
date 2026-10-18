# VFX research — 2026-10-17

Research started 21:50 CEST; selection recorded before implementation (under one hour). Scope: presentation only, existing fixed pools, unchanged damage/game rules and E18 limits.

## Sources and visual principles

- [Three.js fire/smoke particle example](https://threejs.org/examples/webgpu_particles.html) demonstrates layering fire and smoke in the WebGPU renderer. [TSL reference](https://threejs.org/docs/pages/TSL.html) documents instancing, camera matrices and viewport depth; these primitives already power FxPool. [MIT licence](https://github.com/mrdoob/three.js/blob/dev/LICENSE).
- [Artist discussion and original Overwatch inspired explosion breakdown](https://realtimevfx.com/t/stylized-cartoon-explosion-overwatch-inspired/1767): fast attention cue, expanding extent, quieter aftermath. Apply the timing principle at the game camera; do not copy the artwork, GIFs or code (no permissive grant assumed).
- [Artist feedback on explosion construction](https://realtimevfx.com/t/looking-for-feedback-on-explosion-vfx/29528): directional debris clusters, ground dust and radial scorch. Visual ideas only; no downloaded assets/code.
- [Hades lava reconstruction by its author](https://realtimevfx.com/t/hades-lava-practice/17484) documents a stylized isometric effect study and gradient mapping feedback. The transferable idea is a limited heat palette over moving monochrome masks; our existing fire cards already use that approach. The original Supergiant breakdown link was discovered but returned HTTP 403, so no implementation claims are based on it.
- Local source: specs/07-physics-props-explosions-smoke.md, specs/08-bruno-reuse-map.md, existing FxPool/Blasts/Vfx. Bruno checkout absent in this worktree; existing adaptations carry MIT/41046b5 attribution. Preserve those shaders and patterns instead of importing another particle library.

An isometric camera makes silhouette, travel direction and staged timing more useful than tiny texture detail. Keep the floor visible between fragments, the player visible through smoke, and telegraphs distinct from aftermath. Existing fireballs, lit volumetric puffs, noise scrolling flames, light-field flashes, hit-stop and shake already cover expensive foundation work.

## Survey and selection

Cost entries are structural estimates for low tier, **not measured milliseconds**. Actual Scene Lab timing/counters are reported separately; native ms require the permitted quiet window. All selected masks are original analytical TSL, with no new image assets, downloads or licences.

| Technique | Look gain at game camera | Low tier cost / risk | WebGL2 + WebGPU feasibility | Licence / decision |
| --- | --- | --- | --- | --- |
| Soft particles / depth fade | Removes hard floor/wall cuts | Existing single depth copy per particle draw; no new pass | Existing OwnedDepth + linearDepth TSL on both | Existing MIT adaptation; retain |
| Smoke flipbook / atlas | Strong evolving billows | Texture fetch + atlas memory; authoring/temporal aliasing at small size | TSL texture/UV works on both | Generate ourselves if adopted; defer atlas; select coherent procedural lobes for dust |
| GPU instancing / analytical motion | Many fragments without JS updates | Existing one quad draw and fixed attributes; no compute dispatch | Vertex TSL translates to GLSL/WGSL; already implemented | Three MIT; retain and extend |
| Velocity aligned spark ribbons | Direction and energy readable over a few pixels | Replace dots one for one; four vertices, short lifetime, unchanged pool | Camera basis + ballistic tangent in vertex TSL | Original mask; **pick 1** |
| Short muzzle star / impact glint | Crisp shot onset and contact | Replace existing muzzle swarm with one star + fewer fragments; no new light pass | Analytical mask in shared material | Original mask; **pick 2** |
| Expanding coherent dust/smoke lobes | Volume without glittering hash speckle | Replace existing quads; simple smooth lobes; growth bounded to original size | Arithmetic TSL, existing depth fade | Original mask; **pick 3** |
| Broken expanding shockwave | Blast extent and fast pressure cue | Existing ground slot; smooth annulus with broad modulation | Arithmetic TSL, no scene texture | Original mask; **pick 4** |
| Screen space distortion | Strong heat / shockwave lensing | Additional color sampling/copy, ordering complications, fills screen | Possible in TSL, requires atmosphere pipeline ownership | Defer; request hook only if future profiling supports it |
| Radial scorch decal | Anchors impact and aftermath | Replace existing ground slot; no texture or new draw | Arithmetic TSL | Original mask; **pick 5** |
| Muzzle flash light pulse | Integrates weapon with walls/floor | New transient registration per shot; crowded MG scene increases light-field work | Existing BlastLight API supports both | Existing code, defer extra light sources until quiet profile |
| Debris with physics | Weight and secondary movement | Rapier bodies expensive; existing 12 sheet-metal slots / 120 vs 40 debris cap | Existing sim bodies + instanced meshes on both | Existing MIT adaptation; retain, no extra bodies |
| Ember / ash trails | Sustained fire reads as hot moving air | Reuse sparse existing embers (2 Hz low); no extra sprites per source | Same ballistic ribbon path with gentle upward drift | Original mask; **pick 6** |
| Noise scrolling fire | Irregular tongues and hot low core | Already several noise samples per fragment; avoid another octave | Existing TSL flame shader on both | Existing Bruno MIT adaptation; retain |
| Directional blood droplets | Distinguishes heavy impact from smoke | Existing droplets become compact stretched teardrops; same count, lifetime, gravity | Ballistic tangent + mask TSL | Original mask; **pick 7**; Full/Reduced/Off preserved |
| Impact frames / hit-stop / camera shake | Contact weight without particle density | Existing HitStop and distance scaled shake; no render pass | CPU presentation clock, backend independent | Existing code; preserve durations and accessibility |

## Implementation constraints

Keep 2048/512 general-particle slots, 400/120 puff slots, 48 fireballs, 128 flame cards, 16 waves and 64 scorch slots. Reuse spawn attributes and prewarm the same material. No per-shot geometries, materials, textures, physics bodies or light registrations. Existing diagnostic shot records predate this lane. Low tier keeps each selected silhouette with the existing reduced emission counts; flash reduction scales new emissive output. Ground ring reaches the same radius at 0.4 s for E15, telegraph shaders remain separate. Fix any newly exposed support-height errors only inside owned view code.
