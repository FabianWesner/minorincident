"""Evaluate main's unchanged shoulder painter without importing Blender."""
import ast, json
from pathlib import Path
import numpy as np
source=Path('assets/acc.courier-gear/build.py')
names={'srgb','mix','band','hash3','vnoise','paint'}
module=ast.Module(body=[n for n in ast.parse(source.read_text()).body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[])
scope={'np':np};exec(compile(module,str(source),'exec'),scope)
rng=np.random.default_rng(269274)
colors=scope['paint']('shoulder',{},rng.uniform(-1,1,(10000,3)),rng.uniform(-1,1,(10000,3)),rng.uniform(0,.0032,10000),True)
assert np.max(np.abs(colors-scope['srgb']('#e8892c')))<1e-12
result={'mainPainter':'aafbd7c24','samples':10000,'rimWidthFlatM':.0032,'rgb':'#e8892c','maximumGrainAndTopLightVariation':float(np.max(np.ptp(colors,axis=0))),'pass':True}
Path('docs/reports/slim/merge/painter-check.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS:',result)
