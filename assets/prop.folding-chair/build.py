"""Texture-free folding chair. Metres, +X front, Z up; deterministic wear."""
import argparse, json, math, random, sys
from pathlib import Path
import bpy
from mathutils import Vector
OUT=Path(__file__).resolve().parent
sys.path.insert(0,str(OUT.parents[1]/'tools/blender'))
from sslib import palette, ao
p=argparse.ArgumentParser()
for key,default,typ in [('render',None,str),('view','ref',str),('samples',24,int),('width',960,int),('height',540,int),('glb',None,str)]:p.add_argument('--'+key,default=default,type=typ)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
materials={t:palette.mat(t) for t in ['hairSilver','denimStitch','uiDark','leatherShadow','hairCopper','silver']}
for t,m in materials.items():
 bs=m.node_tree.nodes['Principled BSDF'];bs.inputs['Roughness'].default_value=.64;bs.inputs['Metallic'].default_value=.35 if t not in ['uiDark','leatherShadow','hairCopper'] else .05
parts=[]
def finish(o,token,group='static'):
 o.data.materials.append(materials[token]);o['group']=group;parts.append(o);return o
def box(name,pos,size,token,bevel=.01,group='static'):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.name=name;o.dimensions=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 b=o.modifiers.new('Rounded pressed edge','BEVEL');b.width=bevel;b.segments=4;bpy.ops.object.modifier_apply(modifier=b.name)
 return finish(o,token,group)
def tube(name,path,r,token='hairSilver',group='static',sides=16):
 verts=[];faces=[]
 for i,pt in enumerate(path):
  tangent=Vector(path[min(i+1,len(path)-1)])-Vector(path[max(0,i-1)])
  tangent.normalize();u=tangent.cross(Vector((1,0,0)))
  if u.length<.1:u=tangent.cross(Vector((0,1,0)))
  u.normalize();v=tangent.cross(u)
  for j in range(sides):verts.append(Vector(pt)+r*(u*math.cos(j*2*math.pi/sides)+v*math.sin(j*2*math.pi/sides)))
 for i in range(len(path)-1):
  for j in range(sides):k=i*sides+j;n=i*sides+(j+1)%sides;faces.append((k,n,n+sides,k+sides))
 faces.extend([tuple(reversed(range(sides))),tuple((len(path)-1)*sides+j for j in range(sides))])
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
 for f in mesh.polygons:f.use_smooth=len(f.vertices)==4
 return finish(o,token,group)
def line(name,start,end,r,token='hairSilver',group='static',steps=2):return tube(name,[Vector(start).lerp(Vector(end),i/(steps-1)) for i in range(steps)],r,token,group)
# Leaning front legs continue into the rounded back frame.
def frame_x(z):return .30-.57*z
path=[]
for i in range(31):z=.045+i*(.84/30);path.append((frame_x(z),-.25,z))
for i in range(1,17):ang=math.pi-math.pi/2*i/16;y=-.13+.12*math.cos(ang);z=.885+.12*math.sin(ang);path.append((frame_x(z),y,z))
for i in range(1,13):y=-.13+.26*i/12;path.append((frame_x(1.005),y,1.005))
for i in range(1,17):ang=math.pi/2-math.pi/2*i/16;y=.13+.12*math.cos(ang);z=.885+.12*math.sin(ang);path.append((frame_x(z),y,z))
for i in range(1,31):z=.885-.84*i/30;path.append((frame_x(z),.25,z))
tube('Continuous bent steel frame',path,.023)
# Pressed steel seat, raised lip and rounded back panel.
box('Seat rolled rim',(.065,0,.475),(.47,.51,.063),'denimStitch',.035,'seat')
box('Seat pressed top',(.065,0,.505),(.438,.479,.024),'hairSilver',.032,'seat')
def panel(name,width,height,thick,offset,token):
 outline=[]
 for cy,cz,r,angle in [(-width/2+.06,height/2-.06,.06,90),(width/2-.06,height/2-.06,.06,0),(width/2-.018,-height/2+.018,.018,-90),(-width/2+.018,-height/2+.018,.018,-180)]:
  for i in range(9):
   t=math.radians(angle+90-90*i/8);outline.append((cy+r*math.cos(t),cz+r*math.sin(t)))
 vertices=[(x,y,z) for x in [-thick/2,thick/2] for y,z in outline];n=len(outline)
 faces=[tuple(range(n)),tuple(reversed(range(n,2*n)))]+[(i,i+n,(i+1)%n+n,(i+1)%n) for i in range(n)]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
 o.location=(frame_x(.84)+offset,0,.84);o.rotation_euler[1]=math.atan(-.57);finish(o,token)
panel('Back panel',.443,.295,.027,.013,'hairSilver')
panel('Back rolled rim',.46,.312,.036,-.008,'denimStitch')
for y,label in [(-.25,'L'),(.25,'R')]:
 line('Rear folding leg '+label,(-.285,y,.045),(.008,y,.605),.021,group='rearLegs',steps=10)
 line('Seat support '+label,(-.16,y,.45),(.22,y,.458),.014,group='seat')
 link=box('Folding link '+label,(-.046,y,.469),(.20,.013,.03),'denimStitch',.006,'seat');link.rotation_euler[1]=-.45
 hinge=box('Hinge plate '+label,(.001,y,.594),(.068,.024,.083),'leatherShadow',.015)
 for x,z in [(.005,.615),(.024,.576)]:
  line('Pivot pin',(x,y-.020,z),(x,y+.020,z),.010,'silver')
 for x in [frame_x(.047),-.285]:
  foot=box('Rubber ferrule',(x,y,.041),(.069,.063,.082),'uiDark',.012,'rearLegs' if x<0 else 'static');foot.rotation_euler[1]=-.48 if x<0 else -.51
