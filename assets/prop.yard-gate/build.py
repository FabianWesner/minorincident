"""Deterministic Level 1 side prop, metres, Blender +X front / +Z up.
Run only through experiment/tools/blender_run.py. See notes.md for contracts.
"""
import argparse,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]/'tools/blender'))
from sslib import palette,ao
p=argparse.ArgumentParser()
p.add_argument('--glb');p.add_argument('--render');p.add_argument('--view',default='game')
p.add_argument('--variant',choices=['wood','chain-link'],default='wood')
p.add_argument('--open-angle',type=float,default=0)
p.add_argument('--samples',type=int,default=24);p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root)
root['asset_id']=HERE.name;root['forward']='+X';root['tier']='side'
parts=[]
def empty(name,pos=(0,0,0),parent=root):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;o.location=pos;return o
def finish(o,token,bevel=0,owner=root):
 m=palette.mat(token);m.use_backface_culling=True
 shader=m.node_tree.nodes['Principled BSDF'];shader.inputs['Roughness'].default_value=.66
 if token=='silver':shader.inputs['Metallic'].default_value=.65;shader.inputs['Roughness'].default_value=.3
 o.data.materials.append(m)
 bpy.context.view_layer.objects.active=o
 if bevel:
  mod=o.modifiers.new('soft bevel','BEVEL');mod.width=bevel;mod.segments=3
  bpy.ops.object.modifier_apply(modifier=mod.name)
  mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.context.view_layer.update();world=o.matrix_world.copy();o.parent=owner;o.matrix_world=world
 parts.append(o);return o
def box(name,pos,size,token,bevel=.012,owner=root):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.name=name;o.dimensions=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return finish(o,token,min(bevel,min(size)*.3),owner)
def tube(name,points,radius,token='silver',sides=12,owner=root):
 points=[Vector(v) for v in points];vertices=[];faces=[]
 for i,c in enumerate(points):
  t=(points[min(i+1,len(points)-1)]-points[max(i-1,0)]).normalized()
  # A fixed plane normal prevents tube-ring twists at rounded corners.
  if max(p.y for p in points)-min(p.y for p in points)<1e-9:axis=Vector((0,1,0))
  elif max(p.x for p in points)-min(p.x for p in points)<1e-9:axis=Vector((1,0,0))
  else:axis=min([Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1))],key=lambda a:abs(a.dot(t)))
  u=(axis-t*axis.dot(t)).normalized();v=t.cross(u).normalized()
  for j in range(sides):
   theta=j*math.tau/sides;vertices.append(tuple(c+radius*(math.cos(theta)*u+math.sin(theta)*v)))
 for i in range(len(points)-1):
  for j in range(sides):
   k=i*sides+j;n=i*sides+(j+1)%sides;faces.append((k,n,n+sides,k+sides))
 faces += [tuple(reversed(range(sides))),tuple((len(points)-1)*sides+j for j in range(sides))]
 me=bpy.data.meshes.new(name);me.from_pydata(vertices,[],faces);me.update()
 o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o)
 for f in me.polygons:f.use_smooth=len(f.vertices)==4
 return finish(o,token,0,owner)
def rod(name,start,end,radius,token='silver',owner=root,sides=12):return tube(name,[start,end],radius,token,sides,owner)
def beam(name,start,end,width,depth,token,owner=root):
 start,end=Vector(start),Vector(end);o=box(name,(start+end)/2,(depth,width,(end-start).length),token,.008,owner)
 o.rotation_euler=(end-start).to_track_quat('Z','Y').to_euler();return o
def cap(name,y,z,token,owner=root):
 box(name+' collar',(0,y,z),(.26,.26,.055),token,.01,owner)
 verts=[(-.13,y-.13,z+.027),(.13,y-.13,z+.027),(.13,y+.13,z+.027),(-.13,y+.13,z+.027),(0,y,z+.14)]
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],[(3,2,1,0),(0,1,4),(1,2,4),(2,3,4),(3,0,4)])
 o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);finish(o,token,.006,owner)
def bolt(x,y,z,owner=root,token='uiDark',r=.012):return rod('fastener',(x,y,z),(x+.008,y,z),r,token,owner,8)
def grain(y,z,length,owner=root,x=.048):
 # Shallow raised wood grooves and knots, separated from the board face.
 rod('wood grain',(x,y,z-length/2),(x,y+.006,z+length/2),.0025,'leatherShadow',owner,5)

