"""Deterministic palette-only LMG; +X muzzle, Z up, metres. Run via blender_run.py."""
import argparse,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]/'tools/blender'))
from sslib import palette
p=argparse.ArgumentParser()
for key in ('render','glb'):p.add_argument('--'+key)
p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
M={t:palette.mat(t) for t in ('uiDark','asphalt','sidewalk','woodWarm','grass','schoolBusYellow','picketWhite','survivorRed')}
for t in ('uiDark','asphalt','sidewalk','schoolBusYellow'):
 s=M[t].node_tree.nodes['Principled BSDF'];s.inputs['Metallic'].default_value=.65;s.inputs['Roughness'].default_value=.34
parts={}
def finish(o,t,b=.003,group='static'):
 o.data.materials.append(M[t]);bpy.context.view_layer.objects.active=o
 if b:
  mod=o.modifiers.new('edge bevel','BEVEL');mod.width=b;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
 mod=o.modifiers.new('corner normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
 parts.setdefault(group,[]).append(o);return o

def box(n,loc,size,t,b=.003,group='static'):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=n;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,t,b,group)
def cyl(n,loc,r,d,t,axis='X',N=12,b=0,group='static'):
 rot={'X':(0,math.pi/2,0),'Y':(math.pi/2,0,0),'Z':(0,0,0)}[axis]
 bpy.ops.mesh.primitive_cylinder_add(vertices=N,radius=r,depth=d,location=loc,rotation=rot);o=bpy.context.object;o.name=n;return finish(o,t,b,group)
def profile(n,points,width,t,group='static'):
 N=len(points);v=[(x,y,z) for y in (-width/2,width/2) for x,z in points];f=[tuple(range(N-1,-1,-1)),tuple(range(N,2*N))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
 me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);return finish(o,t,.004,group)
def rod(n,start,end,r,t,group='static'):
 d=Vector(end)-Vector(start);o=cyl(n,(Vector(start)+Vector(end))/2,r,d.length,t,'Z',6,0,group);o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o
# Hollow axial shells: radii at each section, true inner wall and end annuli.
Z=.355
def tube(n,sections,inner,t,N=18):
 v=[]
 for x,r in sections:
  for radius in (r,inner):
   v.extend((x,math.sin(i*2*math.pi/N)*radius,Z+math.cos(i*2*math.pi/N)*radius) for i in range(N))
 f=[]
 for k in range(len(sections)-1):
  for j in range(2):
   for i in range(N):
    q=k*2*N+j*N+i;qn=k*2*N+j*N+(i+1)%N
    f.append((q,qn,qn+2*N,q+2*N) if j==0 else (q+2*N,qn+2*N,qn,q))
 for k in (0,len(sections)-1):
  for i in range(N):
   q=k*2*N+i;qn=k*2*N+(i+1)%N;f.append((q,q+N,qn+N,qn))
 me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);return finish(o,t,0)
tube('olive launch tube',[(-.61,.107),(-.46,.107),(-.43,.12),(-.25,.12),(-.22,.107),(.65,.107)],.084,'grass')
tube('rear taper',[(-.80,.155),(-.65,.116),(-.61,.107)],.084,'asphalt')
tube('rear exhaust lip',[(-.827,.171),(-.795,.171)],.139,'asphalt')
tube('rear inner bevel',[(-.831,.151),(-.818,.151)],.135,'woodWarm')
tube('front mouth rim',[(.635,.126),(.690,.126)],.094,'asphalt')
tube('front rim edge',[(.689,.126),(.698,.122)],.099,'woodWarm')
for x,r,w in [(.60,.124,.026),(.20,.119,.14),(.035,.116,.022),(-.195,.116,.024)]:
 tube('reinforcement band',[(x-w/2,r),(x+w/2,r)],.106,'asphalt')
for x in (.495,-.48,-.59):tube('yellow warning band',[(x-.016,.111),(x+.016,.111)],.105,'schoolBusYellow')
# Front and rear rim attachment lugs.
for x,r in [(.65,.126),(-.814,.171)]:
 for ang in (0,math.pi,math.pi/2,3*math.pi/2):
  y=math.sin(ang)*r;z=Z+math.cos(ang)*r
  box('rim lug',(x,y,z),(.044,.036,.035),'asphalt')
  cyl('rim bolt',(x+.025,y,z),.006,.008,'woodWarm',N=8,b=0)
# Side control housing and the two chunky downward grips.
box('control housing',(.205,-.095,.298),(.144,.055,.095),'asphalt',.009)
box('control plate',(.205,-.127,.298),(.125,.012,.063),'uiDark',.004)
box('switch rail',(.205,-.105,.247),(.137,.067,.040),'asphalt',.004)
for x in (.159,.197):cyl('red switch',(x,-.144,.252),.011,.009,'survivorRed','Y',12,.001)
cyl('status stud',(.25,-.144,.252),.0035,.008,'schoolBusYellow','Y',8,0)
for x in (.22,-.02):
 # Splayed grips mirror reference; front grip longer.
 length=.183 if x>0 else .151
 o=box('grip shell',(x+.024,0,.235-length/2),(.078,.067,length),'asphalt',.010);o.rotation_euler.y=-.18 if x>0 else .19
 for side in (-1,1):
  o=box('grip recessed panel',(x+.024,side*.038,.235-length/2),(.047,.011,length-.039),'uiDark',.006);o.rotation_euler.y=-.18 if x>0 else .19
  for z in (.235-length+.021,.215):cyl('grip screw',(x+.024,side*.046,z),.004,.007,'woodWarm','Y',8,0)
 box('grip shoe',(x+.038,0,.235-length),(.086,.079,.017),'asphalt',.004)