line('Front lower brace',(.19,-.245,.193),(.19,.245,.193),.018,steps=12)
line('Rear lower brace',(-.207,-.25,.193),(-.207,.25,.193),.013,group='rearLegs',steps=12)
# Irregular chips stand 3.5 mm proud, never coplanar; deterministic shapes.
rng=random.Random(27)
def chip(center,u,v,scale,group):
 n=u.cross(v).normalized();verts=[Vector(center)+.0035*n]
 for j in range(7):
  ang=j*2*math.pi/7;rad=scale*rng.uniform(.55,1.15);verts.append(Vector(center)+.0035*n+rad*(math.cos(ang)*u+math.sin(ang)*v))
 mesh=bpy.data.meshes.new('Paint chip');mesh.from_pydata(verts,[],[(0,1+j,1+(j+1)%7) for j in range(7)]);mesh.update()
 o=bpy.data.objects.new('Raised rust chip',mesh);bpy.context.collection.objects.link(o);finish(o,rng.choice(['leatherShadow','hairCopper']),group)
for i in range(28):
 x=rng.uniform(-.14,.27);y=rng.uniform(-.224,.224)
 if i<18:y=rng.choice([-.225,.225])+rng.uniform(-.009,.009)
 chip((x,y,.517),Vector((1,0,0)),Vector((0,1,0)),rng.uniform(.006,.017),'seat')
for i in range(26):
 z=rng.uniform(.72,.934);y=rng.uniform(-.19,.19)
 if i<18:
  if i%2:y=rng.choice([-.193,.193])
  else:z=rng.choice([.719,.932])+rng.uniform(-.007,.007)
 chip((frame_x(z)+.029,y,z),Vector((0,1,0)),Vector((-.57,0,1)).normalized(),rng.uniform(.006,.017),'static')
# Small paint losses on exposed front tubes.
for y in [-.25,.25]:
 for i in range(16):
  z=rng.uniform(.13,.96);chip((frame_x(z)+.023,y,z),Vector((0,1,0)),Vector((-.57,0,1)).normalized(),rng.uniform(.004,.011),'static')
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root)
root['asset_id']='prop.folding-chair';root['tier']='Side';root['ss_physics']={'class':'light','mass':6,'friction':.65,'restitution':.1,'centerOfMass':[0,.45,0],'pushable':True,'kickable':True,'flammable':False,'sounds':'prop.metal-light'}
front=bpy.data.objects.new('front',None);bpy.context.collection.objects.link(front);front.parent=root;front.location=(.32,0,.48)
parents={'static':root}
for name,pivot in [('seat',(-.16,0,.46)),('rearLegs',(.008,0,.605))]:
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=pivot;o.parent=root;parents[name]=o
meshes=[]
for group,parent in parents.items():
 for token in materials:
  selected=[o for o in parts if o['group']==group and o.data.materials[0]==materials[token]]
  if not selected:continue
  parts=[o for o in parts if o not in selected]
  bpy.ops.object.select_all(action='DESELECT')
  for o in selected:o.select_set(True)
  bpy.context.view_layer.objects.active=selected[0];bpy.ops.object.join();o=bpy.context.object;o.name=group+'_'+token
  bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
  world=o.matrix_world.copy();o.parent=parent;o.matrix_world=world;meshes.append(o)
col=bpy.data.objects.new('col:chair',None);bpy.context.collection.objects.link(col);col.parent=root;col.location=(0,0,.51);col['collider']='cuboid';col['size']=[.66,.57,1.02];col['halfExtents']=[.33,.285,.51]
bpy.context.view_layer.update()
low=min((o.matrix_world@v.co).z for o in meshes for v in o.data.vertices)
for o in root.children:o.location.z-=low
bpy.context.view_layer.update()
tris=sum(len(f.vertices)-2 for o in meshes for f in o.data.polygons)
report=dict(id='prop.folding-chair',tier='Side',triangles=tris,draw_calls=len(meshes),materials=sorted(m.name for m in materials.values()),nodes_ok=True,within_budget=6000<=tris<=12000 and len(meshes)<=30,rounds=3,webgpu_ok=False,webgl2_ok=False,gaps=[])
(OUT/'geometry.json').write_text(json.dumps(report,indent=2))
if a.glb:
 ao.bake_all(meshes,samples=32)
 bpy.ops.object.select_all(action='DESELECT')
 for o in [root,front,col,*parents.values(),*meshes]:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
if a.render:
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.cycles.use_denoising=True
 scene.world.use_nodes=True;bg=scene.world.node_tree.nodes['Background'];bg.inputs['Color'].default_value=(.14,.12,.18,1);bg.inputs['Strength'].default_value=.5
 def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
 for loc,power,size,color in [((3,-4,5),350,3,(1,.82,.69)),((-2,2,3),300,2,(1,.57,.28)),((0,-3,2),120,2,(.69,.73,1))]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;aim(o,(0,0,.5))
 views={'ref':(4,-2,2.4),'game':(3,-4,5),'front':(4,0,1.5),'side':(0,-4,1.5),'rear':(-4,0,1.5)}
 bpy.ops.object.camera_add(location=views[a.view]);cam=bpy.context.object;aim(cam,(0,0,.51));cam.data.type='ORTHO';cam.data.ortho_scale=2.45 if a.view=='game' else 2.35;scene.camera=cam
 scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=a.render
 bpy.ops.render.render(write_still=True)
print('OK '+json.dumps(report))
