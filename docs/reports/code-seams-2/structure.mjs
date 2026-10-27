import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const base = process.argv[2] ?? 'b55bfc632';
const parse = (path, before) => ts.createSourceFile(path, before ? execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8' }) : readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
const tokens = source => { const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, source), result = []; while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) result.push(scanner.getTokenText()); return JSON.stringify(result); };
const hash = text => createHash('sha256').update(text).digest('hex');
const getClass = (tree, name) => tree.statements.find(n => ts.isClassDeclaration(n) && n.name.text === name);
const old = parse('src/render/vfx/Vfx.ts', true), current = parse('src/render/vfx/Vfx.ts', false);
const before = getClass(old, 'Vfx'), after = getClass(current, 'Vfx');
const receive = before.members.find(n => n.name?.getText(old) === 'receive').initializer.body;
const bodies=[];
for(const first of receive.statements.filter(n => ts.isIfStatement(n) && ["event.type === 'vehicle.durability-hit'", "event.type === 'combat.hit' && event.amount > 0"].includes(n.expression.getText(old)))) {
 for(let branch=first; branch; branch=branch.elseStatement) {
  const condition=branch.expression.getText(old), keys=[...condition.matchAll(/event\.type === '([^']+)'/g)].map(m=>m[1]);
  const name='on'+keys[0].split(/[.-]/).map(s=>s[0].toUpperCase()+s.slice(1)).join('');
  const handler=after.members.find(n=>n.name?.getText(current)===name);
  if(!handler)throw new Error(`Missing ${name}`);
  const body=ts.isBlock(branch.thenStatement)?branch.thenStatement.statements.map(n=>n.getText(old)).join('\n'):branch.thenStatement.getText(old);
  const actual=handler.initializer.body.statements.slice(1).map(n=>n.getText(current)).join('\n');
  if(tokens(body)!==tokens(actual))throw new Error(`Changed body: ${name}`);
  const guard=handler.initializer.body.statements[0];
  if(tokens(guard.expression.getText(current))!==tokens(`!(${condition})`))throw new Error(`Changed guard: ${name}`);
  const table=after.members.find(n=>n.name?.getText(current)==='eventHandlers').initializer;
  for(const key of keys)if(!table.properties.some(p=>p.name.text===key&&p.initializer.getText(current)===`this.${name}`))throw new Error(`Missing dispatch: ${key}`);
  bodies.push({keys,body:hash(tokens(body))});
 }
}
const oldCrowd=parse('src/render/characters/CrowdLocomotion.ts',true),newCrowd=parse('src/render/characters/CrowdLocomotion.ts',false);
const oldSolve=getClass(oldCrowd,'CrowdLocomotion').members.find(n=>n.name?.getText(oldCrowd)==='solve');
const newSolve=getClass(newCrowd,'CrowdLocomotion').members.find(n=>n.name?.getText(newCrowd)==='solve');
const prior=oldSolve.body.statements.map(n=>n.getText(oldCrowd)).join('\n'), next=newSolve.body.statements.slice(1).map(n=>n.getText(newCrowd)).join('\n');
if(tokens(prior)!==tokens(next))throw new Error('Crowd solver changed');
const oldScene=parse('src/debug/scenelab/SceneLab.ts',true), fixtures=parse('src/debug/scenelab/missionFixtures.ts',false);
const setup=getClass(oldScene,'SceneLab').members.find(n=>n.name?.getText(oldScene)==='setup');
const normalize=source=>source.replaceAll('this.game.quality.tier','host.tier').replaceAll('this.teleport','host.teleport').replaceAll('this.actors','host.actors').replaceAll('this.vehicles','host.vehicles').replaceAll('world.infected!.','world.requireInfected().').replaceAll('toPoint(at)','{ x: at[0], z: at[1] }');
const fixtureBodies=[];
for(const key of ['l2Release','l6Subway','l3Rendezvous','l4Convoy','l7Group']) {
 const prior=setup.body.statements.find(n=>ts.isIfStatement(n)&&n.expression.getText(oldScene)===`spec.${key}`);
 const name='setup'+key[0].toUpperCase()+key.slice(1), current=fixtures.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text===name);
 const next=current.body.statements.find(n=>ts.isIfStatement(n));
 if(tokens(normalize(prior.getText(oldScene)))!==tokens(normalize(next.getText(fixtures))))throw new Error(`Fixture changed: ${name}`);
 fixtureBodies.push({name,body:hash(tokens(normalize(prior.getText(oldScene))))});
}
const result={base,fixtureBodies,vfx:{discriminators:bodies.flatMap(b=>b.keys).length,handlers:bodies.length,bodies},crowdSolve:hash(tokens(prior))};
mkdirSync('test-results/code-seams-2',{recursive:true});writeFileSync('test-results/code-seams-2/structure.json',JSON.stringify(result,null,2));console.log(JSON.stringify({discriminators:result.vfx.discriminators,handlers:bodies.length,allBodiesIdentical:true,crowdSolve:result.crowdSolve}));
