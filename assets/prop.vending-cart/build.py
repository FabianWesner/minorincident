"""Texture-free street vending cart. Metres, +X front, wheel origins at axles."""
import argparse, json, math, random, sys
from pathlib import Path
import bpy
from mathutils import Vector
OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(OUT.parents[1]/'tools/blender'))
from sslib import ao
p=argparse.ArgumentParser()
p.add_argument('--render'); p.add_argument('--view',default='ref'); p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540); p.add_argument('--glb')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(token,hexcolor,metal=0):
 m=bpy.data.materials.new('pal_'+token); m.use_nodes=True
 c=[int(hexcolor[i:i+2],16)/255 for i in (0,2,4)]
 b=m.node_tree.nodes.get('Principled BSDF'); b.inputs['Base Color'].default_value=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c)+(1,)
 b.inputs['Metallic'].default_value=metal; b.inputs['Roughness'].default_value=.58
 return m
silver=mat('sidewalk','b9a4a0',.65); cream=mat('picketWhite','f2e6dc'); red=mat('survivorRed','d9363e')
dark=mat('uiDark','25222c'); gray=mat('asphalt','5b4f5c',.35); yellow=mat('schoolBusYellow','f2b630'); rust=mat('woodWarm','b0703f')
materials=[silver,cream,red,dark,gray,yellow,rust]; static=[]; moving=[]
def finish(o,name,m,bevel=0):
 o.name=name; o.data.materials.append(m)
 if bevel:
  mod=o.modifiers.new('Rounded edges','BEVEL'); mod.width=bevel; mod.segments=1
  bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
 static.append(o); return o
def box(name,pos,size,m=silver,bevel=.012):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos); o=bpy.context.object; o.dimensions=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return finish(o,name,m,bevel)
def cyl(name,pos,r,depth,m=silver,axis='Z',vertices=12,bevel=.004):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=pos)
 o=bpy.context.object
 if axis=='Y':o.rotation_euler[0]=math.pi/2
 if axis=='X':o.rotation_euler[1]=math.pi/2
 return finish(o,name,m,bevel)
def beam(name,start,end,r,m=silver):
 v=Vector(end)-Vector(start); o=cyl(name,(Vector(start)+Vector(end))/2,r,v.length,m,vertices=8,bevel=0)
 o.rotation_euler=v.to_track_quat('Z','Y').to_euler(); return o
def mesh(name,verts,faces,m):
 data=bpy.data.meshes.new(name); data.from_pydata(verts,[],faces); data.update()
 o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o); return finish(o,name,m)
def torus(name,pos,major,minor,m,axis='Y',n=40,k=8):
 bpy.ops.mesh.primitive_torus_add(major_segments=n,minor_segments=k,major_radius=major,minor_radius=minor,location=pos)
 o=bpy.context.object
 if axis=='Y':o.rotation_euler[0]=math.pi/2
 return finish(o,name,m)
def join_parts(name,group,pivot=None):
 bpy.ops.object.select_all(action='DESELECT')
 for o in group:o.select_set(True)
 bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
 if pivot is not None:
  bpy.context.scene.cursor.location=pivot;bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
 return o
# Cart cabinet and raised structural rails. Rear handle on -X; serving nose +X.
box('Cabinet',(0,0,.79),(1.62,.88,.78),silver,.035)
box('Undercarriage',(0,0,.405),(1.68,.94,.085),gray)
box('Counter rim',(0,0,1.205),(1.77,1.01,.095),silver,.023)
box('Counter inset',(0,0,1.258),(1.64,.89,.024),gray,.009)
for y in [-.454,.454]:
 for x in [-.765,.765]:box('Corner moulding',(x,y,.80),(.045,.036,.75),silver,.009)
 box('Bottom rail',(0,y,.44),(1.71,.06,.09),silver)
 box('Upper rail',(0,y,1.135),(1.69,.045,.065),silver)
 for x in [-.735,-.10,.735]:
  for z in [.50,1.10]:cyl('Panel rivet',(x,y*1.045,z),.016,.014,rust,'Y',8,bevel=0)
 # separated access door with inset frame; no flush overlay
 box('Door recess',(-.40,y*1.01,.79),(.66,.022,.59),gray,.015)
 door=box('Service door',(-.40,y*1.045,.79),(.62,.026,.55),silver,.015)
 pull=box('Door pull',(-.18,y*1.09,.97),(.07,.027,.028),gray,.008)
 # Separate service doors with pivots at the vertical hinge lines.
 for o in [door,pull]:static.remove(o)
 door=join_parts('doorL' if y>0 else 'doorR',[door,pull],(-.70,y*1.045,.79));moving.append(door)
 for z in [.63,.95]:box('Door hinge',(-.70,y*1.10,z),(.037,.028,.075),silver,.008)