HEIGHT=1.65
root['variant']=a.variant
# Gate travels in XY, with its hinge on the right post (+Y).
hinge_y=.688 if a.variant=='wood' else .715
gate=empty('gate',(0,hinge_y,0));gate['hinge_axis']='Y';gate['open_angle_degrees']=95
for y in [-.82,.82]:
 if a.variant=='wood':
  box('cream post',(0,y,.745),(.19,.19,1.49),'picketWhite',.014);cap('pyramid cap',y,1.49,'picketWhite')
 else:
  rod('steel post',(0,y,.07),(0,y,1.52),.063)
  bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=.07,location=(0,y,1.56));finish(bpy.context.object,'silver')
  for z in [.045,.26,1.36,1.49]:rod('post collar',(0,y,z-.026),(0,y,z+.026),.076)
 empty('col:post'+('L' if y<0 else 'R'),(0,y,.8))['collider']='cuboid'
 col=bpy.data.objects.get('col:post'+('L' if y<0 else 'R'));col['size']=[.19,1.6,.19]
if a.variant=='wood':
 for i in range(8):
  y=-.58+i*.166;top=1.32+.065*math.sin(i*math.pi/7)
  # Extruded semicircular board heads, rather than flat box pickets.
  r=.077;profile=[(y-r,.09),(y+r,.09),(y+r,top-r)]
  profile += [(y+r*math.cos(k*math.pi/12),top-r+r*math.sin(k*math.pi/12)) for k in range(1,13)]
  n=len(profile);verts=[(x,u,z) for x in [-.045,.045] for u,z in profile]
  faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
  me=bpy.data.meshes.new('rounded picket');me.from_pydata(verts,[],faces)
  o=bpy.data.objects.new('rounded picket',me);bpy.context.collection.objects.link(o);finish(o,'woodWarm',.007,gate)
  for z,length in [(.43,.34),(.95,.27)]:grain(y+.027,z,length,gate,x=.048)
  for z in [.28,.8,1.14]:
   # Visible shallow knot, monochrome palette.
   rod('wood knot',(.049,y-.019,z),(.054,y-.019,z),.008,'leatherShadow',gate,8)
 for z in [.26,1.12]:
  box('horizontal rail',(.087,0,z),(.075,1.36,.13),'woodWarm',.012,gate)
  for y in [-.57,-.35,-.12,.12,.35,.57]:bolt(.128,y,z,gate)
 beam('diagonal brace',(.094,-.59,.35),(.094,.59,1.04),.14,.075,'woodWarm',gate)
 for z in [.30,1.10]:
  box('hinge strap',(.143,.56,z),(.025,.22,.055),'uiDark',.011,gate)
  rod('hinge pin',(.142,.688,z-.071),(.142,.688,z+.071),.026,'uiDark')
  bolt(.16,.49,z,gate,r=.016)
 box('latch plate',(.133,-.58,.97),(.025,.075,.14),'uiDark',.012,gate)
 rod('latch handle',(.166,-.72,.97),(.166,-.5,.97),.022,'uiDark',gate)
else:
 # Rounded frame tube, closed and solid with outward winding.
 pts=[]
 for cy,cz,start in [(-.54,.18,math.pi),(.54,.18,1.5*math.pi),(.54,1.36,0),(-.54,1.36,.5*math.pi)]:
  for k in range(9):
   t=start+k*math.pi/16;pts.append((0,cy+.08*math.cos(t),cz+.08*math.sin(t)))
 pts.append(pts[0]);tube('rounded gate frame',pts,.033,'silver',16,gate)
 # Diamond mesh uses solid cylinders, never alpha texture planes.
 lo,hi,bottom,top=-.53,.53,.18,1.36
 for slope in [-1.18,1.18]:
  for k in range(-12,14):
   intercept=k*.19;hits=[]
   for y in [lo,hi]:
    z=slope*y+intercept
    if bottom<=z<=top:hits.append((.007 if slope>0 else -.007,y,z))
   for z in [bottom,top]:
    y=(z-intercept)/slope
    if lo<y<hi:hits.append((.007 if slope>0 else -.007,y,z))
   if len(hits)==2:rod('diamond weave',hits[0],hits[1],.006,'silver',gate,8)
 for y in [-.62,.62]:
  for z in [.29,1.27]:
   box('mount bracket',(.058,y,z),(.055,.11,.065),'silver',.007,gate);bolt(.09,y,z,gate,token='denim',r=.013)
 for z in [.31,1.29]:
  rod('hinge barrel',(0,.715,z-.045),(0,.715,z+.045),.034,'silver')
  box('hinge link',(0,.69,z),(.07,.18,.045),'silver',.008,gate)
 box('latch housing',(.07,-.61,.87),(.08,.08,.20),'silver',.012,gate)
 box('latch receiver',(.035,-.75,.88),(.07,.09,.11),'silver',.007)