# Curved open guard and separate trigger on the trigger pin.
for i in range(12):
 th1=math.pi*.05+i*math.pi*1.9/12;th2=math.pi*.05+(i+1)*math.pi*1.9/12
 rod('trigger guard',(.063+.035*math.cos(th1),0,.203+.039*math.sin(th1)),(.063+.035*math.cos(th2),0,.203+.039*math.sin(th2)),.006,'asphalt')
rod('trigger',(.044,0,.238),(.048,0,.192),.007,'survivorRed','trigger')
# Raised ring sight, pivot at hinge at tube crown.
box('sight base',(.23,0,.481),(.06,.049,.019),'asphalt')
box('sight stem',(.235,0,.512),(.025,.027,.058),'asphalt',.004,'sight')
# Reference ring silhouette lies in the side plane.
bpy.ops.mesh.primitive_torus_add(major_radius=.031,minor_radius=.006,major_segments=18,minor_segments=6,location=(.235,0,.560),rotation=(math.pi/2,0,0))
finish(bpy.context.object,'asphalt',0,'sight')
cyl('sight hinge',(.235,-.025,.501),.008,.01,'woodWarm','Y',10,0)
# Carry handle on top with yellow alternating sleeves.
for x in (-.47,-.28):box('handle mount',(x,0,.480),(.035,.043,.037),'asphalt')
cyl('carry bar',(-.375,0,.503),.013,.19,'asphalt')
for i in range(5):cyl('handle wrap',(-.45+i*.037,0,.503),.014,.014,'woodWarm',N=12)
# Arrow is an extruded polygon, 4mm clear of the broad side.
points=[(.45,.345),(.39,.345),(.39,.365),(.45,.365),(.45,.381),(.487,.355),(.45,.329)]
o=profile('forward arrow',points,.009,'picketWhite');o.location.y=-.108
# Purposeful chunky hardware, raised off band surfaces.
for x in (.20,.035,-.195,.60):
 for ang in (-math.pi/2,-math.pi/4,0,math.pi/2):
  r=.125 if x in (.20,.60) else .119
  y=math.sin(ang)*r;z=Z+math.cos(ang)*r
  o=cyl('band rivet',(x,y,z),.004,.009,'woodWarm','Z',8,0);o.rotation_euler=Vector((0,y,z-Z)).to_track_quat('Z','Y').to_euler()
# Selective broad paint chips, proud geometry; deterministic placement.
for x,z in [(.55,.36),(.38,.40),(.32,.30),(-.14,.37),(-.36,.40),(-.54,.32)]:
 box('paint chip',(x,-.108,z),(.017,.008,.006),'woodWarm',.001)
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root)
for group,objects in parts.items():
 for o in objects:o.name='part_'+o.name
 parent=root
 if group!='static':
  parent=bpy.data.objects.new(group,None);bpy.context.collection.objects.link(parent);parent.location={'trigger':(.044,0,.238),'sight':(.235,0,.491)}[group];parent.parent=root
 batches={token:[o for o in objects if o.data.materials[0]==M[token]] for token in M}
 for token,batch in batches.items():
  if not batch:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in batch:o.select_set(True)
  bpy.context.view_layer.objects.active=batch[0];bpy.ops.object.join();o=bpy.context.object;o.name='body' if group=='static' and token=='grass' else group+'_'+token
  bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);world=o.matrix_world.copy();o.parent=parent;o.matrix_world=world
# Lowest grip contact becomes ground plane.
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
low=min((o.matrix_world@Vector(c)).z for o in meshes for c in o.bound_box)
for o in list(root.children):o.location.z-=low
for n,loc in [('grip',(-.02,0,.16-low)),('muzzle',(.698,0,Z-low)),('front',(.698,0,Z-low))]:
 o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=root
for o in meshes:o.data.calc_loop_triangles()
report={'id':'wpn.rocket-launcher','tier':'Side','triangles':sum(len(o.data.loop_triangles) for o in meshes),'draw_calls':len(meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials}),'nodes_ok':all(n in bpy.data.objects for n in ('root','body','grip','muzzle','trigger','sight')),'within_budget':False,'rounds':3,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
report['within_budget']=report['triangles']<=6000 and report['draw_calls']<=30
(HERE/'geometry.json').write_text(json.dumps(report,indent=2))
if a.glb:
 from sslib import ao
 ao.bake_all(meshes,samples=32)
 bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True)
if a.render:
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.cycles.use_denoising=True;scene.world=bpy.data.worlds.new('studio');scene.world.color=(.10,.09,.12)
 def aim(o,at):o.rotation_euler=(Vector(at)-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add();cam=bpy.context.object;cam.location={'ref':(1.05,-3,1.04),'game':(1.6,-2.3,2.6),'front':(3,0,.45),'side':(0,-3,.65),'rear':(-3,-1,.8)}[a.view];aim(cam,(0,0,.28));cam.data.type='ORTHO';cam.data.ortho_scale=1.94;scene.camera=cam
 for loc,power,size,color in [((1,-2,3),210,3,(1,.79,.57)),((-1,2,2),230,2,(.60,.70,1)),((0,-1,1),35,2,(1,1,1))]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;aim(o,(0,0,.3))
 scene.view_settings.view_transform='AgX';scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