for x in [-.817,.817]:
 box('End inset',(x,0,.80),(.025,.77,.65),gray)
 box('End panel',(x*1.019,0,.80),(.028,.72,.60),silver)
 for y in [-.32,.32]:
  for z in [.55,1.05]:cyl('End bolt',(x*1.042,y,z),.016,.014,rust,'X',8,bevel=0)
# One axle, two large ten-spoke wheels. Join each wheel only, retaining centre pivot.
cyl('Axle',(.31,0,.35),.045,1.18,gray,'Y')
for y,name in [(-.57,'wheelR'),(.57,'wheelL')]:
 start=len(static); center=(.31,y,.35)
 torus('Tire',center,.286,.064,dark,n=40,k=8)
 torus('Rim',(.31,y+( .032 if y>0 else -.032),.35),.235,.019,silver,n=32,k=6)
 cyl('Hub',center,.063,.16,gray,'Y'); cyl('Hub cap',(.31,y+( .085 if y>0 else -.085),.35),.038,.02,silver,'Y')
 for i in range(10):
  t=i*math.tau/10
  beam('Spoke',(.31+.055*math.cos(t),y,.35+.055*math.sin(t)),(.31+.234*math.cos(t),y,.35+.234*math.sin(t)),.012,silver)
 for i in range(24):
  t=i*math.tau/24; o=box('Tire tread',(.31+.344*math.cos(t),y,.35+.344*math.sin(t)),(.019,.086,.028),gray,0);o.rotation_euler[1]=-t
 group=static[start:]; del static[start:]
 moving.append(join_parts(name,group,center))
 # rounded arch guard with open underside, above tire
 verts=[]; faces=[]
 for i in range(33):
  t=math.pi*i/32
  for r,yy in [(.367,y-.078),(.405,y-.078),(.367,y+.078),(.405,y+.078)]:verts.append((.31+r*math.cos(t),yy,.35+r*math.sin(t)))
 for i in range(32):
  for u,v in [(0,1),(1,3),(3,2),(2,0)]:faces.append((i*4+u,i*4+v,(i+1)*4+v,(i+1)*4+u))
 faces.extend([(0,2,3,1),(128,129,131,130)]);mesh('Wheel mudguard',verts,faces,silver)
# Rear caster forks and push handle.
for y in [-.33,.33]:
 box('Caster mounting',(-.75,y,.40),(.21,.17,.06),silver)
 beam('Caster fork',(-.73,y-.057,.38),(-.83,y-.057,.155),.025,silver)
 beam('Caster fork',(-.73,y+.057,.38),(-.83,y+.057,.155),.025,silver)
 start=len(static);cyl('Caster',(-.83,y,.145),.145,.095,dark,'Y',32)
 cyl('Caster hub',(-.83,y,.145),.084,.106,gray,'Y');cyl('Caster bolt',(-.83,y,.145),.025,.12,silver,'Y',12)
 group=static[start:];del static[start:]
 moving.append(join_parts('wheelCaster'+('L' if y>0 else 'R'),group,(-.83,y,.145)))
for y in [-.39,.39]:
 beam('Handle bracket',(-.80,y,.99),(-.91,y,1.18),.027,silver)
 beam('Handle arm',(-.91,y,1.18),(-1.19,y,1.18),.027,silver)
beam('Push handle',(-1.19,-.39,1.18),(-1.19,.39,1.18),.029,silver)
# Counter: raised trays, bottles, steam chest with lid and chimney.
box('Bottle tray',(-.48,-.12,1.294),(.57,.39,.035),silver)
box('Tray well',(-.48,-.12,1.314),(.51,.33,.012),dark,.008)
for i,m in enumerate([red,yellow,rust]):
 x=-.67+i*.19
 box('Condiment bottle',(x,-.12,1.425),(.12,.12,.22),m,.021)
 cyl('Bottle collar',(x,-.12,1.553),.062,.035,m)
 cyl('Bottle cap',(x,-.12,1.578),.043,.021,m)
 bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=.018,radius2=.006,depth=.072,location=(x,-.12,1.62));finish(bpy.context.object,'Nozzle',m)