col=empty('col:gate',(0,-hinge_y,.73),gate);col['collider']='cuboid';col['size']=[.15,1.32,1.34]
empty('hingeSocket',(0,hinge_y,.7));empty('latchSocket',(0,-.66,.9))


def lodbox(name,pos,size,token,level,owner=root):
 o=box(name,pos,size,token,0,owner)
 if level==1:
  bpy.context.view_layer.objects.active=o
  b=o.modifiers.new('single bevel silhouette','BEVEL');b.width=min(.006,min(size)*.2);b.segments=1;bpy.ops.object.modifier_apply(modifier=b.name)
 return o
def lodcap(y,z,token):
 verts=[(-.13,y-.13,z),(.13,y-.13,z),(.13,y+.13,z),(-.13,y+.13,z),(0,y,z+.14)]
 me=bpy.data.meshes.new('cap silhouette');me.from_pydata(verts,[],[(3,2,1,0),(0,1,4),(1,2,4),(2,3,4),(3,0,4)])
 o=bpy.data.objects.new('cap silhouette',me);bpy.context.collection.objects.link(o);finish(o,token)

def make_lod(level):
 if a.variant=='wood':
  for y in [-.82,.82]:
   lodbox('post',(0,y,.745),(.19,.19,1.49),'picketWhite',level);lodcap(y,1.49,'picketWhite')
  if level==1:
   for i in range(8):
    y=-.58+i*.166;top=1.32+.065*math.sin(i*math.pi/7);r=.077
    profile=[(y-r,.09),(y+r,.09),(y+r,top-r)]+[(y+r*math.cos(k*math.pi/6),top-r+r*math.sin(k*math.pi/6)) for k in range(1,7)]
    n=len(profile);verts=[(x,u,z) for x in [-.045,.045] for u,z in profile]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
    me=bpy.data.meshes.new('picket silhouette');me.from_pydata(verts,[],faces);o=bpy.data.objects.new('picket silhouette',me);bpy.context.collection.objects.link(o);finish(o,'woodWarm',0,gate)
  else:
   # Continuous panel retains the scalloped upper silhouette at distance.
   profile=[(-.66,.09),(.66,.09)]+[(.66-i*1.32/16,1.31+.08*math.sin((i%2)*math.pi/2)) for i in range(17)]
   n=len(profile);verts=[(x,u,z) for x in [-.045,.045] for u,z in profile]
   faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
   me=bpy.data.meshes.new('gate panel silhouette');me.from_pydata(verts,[],faces);o=bpy.data.objects.new('gate panel silhouette',me);bpy.context.collection.objects.link(o);finish(o,'woodWarm',0,gate)
  for z in [.26,1.12]:
   lodbox('rail',(.087,0,z),(.075,1.36,.13),'woodWarm',level,gate)
   lodbox('hinge strap',(.143,.56,z),(.025,.22,.055),'uiDark',level,gate)
   rod('hinge pin',(.142,.688,z-.071),(.142,.688,z+.071),.026,'uiDark',sides=6 if level==1 else 4)
  start,end=Vector((.094,-.59,.35)),Vector((.094,.59,1.04))
  o=lodbox('diagonal brace',(start+end)/2,(.075,.14,(end-start).length),'woodWarm',level,gate);o.rotation_euler=(end-start).to_track_quat('Z','Y').to_euler()
  lodbox('latch',(.15,-.60,.97),(.035,.15,.06),'uiDark',level,gate)
 else:
  for y in [-.82,.82]:
   rod('steel post',(0,y,0),(0,y,1.59),.068,'silver',sides=8 if level==1 else 4)
   if level==1:
    for z in [.06,.26,1.36,1.49]:rod('collar',(0,y,z-.022),(0,y,z+.022),.076,'silver',sides=6)
  if level==1:
   path=[]
   for cy,cz,start in [(-.54,.18,math.pi),(.54,.18,1.5*math.pi),(.54,1.36,0),(-.54,1.36,.5*math.pi)]:
    for k in range(4):
     t=start+k*math.pi/6;path.append((0,cy+.08*math.cos(t),cz+.08*math.sin(t)))
  else:path=[(0,-.62,.10),(0,.62,.10),(0,.62,1.44),(0,-.62,1.44)]
  path.append(path[0]);tube('gate frame',path,.036,'silver',6 if level==1 else 4,gate)
  if level==1:
   for slope in [-1.18,1.18]:
    for k in range(-6,7):
     intercept=k*.38;hits=[]
     for y in [-.54,.54]:
      z=slope*y+intercept
      if .18<=z<=1.36:hits.append((0,y,z))
     for z in [.18,1.36]:
      y=(z-intercept)/slope
      if -.54<y<.54:hits.append((0,y,z))
     if len(hits)==2:rod('diamond mesh',hits[0],hits[1],.008,'silver',gate,4)
  else:
   for slope in [-1.18,1.18]:
    for intercept in [0,.76,1.52]:
     hits=[]
     for y in [-.54,.54]:
      z=slope*y+intercept
      if .18<=z<=1.36:hits.append((0,y,z))
     for z in [.18,1.36]:
      y=(z-intercept)/slope
      if -.54<y<.54:hits.append((0,y,z))
     if len(hits)==2:rod('diamond silhouette',hits[0],hits[1],.01,'silver',gate,4)
  if level==1:
   for z in [.31,1.29]:lodbox('hinge link',(0,.69,z),(.07,.18,.05),'silver',2,gate)
   lodbox('latch housing',(.07,-.61,.87),(.08,.08,.20),'silver',2,gate)

