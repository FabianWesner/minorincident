import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { expect, test, vi } from 'vitest';
import { buildLayout, districts, layoutSourceHash } from '../../../tools/layouts/build';

vi.mock('node:child_process',()=>({spawnSync:vi.fn()}));

test('T-E10-12 @E10 @E10-AC12 layout exports cache by authoring input; gameplay edits do not invalidate; exporter failures are fatal', () => {
  // Unit tests exercise the build/cache contract from committed exports, without Blender.
  const cache=new Map(districts.map(id=>{const path=`.cache/layouts/${id}.json`;return [path,existsSync(path)?readFileSync(path):null] as const;}));
  vi.mocked(spawnSync).mockReturnValue({status:0} as ReturnType<typeof spawnSync>);
  const gameplay='src/levels/districts/D-RES.ts',source=readFileSync(gameplay,'utf8');
  const layout='layouts/D-RES/layout.py',script=readFileSync(layout,'utf8');
  try {
    for(const id of districts) {
      const path=`public/assets/layouts/${id}.layout.json`,original=readFileSync(path,'utf8');
      expect(buildLayout(id,true).rebuilt).toBe(true);
      const calls=vi.mocked(spawnSync).mock.calls.length;
      expect(buildLayout(id).rebuilt).toBe(false);
      expect(vi.mocked(spawnSync).mock.calls).toHaveLength(calls);
      expect(readFileSync(path,'utf8')).toBe(original);
    }
    const key=layoutSourceHash('D-RES');
    writeFileSync(gameplay,source+'\n// gameplay tuning: no static layout change\n');
    expect(layoutSourceHash('D-RES')).toBe(key);
    expect(buildLayout('D-RES').rebuilt).toBe(false);
    writeFileSync(layout,script+'\n# authoring change\n');
    expect(layoutSourceHash('D-RES')).not.toBe(key);
    vi.mocked(spawnSync).mockReturnValue({status:1,stdout:'intentional exporter failure',stderr:''} as ReturnType<typeof spawnSync>);
    expect(()=>buildLayout('D-RES',true)).toThrow('intentional exporter failure');
  } finally {
    writeFileSync(gameplay,source);writeFileSync(layout,script);
    for(const [path,bytes] of cache) {if(bytes)writeFileSync(path,bytes);else if(existsSync(path))unlinkSync(path);}
    vi.mocked(spawnSync).mockReset();
  }
});