box('Steam box gasket',(.29,.08,1.295),(.56,.49,.04),dark)
box('Steam chest',(.29,.08,1.405),(.51,.44,.20),silver,.021)
box('Lid lip',(.29,.08,1.517),(.55,.48,.04),silver,.012)
box('Lid inset',(.29,.08,1.54),(.45,.38,.008),gray,.006)
cyl('Steam chimney',(.32,.10,1.603),.033,.12,silver)
cyl('Chimney cap',(.32,.10,1.668),.041,.015,gray)
for x in [.64,-.16]:
 box('Food well',(x,.02,1.287),(.13,.64,.024),dark,.008)
 for y in [-.31,.35]:box('Well frame',(x,y,1.311),(.16,.025,.025),silver,.005)
 for xx in [x-.073,x+.073]:box('Well side',(xx,.02,1.311),(.018,.66,.025),silver,.005)
for y in [.425]:
 box('Splash rail',(-.42,y,1.34),(.74,.04,.14),silver)
 box('Splash inset',(-.42,y-.025,1.34),(.65,.014,.085),gray)
# Umbrella: eight alternating sewn panels, gently domed radial profile, scalloped valance.
ux,uy=.05,.20
cyl('Umbrella pole',(ux,uy,1.845),.024,1.22,silver)
cyl('Pole socket',(ux,uy,1.30),.044,.08,gray)
radii=[.035,.39,.77,1.12]; heights=[2.62,2.57,2.43,2.22]
for sector in range(8):
 m=red if sector%2==0 else cream; verts=[];faces=[];steps=6
 for r,z in zip(radii,heights):
  for j in range(steps+1):
   t=(sector+j/steps)*math.tau/8
   dx=(1-j/steps)*math.cos(sector*math.tau/8)+(j/steps)*math.cos((sector+1)*math.tau/8)
   dy=(1-j/steps)*math.sin(sector*math.tau/8)+(j/steps)*math.sin((sector+1)*math.tau/8)
   # Panel dips slightly between seam ribs.
   verts.append((ux+r*dx,uy+r*dy,z-.018*math.sin(math.pi*j/steps)*(r/1.12)))
 for ring in range(3):
  for j in range(steps):
   k=ring*(steps+1)+j;faces.append((k,k+1,k+steps+2,k+steps+1))
 o=mesh('Canopy panel',verts,faces,m);mod=o.modifiers.new('Canvas thickness','SOLIDIFY');mod.thickness=.007
 bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 verts=[];faces=[]
 for j in range(steps+1):
  t=(sector+j/steps)*math.tau/8
  dx=(1-j/steps)*math.cos(sector*math.tau/8)+(j/steps)*math.cos((sector+1)*math.tau/8)
  dy=(1-j/steps)*math.sin(sector*math.tau/8)+(j/steps)*math.sin((sector+1)*math.tau/8)
  z=2.22-.018*math.sin(math.pi*j/steps)
  # Split scalloped edge produces a central small notch.
  bottom=2.045+(.035 if j==3 else .012 if j in (0,6) else 0)
  verts.extend([(ux+1.12*dx,uy+1.12*dy,z),(ux+1.135*dx,uy+1.135*dy,bottom)])
 for j in range(steps):faces.append((j*2,j*2+1,j*2+3,j*2+2))
 o=mesh('Scalloped valance',verts,faces,m);mod=o.modifiers.new('Hem thickness','SOLIDIFY');mod.thickness=.008
 bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 t=sector*math.tau/8
 for i in range(3):
  beam('Canopy seam',(ux+radii[i]*math.cos(t),uy+radii[i]*math.sin(t),heights[i]+.014),(ux+radii[i+1]*math.cos(t),uy+radii[i+1]*math.sin(t),heights[i+1]+.014),.006,m)
 # underside spoke terminating at panel corner
 beam('Umbrella rib',(ux,uy,2.40),(ux+1.10*math.cos(t),uy+1.10*math.sin(t),2.213),.009,gray)
