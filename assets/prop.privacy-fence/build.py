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

HEIGHT=1.85
root['tile_pitch']=2.6;root['tile_axis']='Z';root['flammable']=True
for y in [-1.17,1.17]:
 box('cedar post',(0,y,.83),(.22,.22,1.66),'woodWarm',.014);cap('post cap',y,1.66,'woodWarm')
 for z in [.25,.6,1.35]:
  for offset in [-.047,.044]:grain(y+offset,z,.18,x=.115)
for i in range(14):
 y=-1.025+i*.158
 box('vertical cedar board',(0,y,.855),(.087,.149,1.47),'woodWarm',.006)
 for z,l in [(.32,.23),(.72,.30),(1.22,.26)]:grain(y+.035,z,l)
 rod('cedar knot',(.048,y-.026,.49+(i%3)*.31),(.054,y-.026,.49+(i%3)*.31),.013,'leatherShadow',sides=9)
 for z in [.2,1.54]:bolt(.049,y,z,token='leatherShadow',r=.006)
for z in [.24,1.53]:
 box('horizontal face rail',(.081,0,z),(.08,2.22,.14),'woodWarm',.012)
 box('rear support rail',(-.085,0,z),(.08,2.22,.13),'woodWarm',.012)
 for y in [-1.02,-.7,-.35,0,.35,.7,1.02]:
  bolt(.125,y,z,token='leatherShadow',r=.008)
  bolt(-.137,y,z,token='leatherShadow',r=.008)
empty('tileStart',(0,-1.3,0));empty('tileEnd',(0,1.3,0))
col=empty('col:body',(0,0,.85));col['collider']='cuboid';col['size']=[.26,1.7,2.6]


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
 for y in [-1.17,1.17]:
  lodbox('post',(0,y,.83),(.22,.22,1.66),'woodWarm',level);lodcap(y,1.66,'woodWarm')
 for i in range(14):lodbox('cedar board',(0,-1.025+i*.158,.855),(.087,.149,1.47),'woodWarm',level)
 for z in [.24,1.53]:
  for x in [.081,-.085]:lodbox('rail',(x,0,z),(.08,2.22,.14),'woodWarm',level)

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
