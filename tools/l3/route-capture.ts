import { readFileSync } from 'node:fs';
import { SceneSession, stopServer } from '../scenelab/session';
import { l3Roadblocks } from '../../src/levels/L3/layout';
const session = new SceneSession({viewport:{width:1680,height:940}});
const out = 'docs/reports/l3-route';
try {
  await session.open();
  for (const label of ['before','after']) {
    await session.page.setContent(readFileSync(`${out}/${label}.svg`,'utf8'));
    await session.page.locator('svg').screenshot({path:`${out}/${label}.png`});
  }
  await session.inspectLevel('L3');
  await session.page.evaluate(() => window.__SS__!.inspect.timeScale(0));
  await session.page.addStyleTag({content:'[data-testid=inspection],.tp-dfwv,.mission-subtitle,.story-bubble,#hud,.hud,.hud-tracker,.hud-map,[data-testid=mission-panel]{visibility:hidden!important}'});
  for (const [i, b] of l3Roadblocks.entries()) {
    await session.page.evaluate(({x,z}) => window.__SS__!.inspect.setCamera({position:[x+18,23,z+18],target:[x,0,z]}), b);
    await session.screenshot(`${out}/roadblock-${i+1}.png`);
  }
  for (const [name,x,y,z] of [['highway-entry',151,2,0],['highway-gantry',192.5,6,-7.6],['highway-exit',198,2,0],['checkpoint',222,0,0]] as const) {
    await session.page.evaluate(({x,y,z}) => window.__SS__!.inspect.setCamera({position:[x+19,y+24,z+19],target:[x,y,z]}),{x,y,z});
    await session.screenshot(`${out}/${name}.png`);
  }
  if(session.errors.length) throw new Error(session.errors.join('\n'));
} finally { await session.close();stopServer(); }
