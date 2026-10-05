import { existsSync, readFileSync } from 'node:fs';
import type { AssetDef } from '../../src/assets/types';

/** Final status requires an evidenced checklist, not just a verdict string. */
export function reviewErrors(text: string, imageExists: (path:string)=>boolean = existsSync): string[] {
  const errors: string[]=[];
  if(!/^Verdict:\s*PASS\s*$/im.test(text))errors.push('review verdict must be PASS');
  const comparison=text.match(/^Comparison:\s*`?([^`\n]+\.png)`?\.?\s*$/im)?.[1];
  if(!comparison || !imageExists(comparison))errors.push('review comparison image missing');
  const must=text.split('\n').filter(line=>line.includes('[must]'));
  const should=text.split('\n').filter(line=>line.includes('[should]'));
  if(must.length<4 || must.some(line=>!/:\s*PASS\s*[—-]\s*\S+/.test(line)))errors.push('review must checklist incomplete/failed');
  if(should.length<2 || should.filter(line=>/:\s*PASS\s*[—-]\s*\S+/.test(line)).length/should.length<.7)errors.push('review should checklist below 70%');
  return errors;
}
export function needsHuman(assets: AssetDef[]): string[] {
  return assets.flatMap(asset=>{
    const path=`assets/${asset.id}/review.md`;
    return existsSync(path) && /(?:^|\n)(?:\*\*)?Verdict:\s*needs-human\b/i.test(readFileSync(path,'utf8'))?[asset.id]:[];
  });
}
