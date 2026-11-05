/**
 * Hand-authored non-npm technology credits (PO 10-15: "Make sure in Credits we mention all libs we are using ... and also all technologies").
 * Rendered in the menu credits and THIRD_PARTY_NOTICES.md by tools/credits/generate.ts, after the npm production dependencies and the
 * build/test toolchain (read from package.json, not typed here). Add a row here whenever a new non-npm technology ships or builds the game.
 * Fonts: no font files and no @font-face ship; the UI uses the visitor's system fonts, so there is nothing to credit.
 */
export interface TechnologyCredit { title: string; author: string; url: string; license: string; licenseUrl: string; detail?: string }

export const technologyList: readonly TechnologyCredit[] = [
    { title: 'WebGPU', author: 'W3C GPU for the Web Working Group', url: 'https://www.w3.org/TR/webgpu/', license: 'W3C Software and Document License', licenseUrl: 'https://www.w3.org/copyright/software-license/', detail: 'Browser API: the primary renderer backend.' },
    { title: 'WebGL 2', author: 'Khronos Group', url: 'https://registry.khronos.org/webgl/specs/latest/2.0/', license: 'Khronos specification (royalty-free web API)', licenseUrl: 'https://registry.khronos.org/webgl/specs/latest/2.0/', detail: 'Browser API: the fallback renderer backend.' },
    { title: 'Web Audio API', author: 'W3C Audio Working Group', url: 'https://www.w3.org/TR/webaudio/', license: 'W3C Software and Document License', licenseUrl: 'https://www.w3.org/copyright/software-license/', detail: 'Browser API for spatial audio, music and sound playback.' },
    { title: 'three.js WebGPURenderer and TSL (Three Shading Language)', author: 'three.js authors', url: 'https://threejs.org/docs/#api/en/renderers/WebGPURenderer', license: 'MIT', licenseUrl: 'https://spdx.org/licenses/MIT.html', detail: 'Ships inside the three package listed above: node materials, the WebGPU renderer and its WebGL 2 backend.' },
    { title: 'Rapier physics (WebAssembly build)', author: 'Dimforge', url: 'https://rapier.rs/', license: 'Apache-2.0', licenseUrl: 'https://spdx.org/licenses/Apache-2.0.html', detail: 'Ships as @dimforge/rapier3d-compat, listed above.' },
    { title: 'Blender (headless asset builds)', author: 'Blender Foundation and community', url: 'https://www.blender.org/', license: 'GPL-3.0-or-later (tool only)', licenseUrl: 'https://www.blender.org/about/license/', detail: 'Used offline to build the 3D models; no Blender code ships, and the exported assets are the game\'s own.' },
    { title: 'FFmpeg (audio processing)', author: 'FFmpeg developers', url: 'https://ffmpeg.org/', license: 'LGPL-2.1-or-later / GPL (tool only)', licenseUrl: 'https://ffmpeg.org/legal.html', detail: 'Used offline to cut, filter, loudness-measure and encode the audio sprites; no FFmpeg code ships.' },
    { title: 'Opus codec (libopus) and AAC', author: 'Xiph.Org Foundation and contributors; AAC via the platform encoder', url: 'https://opus-codec.org/', license: 'BSD-3-Clause', licenseUrl: 'https://opus-codec.org/license/', detail: 'The shipped audio sprites are Opus (WebM) with an AAC (M4A) fallback.' },
    { title: 'Cloudflare Pages and Pages Functions', author: 'Cloudflare, Inc.', url: 'https://pages.cloudflare.com/', license: 'Cloudflare Terms of Service (hosted service)', licenseUrl: 'https://www.cloudflare.com/terms/', detail: 'Hosting and the analytics endpoints (with D1 and R2 storage).' },
    { title: 'Hetzner Cloud', author: 'Hetzner Online GmbH', url: 'https://www.hetzner.com/cloud/', license: 'Hetzner Terms and Conditions (hosted service)', licenseUrl: 'https://www.hetzner.com/legal/terms-and-conditions/', detail: 'Remote test runners for unit, simulation and end-to-end suites.' },
    { title: 'GitHub', author: 'GitHub, Inc.', url: 'https://github.com/', license: 'GitHub Terms of Service', licenseUrl: 'https://docs.github.com/en/site-policy/github-terms/github-terms-of-service', detail: 'Source hosting and CI.' },
];
