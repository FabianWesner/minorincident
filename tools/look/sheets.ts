import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Browser } from '@playwright/test';
import { lookViewpoints } from '../../src/data/lookViewpoints';

export const output = resolve(process.env.LOOK_OUTPUT ?? 'test-results/look-round');
export const gpuArgs = process.platform === 'darwin'
  ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
export const rubric = {
  groundRichness: 'Ground has readable variation, wear, grass transitions and roots; avoid large flat slabs.',
  detailDensity: 'Purposeful clusters and foreground/midground/background detail, with clear combat space.',
  motion: 'Review video or live motion: coherent gusts, ambient life and appealing secondary motion. Stills cannot prove this axis.',
  lightShadow: 'Warm morning key, coloured legible shadows, grounded contact and controlled emissive bloom.',
  dioramaFeel: 'Toy-scale depth, layered framing and miniature blur without obscuring gameplay.',
  colourHarmony: 'Coherent warm palette, purposeful cool accents, peach/pink blossoms; reserve saturated red for permitted accents.',
  figureAppeal: 'Appealing face, proportions, pose and silhouette at actual gameplay scale.',
  figureReadability: 'Survivor, corgi, civilians and infected separate clearly from scenery on both quality tiers.',
};
function dataUrl(path: string): string {
  if (!existsSync(path)) throw new Error(`Missing local reference: ${path}. Set LOOK_MOCKUP / LOOK_BRUNO to the supplied images.`);
  return `data:image/${path.endsWith('.webp') ? 'webp' : 'png'};base64,${readFileSync(path).toString('base64')}`;
}
export async function prepareReview(browser: Browser): Promise<void> {
  mkdirSync(output, { recursive: true });
  const mainRoot = dirname(execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim());
  const mockup = dataUrl(resolve(process.env.LOOK_MOCKUP ?? join(mainRoot, 'initial-drafts/sunset-grove-combat-gameplay-mockup.png')));
  const bruno = dataUrl(resolve(process.env.LOOK_BRUNO ?? join(mainRoot, 'test-results/look-round/ref/bruno-po.webp')));
  const page = await browser.newPage({ viewport: { width: 1920, height: 1100 }, deviceScaleFactor: 1 });
  try {
    await page.setContent('<canvas width="1920" height="1100"></canvas>');
    for (const spot of lookViewpoints) {
      const desktop = dataUrl(join(output, 'desktop', `${spot.id}.png`));
      const portrait = dataUrl(join(output, 'portrait', `${spot.id}.png`));
      const png = await page.evaluate(async ({ desktop, portrait, mockup, bruno, title }) => {
        const canvas = document.querySelector('canvas')!, ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#171a21'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff'; ctx.font = '24px sans-serif'; ctx.fillText(title, 20, 32);
        // Each reference is an overall style target, not a matching geographic view.
        const cells = [desktop, mockup, bruno, portrait, mockup, bruno];
        const labels = ['Ours · desktop high · 1600×900', 'Mockup · style target', 'Bruno PO · style target', 'Ours · iPhone portrait low · 390×844', 'Mockup · style target', 'Bruno PO · style target'];
        for (let i = 0; i < cells.length; i++) {
          const img = new Image(); img.src = cells[i]; await img.decode();
          const x = (i % 3) * 640 + 10, y = i < 3 ? 50 : 460, width = 620, height = i < 3 ? 360 : 590;
          ctx.fillStyle = '#ffffff'; ctx.font = '18px sans-serif'; ctx.fillText(labels[i], x, y + 20);
          const scale = Math.min(width / img.width, (height - 30) / img.height);
          ctx.drawImage(img, x + (width - img.width * scale) / 2, y + 30 + (height - 30 - img.height * scale) / 2, img.width * scale, img.height * scale);
        }
        return canvas.toDataURL('image/png').split(',')[1];
      }, { desktop, portrait, mockup, bruno, title: `${spot.id} · ${spot.name} · (${spot.x}, ${spot.z}) · seed 1 · simulation paused` });
      writeFileSync(join(output, `${spot.id}-sheet.png`), Buffer.from(png, 'base64'));
    }
    const template = { reviewer: '', commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), scale: '1–10; target >=8 on every axis; null = insufficient evidence', motionEvidence: '', viewpoints: lookViewpoints.map(spot => ({ ...spot, tiers: ['desktop-high', 'portrait-low'].map(tier => ({ tier, scores: Object.fromEntries(Object.keys(rubric).map(key => [key, null])), evidence: '', improvements: [] })) })) };
    writeFileSync(join(output, 'scores-template.json'), JSON.stringify(template, null, 2) + '\n');
    writeFileSync(join(output, 'reviewer.md'), `# Independent look review\n\nReview V1–V6-sheet.png and the twelve original PNGs. Columns: ours | mockup | Bruno PO. References are style targets, not geographic matches. Judge both tiers independently; do not assume new code improved the look.\n\nScore each axis 1–10: 1–3 poor, 4–5 basic, 6–7 good with obvious gaps, 8 strong/target met, 9–10 exceptional. Require a concrete visible reason per score and rank the three largest gaps. Target: >=8 on every axis at every viewpoint/tier. Never average away a failing axis.\n\n${Object.entries(rubric).map(([key, description]) => `- **${key}**: ${description}`).join('\n')}\n\nCopy scores-template.json to scores.json and fill it; use null when evidence is absent. Motion requires a clip or live review (record path/URL/time in motionEvidence); still captures are paused and cannot earn a motion score. Perf is separate: use E18 200-infected measurements, not paused screenshot timings. No independent reviewer has run merely because these files exist.\n`);
  } finally { await page.close(); }
}
