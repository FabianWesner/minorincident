"""Original dry farm stock. Blender headless, one CPU thread; authored LODs, no decimator.
Run: Blender -b -t 1 --python tools/blender/build_l10_farm.py -- --render
"""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/blender'))
from sslib.palette import mat
from sslib import farm_assets
IDS=['veg.corn-block','prop.farm-scarecrow','prop.farm-carcass','prop.tree.dead','bld.farm-barn-ruin','bld.farm-house-ruin','prop.farm-tractor','prop.farm-combine','prop.farm-irrigator']
CAPS={'prop.farm-tractor':[2500,1000,300], 'prop.farm-combine':[2500,1000,300], 'prop.farm-irrigator':[800,300,60], 'veg.corn-block':[6000,1500,200], 'prop.farm-scarecrow':[800,300,60], 'prop.farm-carcass':[800,300,60], 'prop.tree.dead':[800,300,60], 'bld.farm-barn-ruin':[6000,2500,800], 'bld.farm-house-ruin':[6000,2500,800]}

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
 char='asphalt' if burned else 'woodWarm'
 if id=='veg.corn-block':
  farm_assets.corn(root,lod)
 elif id in ['prop.farm-tractor','prop.farm-combine']:
  farm_assets.vehicle(root,lod,id=='prop.farm-combine',burned)
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
  farm_assets.building(root,lod,id=='bld.farm-house-ruin',burned)
 bpy.context.view_layer.update()
 # Merge material groups into a stable body owner. Preserve palette names for runtime batching.
 meshes=[o for o in root.children if o.type=='MESH'];bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:o.select_set(True)
 bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();body=bpy.context.object;body.name='body'
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 if id in ['prop.farm-tractor','prop.farm-combine','bld.farm-barn-ruin','bld.farm-house-ruin']:
  if '--unfolded-check' in sys.argv:
   directory=ROOT/'.cache/r15-farmassets/unfolded';directory.mkdir(parents=True,exist_ok=True)
   path=directory/(id+('.burned' if burned else '')+f'.lod{lod}.glb')
   bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True)
  farm_assets.fold_palette(body)
 # Sparse planar cards need double sided rasterization at every distance.
 for m in body.data.materials:m.use_backface_culling=False
 front=bpy.data.objects.new('front',None);bpy.context.collection.objects.link(front);front.parent=root;front.location=(1,0,0)
 return root

manifest=json.loads((ROOT/'src/assets/manifest.json').read_text());stats=[]
requested=Path(sys.argv[sys.argv.index('--glb')+1]) if '--glb' in sys.argv else None
selected=[requested.stem] if requested else IDS
for id in selected:
 for burned in ([False,True] if id in ['prop.tree.dead','prop.farm-tractor','prop.farm-combine','bld.farm-barn-ruin','bld.farm-house-ruin'] else [False]):
  for lod in range(3):
   root=build_geometry(id,lod,burned);folder=ROOT/'assets'/id;folder.mkdir(exist_ok=True)
   suffix=('.burned' if burned else '')+('' if lod==0 else f'.lod{lod}')
   body=root.children[0] if root.children[0].type=='MESH' else next(o for o in root.children if o.type=='MESH');body.data.calc_loop_triangles();tris=len(body.data.loop_triangles)
   if tris>CAPS[id][lod]:raise RuntimeError(f'{id} lod{lod}: {tris} > {CAPS[id][lod]}')
   materials=len(set(m.name for m in body.data.materials))
   if materials>4:raise RuntimeError(f'{id} lod{lod}: {materials} material slots > 4')
   bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(folder/f'model{suffix}.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False,export_vertex_color='ACTIVE')
   if lod==0 and not burned:
    decay=['burned'] if id in ['prop.tree.dead','prop.farm-tractor','prop.farm-combine','bld.farm-barn-ruin','bld.farm-house-ruin'] else []
    definition=next(m for m in manifest if m['id']==id)
    # Keep the accepted X/Z plot dimensions: farm placement is computed from them.
    definition['budget']['triangles']=CAPS[id][0]
    definition['authoredLodTriangles']=dict(lod1=CAPS[id][1],lod2=CAPS[id][2])
    definition['decayVariants']=decay
   stats.append(dict(id=id,burned=burned,lod=lod,triangles=tris,cap=CAPS[id][lod],materials=materials))
(ROOT/'src/assets/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(ROOT/'docs/reports/r15-farmassets').mkdir(parents=True,exist_ok=True)
(ROOT/'docs/reports/r15-farmassets/asset-budgets.json').write_text(json.dumps(stats,indent=2)+'\n')
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