# Merge only within each rigid assembly, keeping hinge and socket empties intact.
meshes=[]
groups={}
for o in parts:groups.setdefault((o.parent,o.data.materials[0]),[]).append(o)
for (owner,mat),obs in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=bpy.context.object
 o.name=('body' if owner==root and not meshes else owner.name+'_'+mat.name)
 meshes.append(o)
bpy.context.view_layer.update()
ao.bake_all(meshes,samples=32)
def count():
 for o in meshes:o.data.calc_loop_triangles()
 return sum(len(o.data.loop_triangles) for o in meshes)
def save(path):
 objects=[root]+[o for o in root.children_recursive if o.type=='EMPTY']+meshes
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_attributes=True,export_cameras=False,export_lights=False)
counts={'lod0':count()}
if a.glb:
 output=Path(a.glb).resolve();save(output)
 originals=meshes[:];original_names={o:o.name for o in originals}
 for o in originals:o.name='high_'+o.name;o.hide_render=True
 for level in [1,2]:
  start=len(parts);make_lod(level);newparts=parts[start:];groups={}
  for o in newparts:groups.setdefault((o.parent,o.data.materials[0]),[]).append(o)
  meshes=[]
  for (owner,mat),obs in groups.items():
   bpy.ops.object.select_all(action='DESELECT')
   for o in obs:o.select_set(True)
   bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=bpy.context.object
   o.name='body' if owner==root and not meshes else owner.name+'_'+mat.name;meshes.append(o)
  ao.bake_all(meshes,samples=32)
  counts['lod'+str(level)]=count();save(output.with_name(output.stem+f'.lod{level}.glb'))
  for o in meshes:bpy.data.objects.remove(o,do_unlink=True)
 meshes=originals
 for o,name in original_names.items():o.name=name;o.hide_render=False
 report={'id':HERE.name,'variant':a.variant if 'gate' in globals() else None,'triangles':counts,'draw_calls':len(meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials}),'nodes_ok':True,'backface_culling':True,'baked_ao':True}
 output.with_suffix('.metrics.json').write_text(json.dumps(report,indent=2)+'\n')
 print('OK',json.dumps(report))
if 'gate' in globals():gate.rotation_euler.z=math.radians(a.open_angle)
if a.render:
 scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.eevee.taa_render_samples=a.samples
 scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
 scene.world=bpy.data.worlds.new('neutral studio');scene.world.color=(.08,.07,.1)
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.008));bpy.context.object.data.materials.append(palette.mat('uiDark'))
 target=Vector((0,0,HEIGHT*.46))
 directions={'game':(7,7,7.2),'ref':(7,4,3.6),'rear':(-7,-4,3.6),'front':(8,0,.4),'side':(0,8,.4)}
 bpy.ops.object.camera_add(location=target+Vector(directions[a.view]));c=bpy.context.object;c.rotation_euler=(target-c.location).to_track_quat('-Z','Y').to_euler()
 c.data.type='ORTHO';c.data.ortho_scale=5.6 if HERE.name=='prop.privacy-fence' and a.view=='game' else 4.8;scene.camera=c
 for pos,power,color in [((4,-3,6),650,(1,.84,.68)),((-3,2,5),500,(.68,.77,1)),((2,4,5),450,(1,.85,.72))]:
  bpy.ops.object.light_add(type='AREA',location=pos);l=bpy.context.object;l.data.energy=power;l.data.size=4;l.data.color=color;l.rotation_euler=(target-l.location).to_track_quat('-Z','Y').to_euler()
 scene.view_settings.view_transform='AgX';scene.render.filepath=str(Path(a.render).resolve());Path(a.render).parent.mkdir(exist_ok=True,parents=True)
 bpy.ops.render.render(write_still=True)
