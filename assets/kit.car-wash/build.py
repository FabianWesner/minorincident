"""Reproducible Sunny Suds wash. +X entry/front; Z up; rigid brush pivots."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]/'tools/blender'))
from sslib import palette, export, ao, colliders
ASSET={'id':'kit.car-wash','category':'building'}
p=argparse.ArgumentParser(); p.add_argument('--glb'); p.add_argument('--render'); p.add_argument('--view',default='game'); p.add_argument('--samples',type=int,default=24); p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540); p.add_argument('--pose-test',action='store_true'); p.add_argument('--inspect',action='store_true')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
TOKENS=['policeBlue','picketWhite','schoolBusYellow','backpackTeal','flamingoPink','uiDark','silver','sidewalk','orange','survivorRed','lavenderLight','tealLight']
M={t:palette.mat(t) for t in TOKENS}
for t,m in M.items():
 m.use_backface_culling=True; bs=m.node_tree.nodes['Principled BSDF']; bs.inputs['Roughness'].default_value=.58
 if t=='silver': bs.inputs['Metallic'].default_value=.25
PROTECTED=['brush_a','brush_b','brush_c','kiosk','start_button','curtain','roof','interior']
def empty(n,loc=(0,0,0),parent=None):
 o=bpy.data.objects.new(n,None); bpy.context.collection.objects.link(o); o.location=loc; o.parent=parent; return o
def finish(o,n,t,parent,bevel=0):
 o.name=n; o.parent=parent; o.data.materials.append(M[t]); bpy.context.view_layer.objects.active=o
 if bevel>=.03:
  mod=o.modifiers.new('soft edges','BEVEL'); mod.width=bevel; mod.segments=1; bpy.ops.object.modifier_apply(modifier=mod.name)
  mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def box(n,loc,size,t,parent=None,b=.02):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return finish(o,n,t,parent or root,b if Q==0 else 0)
def cyl(n,loc,r,d,t,parent=None,axis='Z',seg=None):
 bpy.ops.mesh.primitive_cylinder_add(vertices=seg or (16 if Q==0 else 6 if Q==1 else 4),radius=r,depth=d,location=loc)
 o=finish(bpy.context.object,n,t,parent or root)
 if axis=='X': o.rotation_euler[1]=math.pi/2
 if axis=='Y': o.rotation_euler[0]=math.pi/2
 return o
def mesh(n,v,f,t,parent=None):
 d=bpy.data.meshes.new(n); d.from_pydata(v,[],f); d.update(); o=bpy.data.objects.new(n,d); bpy.context.collection.objects.link(o); return finish(o,n,t,parent or root)
def ball(n,loc,size,t,parent=None):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=loc); o=bpy.context.object; o.scale=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); return finish(o,n,t,parent or root)
def text(n,words,loc,size,t,parent=None):
 bpy.ops.object.text_add(location=loc); o=bpy.context.object; o.data.body=words; o.data.align_x='CENTER'; o.data.align_y='CENTER'; o.data.size=size; o.data.extrude=0; o.data.resolution_u=1; o.rotation_euler=(math.pi/2,0,math.pi/2); bpy.ops.object.convert(target='MESH'); return finish(bpy.context.object,n,t,parent or root)
def arch(n,x0,x1,r,z,t,steps):
 v=[]
 for x in [x0,x1]:
  for rad in [r,r-.06]:
   for i in range(steps+1):
    th=math.pi*i/steps; v.append((x,rad*math.cos(th),z+.63*rad*math.sin(th)))
 s=steps+1; f=[]
 for i in range(steps):
  f.extend([(i,i+1,2*s+i+1,2*s+i),(s+i,3*s+i,3*s+i+1,s+i+1),(i,s+i,s+i+1,i+1),(2*s+i,2*s+i+1,3*s+i+1,3*s+i)])
 f.extend([(0,2*s,3*s,s),(s-1,2*s-1,4*s-1,3*s-1)])
 return mesh(n,v,f,t,bpy.data.objects['roof'])
def build(q):
 global Q,root
 Q=q; bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
 root=empty('root'); root['asset_id']=ASSET['id']; root['category']='building'; root['forward']='+X'
 roof=empty('roof',parent=root); interior=empty('interior',parent=root)
 empty('front',(2.55,0,1.5),root); empty('vfx_foam',(-.4,3.0,1.5),root)
 box('tiled foundation',(0,.35,.12),(5,5.9,.24),'sidewalk',b=.06)
 box('wet wash floor',(0,0,.253),(4.8,3.5,.022),'silver',b=.005)
 if q<2:
  for x in [-2,-1,0,1,2]: box('tile seam',(x,.35,.270),(.018,5.8,.012),'uiDark',b=0)
  for y in [-2,-1,0,1,2,3]: box('tile seam',(0,y,.270),(4.9,.018,.012),'uiDark',b=0)
  for y in [-.68,.68]:
   box('track shadow',(0,y,.272),(4.7,.19,.03),'uiDark',b=0)
   for dy in [-.085,.085]: box('wheel guide',(0,y+dy,.305),(4.65,.032,.055),'silver',b=.008)
  box('drain',(0,0,.278),(4.3,.27,.025),'uiDark',b=0)
  for x in [i*.18-2.05 for i in range(24 if q==0 else 8)]: box('drain grate',(x,0,.296),(.032,.26,.016),'silver',b=0)
 for x in [-1.85,1.7]:
  for y in [-1.67,1.67]:
   box('pillar',(x,y,1.73),(.48,.48,2.96),'picketWhite',b=.035)
   box('teal pillar band',(x,y,1.67),(.495,.495,.29),'backpackTeal',b=.006)
   if q==0:
    for z in [.55,.94,1.33,2.01,2.4,2.79,3.18]:
     for side in [-1,1]:
      box('mortar seam',(x+side*.244,y,z),(.012,.46,.018),'sidewalk',b=0)
      box('mortar seam',(x,y+side*.244,z),(.46,.012,.018),'sidewalk',b=0)
    box('base collar',(x,y,.38),(.55,.55,.22),'sidewalk')
 for y in [-1.67,1.67]:
  box('wash side wall',(-.075,y,1.72),(3.1,.18,2.88),'picketWhite',interior,b=.025)
  box('wall teal band',(-.075,y,1.67),(3.1,.195,.29),'backpackTeal',interior,b=.004)
  if q==0:
   for z in [.55,.94,1.33,2.01,2.4,2.79]:
    for sy in [-1,1]: box('wall tile joint',(-.075,y+sy*.096,z),(3.1,.012,.015),'sidewalk',interior,b=0)
   for x in [-1.05,-.05,.95]:
    for sy in [-1,1]: box('vertical tile joint',(x,y+sy*.096,1.72),(.012,.012,2.8),'sidewalk',interior,b=0)
 for y in [-1.7,1.7]:
  box('side header',(0,y,3.20),(4.55,.36,.27),'schoolBusYellow',roof)
  box('blue eave',(0,y,3.44),(4.7,.40,.25),'policeBlue',roof)
 for x in [-2.2,2.2]: box('front fascia',(x,0,3.43),(.28,3.8,.32),'policeBlue',roof,b=.04)
 arch('blue barrel canopy',-2.21,2.21,1.77,3.44,'policeBlue',24 if q==0 else 12 if q==1 else 6)
 if q<2:
  for i in range(11 if q==0 else 3):
   x=-2.2+i*4.4/(10 if q==0 else 2); arch('raised canopy rib',x-.022,x+.022,1.8,3.45,'picketWhite',16 if q==0 else 8)
 steps=24 if q==0 else 12 if q==1 else 6
 v=[]
 for xx in [2.19,2.29]:
  v.append((xx,0,3.44))
  for i in range(steps+1):
   th=math.pi*i/steps; v.append((xx,1.77*math.cos(th),3.44+1.115*math.sin(th)))
 s0=steps+2; f=[]
 for i in range(steps): f.extend([(0,i+2,i+1),(s0,s0+i+1,s0+i+2),(i+1,i+2,s0+i+2,s0+i+1)])
 f.append((1,s0-1,2*s0-1,s0+1))
 mesh('blue entrance arch face',v,f,'policeBlue',roof)
 # Friendly sun and sign on entrance fascia; lettering stands clear of backing.
 if q<2:
  box('sign dark rim',(2.37,0,3.68),(.13,1.45,.82),'backpackTeal',roof,b=.13)
  box('sign white face',(2.445,0,3.68),(.035,1.32,.71),'picketWhite',roof,b=.10)
  if q==0:
   text('Sunny lettering','SUNNY',(2.47,0,3.85),.29,'policeBlue',roof); text('Suds lettering','SUDS',(2.47,0,3.54),.31,'policeBlue',roof)
  cyl('sun disc',(2.39,-.97,3.93),.30,.09,'schoolBusYellow',roof,'X')
  if q==0:
   for i in range(10):
    th=i*math.tau/10; o=box('sun ray',(2.39,-.97+.36*math.cos(th),3.93+.36*math.sin(th)),(.07,.12,.22),'orange',roof,b=.025); o.rotation_euler[0]=th-math.pi/2
   for y in [-.88,-1.08]: ball('sun eye',(2.448,y,3.98),(.012,.028,.040),'uiDark',roof)
   text('sun smile','U',(2.454,-.98,3.85),.16,'uiDark',roof)
   for y,z,r in [(-1.3,3.65,.13),(1.35,3.65,.12),(1.50,3.91,.08),(.55,4.03,.08)]: ball('sign bubble',(2.40,y,z),(.06,r,r),'picketWhite',roof)
 # Three separately rotating vertical brush assemblies, Z-axis shaft pivots.
 for n,x,y in [('brush_a',1.1,.95),('brush_b',1.1,-.95),('brush_c',-1.25,0)]:
  owner=empty(n,(x,y,2.98),root); owner['animation_axis']='Z'; owner['angular_speed']=1.8
  if q<2: cyl('brush shaft',(0,0,-1.0),.065,2.35,'silver',owner)
  count=20 if q==0 else 8 if q==1 else 4; rows=15 if q==0 else 5 if q==1 else 4
  bands=['policeBlue','backpackTeal','schoolBusYellow','schoolBusYellow','flamingoPink']
  for k in range(rows):
   z=-2.2+k*2.10/rows; h=2.10/rows; v=[]
   for ring,zz in enumerate([z,z+h]):
    for j in range(count):
     th=j*math.tau/count+k*.22; r=(.38+(.065 if j%2==0 else 0)) if ring==0 else .32; v.append((r*math.cos(th),r*math.sin(th),zz+(0.045*math.sin(j*3) if q==0 and ring==0 else 0)))
   f=[(j,(j+1)%count,(j+1)%count+count,j+count) for j in range(count)]
   if k==0: f.append(tuple(reversed(range(count))))
   if k==rows-1: f.append(tuple(range(count,2*count)))
   mesh('layered cloth brush',v,f,bands[4 if q==2 and k==rows-1 else min(4,k*5//rows)],owner)
  if q<2: cyl('upper brush bearing',(x,y,3.04),.13,.13,'uiDark')
  if q==0:
   box('bearing mount',(x,y,3.15),(.46,.47,.11),'silver')
 # Payment kiosk and separate button pivot.
 kiosk=empty('kiosk',(1.82,-2.09,.25),root)
 box('blue payment cabinet',(0,0,.64),(.57,.58,1.28),'policeBlue',kiosk,b=.06)
 box('screen bezel',(.299,0,1.00),(.025,.41,.31),'uiDark',kiosk,b=.02)
 box('payment screen',(.318,0,1.00),(.012,.34,.24),'tealLight',kiosk,b=.008)
 button=empty('start_button',(.32,0,.60),kiosk); button['interaction']='start_car_wash'
 cyl('button rim',(0,0,0),.115,.04,'silver',button,'X'); cyl('red start button',(.035,0,0),.09,.045,'survivorRed',button,'X')
 if q==0:
  text('start label','START',(.316,0,.29),.12,'picketWhite',kiosk)
  text('pay label','PAY',(.334,0,1.00),.10,'picketWhite',kiosk)
  box('coin slot',(.31,0,.80),(.012,.13,.025),'uiDark',kiosk,b=0)
  # Right pillar service notice.
  box('service sign',(1.964,1.68,1.80),(.055,.40,.74),'policeBlue',b=.015)
  box('service sign face',(1.999,1.68,1.80),(.016,.35,.67),'picketWhite',b=.01)
  for z,word in [(2.02,'CLEAN'),(1.86,'CARS'),(1.70,'BRIGHT'),(1.54,'DAYS')]: text('service lettering',word,(2.014,1.68,z),.075,'policeBlue')
 for x,y in [(2.1,-1.44),(2.1,2.15),(.85,2.18),(-1.8,2.18)]:
  if q<2: cyl('bollard base',(x,y,.29),.16,.07,'silver')
  cyl('yellow bollard',(x,y,.68),.105,.76,'schoolBusYellow')
  if q<2:
   ball('bollard dome',(x,y,1.07),(.105,.105,.10),'schoolBusYellow'); cyl('bollard reflective band',(x,y,.91),.109,.10,'picketWhite')
 # Separate foam curtain is a rigid interactive assembly at side of bay.
 curtain=empty('curtain',(-.25,3.06,3.05),root); curtain['animation_axis']='X'; curtain['interaction']='foam_curtain'
 for x in [-1.75,1.75]: cyl('curtain support',(x,0,-1.40),.048,2.8,'silver',curtain)
 cyl('curtain overhead rail',(0,0,0),.065,3.7,'silver',curtain,'X')
 strips=12 if q==0 else 6 if q==1 else 4
 for j in range(strips):
  x=-1.65+j*3.3/(strips-1); w=3.3/strips*.9; height=2.58+.12*math.sin(j*2)
  if q==0:
   cyl('curtain ring',(x,0,-.06),.025,.16,'silver',curtain)
  # Closed scalloped ribbons: front/back surfaces retain culling-safe coverage.
  v=[]; segments=4 if q==0 else 2 if q==1 else 1
  for yy in [-.025,.025]:
   for k in range(segments+1):
    zz=-.10-height*k/segments; dx=.035*math.sin(k*1.7+j)
    v.extend([(x-w/2+dx,yy,zz),(x+w/2+dx,yy,zz)])
  s=2*(segments+1); f=[]
  for k in range(segments):
   i=k*2; f.extend([(i,i+2,i+3,i+1),(s+i+1,s+i+3,s+i+2,s+i),(i,s+i,s+i+2,i+2),(i+1,i+3,s+i+3,s+i+1)])
  f.extend([(0,1,s+1,s),(s-2,2*s-2,2*s-1,s-1)])
  mesh('foam curtain ribbon',v,f,'lavenderLight' if j%3 else 'policeBlue',curtain)
  if q==0:
   for k in range(3): ball('hanging suds',(x+.06*math.sin(k+j),-.06,-.55-k*.82-.12*math.sin(j)),(.095,.055,.27),'picketWhite',curtain)
 if q<2:
  for x,y in [(1.4,-1.05),(-.3,1.05),(-1.6,-.6),(.8,2.55),(-1.4,3.1),(.9,3.1)]:
   for k in range(3 if q==0 else 1): ball('foam puddle',(x+k*.12,y+.04*math.sin(k),.31),(.20,.13,.055),'picketWhite')
  if q==0:
   for x,y in [(1.0,.3),(-.6,-1.0),(.2,-2.1)]: ball('wet highlight',(x,y,.273),(.35,.14,.007),'tealLight')
 # Walk-through bay: wall/pillar colliders only, never a solid blocking bay.
 for x in [-1.85,1.7]:
  for y in [-1.67,1.67]: colliders.cuboid('pillar_'+str(x)+'_'+str(y),(.48,.48,2.96),(x,y,1.73),root)
 colliders.cuboid('kiosk',(.57,.58,1.28),(1.82,-2.09,.89),root)
 if a.inspect and q==0:
  detail=[]
  for o in root.children_recursive:
   if o.type=='MESH':
    o.data.calc_loop_triangles(); detail.append((len(o.data.loop_triangles),o.name))
  print('OK detailed',sorted(detail,reverse=True)[:30])
 if q==1:
  for o in list(root.children_recursive):
   if o.type=='MESH' and any(o.name.startswith(n) for n in ['tile seam','foam puddle','drain grate','bollard reflective band']): bpy.data.objects.remove(o,do_unlink=True)
 if q==2:
  for o in list(root.children_recursive):
   if o.type=='MESH' and any(o.name.startswith(n) for n in ['wet wash floor','teal pillar band','wall teal band','blue eave','yellow bollard','curtain support','screen bezel','button rim']): bpy.data.objects.remove(o,do_unlink=True)
 export.merge_by_material(root,PROTECTED)
 return root

def stats():
 meshes=[o for o in root.children_recursive if o.type=='MESH']
 for o in meshes:o.data.calc_loop_triangles()
 return {'triangles':sum(len(o.data.loop_triangles) for o in meshes),'draw_calls_static':sum(o.parent==root or o.parent.name in ['roof','interior','kiosk'] for o in meshes),'meshes':len(meshes)}
if a.inspect:
 build(0); print('OK stats',stats())
if a.glb:
 counts={}
 for q,label in [(0,'lod0'),(1,'lod1'),(2,'lod2')]:
  build(q); meshes=[o for o in root.children_recursive if o.type=='MESH']; ao.bake_all(meshes,16 if q==0 else 8)
  for o in meshes:
   for c in o.data.color_attributes['ao'].data:c.color=tuple(.4+.6*v for v in c.color[:3])+(1,)
  counts[label]=stats(); path=Path(a.glb) if q==0 else Path(a.glb).with_name('model.'+label+'.glb'); export.glb(root,path)
 (HERE/'geometry-stats.json').write_text(json.dumps(counts,indent=2)); print('OK',counts)
if a.render:
 build(0)
 if a.pose_test:
  bpy.data.objects['brush_a'].rotation_euler.z=.7; bpy.data.objects['brush_b'].rotation_euler.z=-.7; bpy.data.objects['curtain'].rotation_euler.x=.12; bpy.data.objects['start_button'].location.x-=.025
 scene=bpy.context.scene; scene.render.engine='BLENDER_EEVEE'; scene.eevee.taa_render_samples=a.samples
 # Eevee review with backface culling enabled on every palette material.
 scene.world.color=(.16,.16,.16)
 box('studio ground',(0,0,-.11),(200,200,.18),'uiDark',b=0)
 def light(n,loc,power,color,size):
  d=bpy.data.lights.new(n,'AREA'); d.energy=power; d.color=color; d.size=size; o=bpy.data.objects.new(n,d); bpy.context.collection.objects.link(o); o.location=loc; o.rotation_euler=(Vector((0,-.5,1.5))-o.location).to_track_quat('-Z','Y').to_euler()
 light('golden key',(5,-7,9),1700,(1,.78,.56),6); light('sky fill',(0,5,7),1200,(.65,.78,1),5); light('rim',(-5,-2,6),1400,(1,.8,.62),4)
 d=bpy.data.cameras.new('game camera'); o=bpy.data.objects.new('game camera',d); bpy.context.collection.objects.link(o)
 o.location={'game':(12,-8,12),'hero':(12,-8,8),'front':(13,-.5,5),'back':(-11,7,7),'side':(0,-14,6)}[a.view]; o.rotation_euler=(Vector((0,.6,2))-o.location).to_track_quat('-Z','Y').to_euler(); d.type='ORTHO'; d.ortho_scale=12.4; scene.camera=o
 scene.view_settings.view_transform='AgX'; scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100; scene.render.image_settings.file_format='PNG'; scene.render.filepath=a.render
 bpy.ops.render.render(write_still=True); print('OK render',a.render)
