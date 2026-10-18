import { SceneSession,readSpec,stopServer } from '../../../../tools/scenelab/session';
import type { Game } from '../../../../src/Game';
const s=new SceneSession({backend:'webgl2',tier:'high'});
try {await s.open();await s.page.evaluate('window.__name=(fn)=>fn');await s.load(readSpec('tests/scenes/catalog/qa-l6-room-edge.json'));await s.step(420);console.log(JSON.stringify(await s.page.evaluate(()=>{const w=(window.__SCENE__ as unknown as {game:Game}).game.world,p=w.entities.get(1)!.transform,nav=w.infected!.nav;return {p,floor:w.districts!.groundHeight(p.x,p.z),walls:nav.walls.filter(b=>Math.abs(b.x-p.x)<6&&Math.abs(b.z-p.z)<6),clear:nav.clear(p.x,p.z,.45),mask:nav.mask?.(p.x,p.z),state:window.__SCENE__!.describe()};}),null,2));}finally{await s.close();stopServer();}
