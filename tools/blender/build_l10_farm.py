"""Original dry farm stock. Blender headless, one CPU thread; authored LODs, no decimator.
Run: Blender -b -t 1 --python tools/blender/build_l10_farm.py -- --render
"""
import bpy, math, random, json, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/blender'))
from sslib.palette import mat
IDS=['veg.corn-block','prop.farm-scarecrow','prop.farm-carcass','prop.tree.dead','bld.farm-barn-ruin','bld.farm-house-ruin','prop.farm-tractor','prop.farm-combine','prop.farm-irrigator']
CAPS={'prop.farm-tractor':[800,300,60], 'prop.farm-combine':[800,300,60], 'prop.farm-irrigator':[800,300,60], 'veg.corn-block':[6000,1500,200], 'prop.farm-scarecrow':[800,300,60], 'prop.farm-carcass':[800,300,60], 'prop.tree.dead':[800,300,60], 'bld.farm-barn-ruin':[2400,800,200], 'bld.farm-house-ruin':[2400,800,200]}

def parent(o, root, token):
 o.parent=root;o.data.materials.append(mat(token));return o

def box(root,name,at,size,token,turn=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=at);o=bpy.context.object;o.name=name;o.scale=size;o.rotation_euler.z=turn;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return parent(o,root,token)

def branch(root,name,a,b,r,token,sides=5):
 a,b=Vector(a),Vector(b);v=b-a;bpy.ops.mesh.primitive_cone_add(vertices=sides,radius1=r,radius2=r*.45,depth=v.length,location=(a+b)/2);o=bpy.context.object;o.name=name;o.rotation_euler=v.to_track_quat('Z','Y').to_euler();return parent(o,root,token)

def mesh(root,name,verts,faces,token):
 d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.materials.append(mat(token));o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.parent=root;return o

def shape(root,name,at,scale,token,lod):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2 if lod==0 else 1,radius=1,location=at);o=bpy.context.object;o.name=name;o.scale=scale;return parent(o,root,token)