cyl('Umbrella crown',(ux,uy,2.635),.075,.026,silver)
cyl('Umbrella finial',(ux,uy,2.669),.035,.044,silver)
# Sparse proud paint chips and scuffs, deliberately geometric and deterministic.
rng=random.Random(27)
for y in [-.479,.479]:
 for i in range(28):
  x=rng.uniform(-.73,.73);z=rng.uniform(.49,1.10)
  if (x-.31)**2+(z-.35)**2<.41**2:continue
  w=rng.uniform(.010,.035);h=rng.uniform(.006,.025)
  mesh('Cabinet wear',[(x-w,y,z),(x-.3*w,y,z+h),(x+w,y,z+.3*h),(x+.4*w,y,z-h)],[(0,1,2,3)],rust if i%3 else gray)
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root)
root['asset_id']='prop.vending-cart';root['front']='+X';root['tier']='Side'
root['ss_physics']={'class':'medium','mass':75,'friction':.6,'restitution':.1,'centerOfMass':[0,.65,0],'pushable':True,'kickable':False,'barricadeValue':1,'barricadeHP':250,'vaultable':False,'flammable':False,'sounds':'prop.metal-medium'}
groups={m:[o for o in static if o.data.materials[0]==m] for m in materials}
for m,group in groups.items():
 if not group:continue
 o=join_parts('body' if m==silver else 'static_'+m.name,group);o.parent=root
for o in moving:o.parent=root
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
# Preserve metre transforms and actual wheel centres.
for o in meshes:
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);o.select_set(False)
col=bpy.data.objects.new('col:cart',None);bpy.context.collection.objects.link(col);col.parent=root;col.location=(0,0,.83)
col['collider']='cuboid';col['shape']='cuboid';col['size']=[1.77,1.20,.86];col['halfExtents']=[.885,.60,.43]
canopycol=bpy.data.objects.new('col:umbrella',None);bpy.context.collection.objects.link(canopycol);canopycol.parent=root;canopycol.location=(ux,uy,2.37)
canopycol['collider']='cuboid';canopycol['shape']='cuboid';canopycol['size']=[2.27,2.27,.65];canopycol['halfExtents']=[1.135,1.135,.325]
low=min((o.matrix_world @ v.co).z for o in meshes for v in o.data.vertices)
for o in meshes+[col,canopycol]:o.location.z-=low
root['ss_physics']['centerOfMass']=[0,.65-low,0]
tris=sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in meshes)
draws=sum(len(o.data.materials) for o in meshes)
report=dict(id='prop.vending-cart',tier='Side',triangles=tris,draw_calls=draws,materials=[m.name for m in materials],nodes_ok=all(bpy.data.objects.get(n) for n in ['root','body','wheelL','wheelR','wheelCasterL','wheelCasterR','doorL','doorR','col:cart']),within_budget=6000<=tris<=12000 and draws<=30,rounds=5,webgpu_ok=False,webgl2_ok=False,gaps=[])
(OUT/'geometry.json').write_text(json.dumps(report,indent=2))
if a.glb:
 ao.bake_all(meshes,samples=32)
 bpy.ops.object.select_all(action='DESELECT')
 for o in [root,col,canopycol]+meshes:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
if a.render:
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.cycles.use_denoising=True
 scene.world.use_nodes=True;bg=scene.world.node_tree.nodes.get('Background');bg.inputs['Color'].default_value=(.12,.10,.16,1);bg.inputs['Strength'].default_value=.45
 floor=mat('renderFloor','2a2730');box('Studio floor',(0,0,-.04),(200,200,.08),floor,0)
 def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
 for loc,power,size,color in [((-3,-4,6),700,4,(1,.79,.65)),((4,3,5),950,3,(1,.63,.32)),((-1,4,3),450,4,(.61,.68,1))]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;aim(o,(0,0,1.2))
 views={'ref':(-4,-6,3.5),'game':(4,-6,7),'front':(6,0,3),'side':(0,-6,3),'rear':(-6,0,3)}
 bpy.ops.object.camera_add(location=views[a.view]);camera=bpy.context.object;aim(camera,(0,0,1.32));camera.data.type='ORTHO';camera.data.ortho_scale=5.8 if a.view=='game' else 5.6;scene.camera=camera
 scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=a.render;bpy.ops.render.render(write_still=True)
print('OK '+json.dumps(report))