def build_geometry(id,lod,burned=False):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root)
 rng=random.Random(1029);char='asphalt' if burned else 'woodWarm'
 if id=='veg.corn-block':
  # Ten metre tile, irregular gaps and snapped stalks; two crossed geometric leaf cards per stem.
  rows,cols=[(10,10),(7,6),(4,4)][lod]
  verts=[];faces=[]
  def leaf(points):
   n=len(verts);verts.extend(points);faces.extend([(n,n+1,n+2),(n,n+2,n+3)])
  for row in range(rows):
   for col in range(cols):
    if rng.random()<.12:continue
    x=-4.65+row*9.3/max(1,rows-1)+rng.uniform(-.12,.12);y=-4.65+col*9.3/max(1,cols-1)+rng.uniform(-.22,.22)
    h=rng.uniform(2.2,2.6) if rng.random()>.22 else rng.uniform(.55,1.45);bend=rng.uniform(-.23,.23)
    for ang in (rng.uniform(-.2,.2),math.pi/2+rng.uniform(-.2,.2)):
     dx,dy=math.cos(ang),math.sin(ang);w=.13 if lod<2 else .3
     leaf([(x-dx*.025,y-dy*.025,0),(x+dx*.025,y+dy*.025,0),(x+bend+dx*w,y+dy*w,h*.78),(x+bend,y,h)])
     if lod<2:
      for side,z in [(-1,.55),(1,1.05),(-1,1.5)][:3 if lod==0 else 1]:
       z=min(z,h*.65);leaf([(x,y,z),(x+side*dx*.42,y+side*dy*.42,z+.18),(x+side*dx*.67,y+side*dy*.67,z-.24),(x+side*dx*.2,y+side*dy*.2,z-.05)])
  mesh(root,'body',verts,faces,'canvasTan')
 elif id in ['prop.farm-tractor','prop.farm-combine']:
  combine=id=='prop.farm-combine';length=3.8 if not combine else 5.4
  if lod<2:box(root,'body',(0,0,.85),(length,1.45,.45),'leatherShadow')
  box(root,'engine',(-.45 if combine else .55,0,1.3),(length*.6,1.35,1.2),'khakiSeam')
  box(root,'cab',(.45 if combine else -.65,0,2.05),(1.05,1.45,1.35),'asphalt')
  if lod<2:
   box(root,'dead-window',(.99 if combine else -.11,0,2.15),(.02,1.1,.65),'silver')
   for x in [-length*.32,length*.32]:
    for y in [-.9,.9]:
     o=branch(root,'tire',(x,y-.18,.6),(x,y+.18,.6),.62 if x<0 else .44,'asphalt',8 if lod==0 else 4)
   if lod==0:branch(root,'exhaust',(-.5,.4,1.8),(-.5,.4,2.65),.07,'asphalt',6)
  else:
   for y in [-.9,.9]:box(root,'tire-silhouette',(0,y,.42),(length*.8,.35,.82),'asphalt')
  if combine:
   box(root,'abandoned-header',(length*.57,0,.43),(.8,3.6,.45),'leatherShadow')
   if lod==0:
    for k in range(8):box(root,'header-tooth',(length*.68,-1.6+k*.45,.2),(.65,.07,.08),'asphalt')
 elif id=='prop.farm-irrigator':
  branch(root,'body',(-6,0,2.1),(6,0,2.1),.09,'silver',6 if lod<2 else 3)
  for x in [-5,0,5]:
   branch(root,'rusted-leg',(x,0,2.1),(x,-.65,.08),.07,'leatherShadow',4 if lod<2 else 3)
   branch(root,'rusted-leg',(x,0,2.1),(x,.65,.08),.07,'leatherShadow',4 if lod<2 else 3)
  if lod<2:
   for k in range(-5,6,2):branch(root,'dropped-nozzle',(k,0,2.1),(k,0,1.55),.025,'asphalt',3)
 elif id=='prop.farm-scarecrow':
  box(root,'body',(0,0,1.1),(.11,.12,2.2),char)
  box(root,'crossbar',(0,0,1.6),(1.65,.1,.11),char,.09)
  box(root,'torn-coat',(0,-.04,1.27),(.57,.18,.64),'leatherShadow')
  if lod==2:
   box(root,'sack-head',(0,0,1.99),(.36,.34,.44),'canvasTan')
   mesh(root,'hat-brim',[(-.3,-.235,2.14),(.3,-.235,2.14),(.3,.235,2.14),(-.3,.235,2.14)],[(0,1,2),(0,2,3)],'leatherShadow')
  else:shape(root,'sack-head',(0,0,1.99),(.18,.17,.22),'canvasTan',1)
  if lod<2:
   box(root,'brim',(0,0,2.14),(.6,.47,.045),'leatherShadow');box(root,'hat',(0,0,2.22),(.31,.3,.15),'leatherShadow')
   for s in [-1,1]:branch(root,'torn-sleeve',(s*.24,0,1.57),(s*.7,0,1.45),.14,'leatherShadow',4)
 elif id=='prop.farm-carcass':
  # Fallen cow, legs extended on the ground, never a live actor or a gore heap.
  shape(root,'body',(0,0,.39),(1.02,.47,.36),'khakiSeam',lod)
  shape(root,'head',(1.02,-.05,.25),(.35,.25,.21),'leatherShadow',1)
  for x in [-.65,.6]:
   for y in ([-.28] if lod==2 else [-.28,.28]):branch(root,'leg',(x,y,.25),(x+.2,y*2.8,.12),.11,'leatherShadow',3 if lod==2 else 5)
  if lod==0:
   for x in [-.5,.15]:shape(root,'hide-patch',(x,-.28,.52),(.24,.22,.15),'leatherShadow',1)
 elif id=='prop.tree.dead':
  branch(root,'body',(0,0,0),(.18,0,4.8),.29,char,5 if lod==0 else 4 if lod==1 else 3)
  for k,(x,y,z) in enumerate([(-1.65,.2,4.2),(1.6,-.35,4.6),(.3,1.45,4.8),(-.6,-1.3,3.7)]):
   branch(root,'bare-branch',(.08,0,2.1+k*.32),(x,y,z),.13,char,5 if lod==0 else 3)
   if lod==0:branch(root,'snapped-twig',(x*.55,y*.55,z-.8),(x*.9+.4,y*1.2,z+.15),.055,char,4)
 else:
  house=id=='bld.farm-house-ruin';w,d,h=(8,7,3.4) if house else (10,8,5)
  # An open, burned shell with missing walls and roof: navigation is authored by placement, no invisible floor slab.
  for x in [-w/2,w/2]:
   for y in [-d/2,d/2]:box(root,'body' if x<0 and y<0 else 'charred-upright',(x,y,h*.42),(.22,.22,h*.84),'asphalt')
  count=10 if lod==0 else 5 if lod==1 else 2
  for k in range(count):
   x=-w/2+(k+.5)*w/count
   if 2<k<count*.65:continue
   box(root,'broken-rear-plank',(x,d/2,h*.25),(w/count*.83,.16,h*rng.uniform(.35,.65)),char)
  for side in [-1,1]:
   box(root,'sill',(side*w/2,0,.2),(.23,d,.3),'asphalt')
   if lod<2:
    for k in range(3 if lod==0 else 1):box(root,'scorched-siding',(side*w/2,-d*.25+k*d*.22,h*.3),(.15,d*.18,h*rng.uniform(.3,.7)),char)
  for y in [-d/2,d/2]:
   branch(root,'broken-rafter',(-w/2,y,h*.75),(0,y,h),.11,'asphalt',4)
   if y>0:branch(root,'broken-rafter',(0,y,h),(w/2,y,h*.75),.11,'asphalt',4)
  if house:box(root,'chimney',(w*.27,d*.25,h*.55),(.75,.7,h*1.1),'brick')
  if lod<2:
   for k in range(8 if lod==0 else 3):box(root,'fallen-beam',(rng.uniform(-w*.42,w*.42),rng.uniform(-d*.4,d*.4),.18),(.15,rng.uniform(1.2,3.6),.14),'asphalt',rng.uniform(-2,2))
 bpy.context.view_layer.update()
 # Merge material groups into a stable body owner. Preserve palette names for runtime batching.
 meshes=[o for o in root.children if o.type=='MESH'];bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:o.select_set(True)
 bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();body=bpy.context.object;body.name='body'
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 # Sparse planar cards need double sided rasterization at every distance.
 for m in body.data.materials:m.use_backface_culling=False
 front=bpy.data.objects.new('front',None);bpy.context.collection.objects.link(front);front.parent=root;front.location=(1,0,0)
 return root

manifest=json.loads((ROOT/'src/assets/manifest.json').read_text());stats=[]
requested=Path(sys.argv[sys.argv.index('--glb')+1]) if '--glb' in sys.argv else None
selected=[requested.stem] if requested else IDS
for id in selected:
 for burned in ([False,True] if id=='prop.tree.dead' else [False]):
  for lod in range(3):
   root=build_geometry(id,lod,burned);folder=ROOT/'assets'/id;folder.mkdir(exist_ok=True)
   suffix=('.burned' if burned else '')+('' if lod==0 else f'.lod{lod}')
   bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(folder/f'model{suffix}.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
   body=root.children[0] if root.children[0].type=='MESH' else next(o for o in root.children if o.type=='MESH');body.data.calc_loop_triangles();tris=len(body.data.loop_triangles)
   if tris>CAPS[id][lod]:raise RuntimeError(f'{id} lod{lod}: {tris} > {CAPS[id][lod]}')
   if lod==0 and not burned:
    pts=[body.matrix_world@Vector(v) for v in body.bound_box];lo=[min(p[i] for p in pts) for i in range(3)];hi=[max(p[i] for p in pts) for i in range(3)];dims=dict(x=round(hi[0]-lo[0],4),y=round(hi[2]-lo[2],4),z=round(hi[1]-lo[1],4),tolerance=.35)
    definition=dict(id=id,category='building' if id.startswith('bld.') else 'prop',status='integrated',tier='side',script='tools/blender/build_l10_farm.py',sourceGlb=f'assets/{id}/model.glb',glb=f'public/assets/models/{id}.glb',lods={f'lod{i}':f'public/assets/models/{id}.lod{i}.glb' for i in [1,2]},dimensions=dims,forward='+X',sourceForward='+X',frontNodes=['front'],requiredNodes=['root','body'],animatedNodes=[],sockets=[],budget=dict(triangles=CAPS[id][0],materials=4,fileKB=300,drawCalls=4),authoredLodTriangles=dict(lod1=CAPS[id][1],lod2=CAPS[id][2]),decayVariants=['burned'] if id=='prop.tree.dead' else [],world=dict(token='canvasTan' if id=='veg.corn-block' else 'woodWarm',solid=False))
    manifest=[m for m in manifest if m['id']!=id]+[definition]
   stats.append(dict(id=id,burned=burned,lod=lod,triangles=tris,cap=CAPS[id][lod]))
(ROOT/'src/assets/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(ROOT/'docs/reports/eg-l10-farm/asset-budgets.json').write_text(json.dumps(stats,indent=2)+'\n')
if '--render' in sys.argv:
 # CPU sheet of all delivered LODs; asset-only evidence, no browser or GPU process.
 bpy.ops.wm.read_factory_settings(use_empty=True)
 for row,id in enumerate(IDS):
  for lod in range(3):
   path=ROOT/'assets'/id/('model'+('' if lod==0 else f'.lod{lod}')+'.glb')
   before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(path));objects=set(bpy.data.objects)-before
   roots=[o for o in objects if o.parent not in objects]
   factor=.55 if id.startswith('bld.') or id=='veg.corn-block' else 1
   for o in roots:o.location=(lod*9,(len(IDS)-1-row)*7,0);o.scale=(factor,)*3
 bpy.ops.object.camera_add(location=(34,-23,58));cam=bpy.context.object;target=Vector((9,27,0));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=88;bpy.context.scene.camera=cam
 bpy.ops.object.light_add(type='AREA',location=(5,10,35));bpy.context.object.data.energy=4500;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=30
 scene=bpy.context.scene;scene.world=bpy.data.worlds.new('farm-sheet');scene.world.color=(.16,.16,.16);scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12;scene.render.threads_mode='FIXED';scene.render.threads=1;scene.render.resolution_x=1400;scene.render.resolution_y=1800;scene.render.resolution_percentage=100;scene.render.filepath=str(ROOT/'docs/reports/eg-l10-farm/asset-sheet.png');bpy.ops.render.render(write_still=True)
print('L10 farm source assets built:',len(stats),'tiers')

if requested:
 import shutil
 shutil.copyfile(ROOT/'assets'/requested.stem/('model.burned.glb' if '--decay' in sys.argv else 'model.glb'),requested)
