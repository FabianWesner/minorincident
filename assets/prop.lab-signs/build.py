"""Reproducible palette geometry. Metres, Z-up, +X front; standalone bpy build."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector, Matrix
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sys.path.insert(0,str(ROOT/'tools/blender'))
from sslib import palette, ao
p=argparse.ArgumentParser()
for key in ('glb','render'):p.add_argument('--'+key)
p.add_argument('--view',default='game',choices=['game','ref','rear'])
p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=1200);p.add_argument('--height',type=int,default=700)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
M={};parts=[]
def mat(token):
 if token not in M:
  M[token]=palette.mat(token);M[token].use_backface_culling=True
  bs=M[token].node_tree.nodes['Principled BSDF'];bs.inputs['Roughness'].default_value=.55
 return M[token]
def empty(name,pos=(0,0,0),parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=pos
 if parent:
  bpy.context.view_layer.update();world=o.matrix_world.copy();o.parent=parent;o.matrix_world=world
 return o
root=empty('root')
parent=root
def finish(o,name,token,bevel=0):
 o.name=name;o.data.materials.append(mat(token));bpy.context.view_layer.objects.active=o
 if bevel:
  m=o.modifiers.new('soft bevel','BEVEL');m.width=bevel;m.segments=1;bpy.ops.object.modifier_apply(modifier=m.name)
 # Outward normals, including hand-authored closed profiles.
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
 m=o.modifiers.new('weighted normals','WEIGHTED_NORMAL');m.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=m.name)
 bpy.context.view_layer.update();world=o.matrix_world.copy();o.parent=parent;o.matrix_world=world;parts.append(o)
 return o
def box(name,pos,size,token,bevel=.018):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return finish(o,name,token,min(bevel,min(size)*.3))
def rod(name,start,end,r,token,n=12):
 d=Vector(end)-Vector(start);bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=d.length,location=(Vector(start)+Vector(end))/2);o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return finish(o,name,token)
def sphere(name,pos,scale,token,n=16):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=n,ring_count=8,location=pos);o=bpy.context.object;o.scale=scale;return finish(o,name,token)
def profile(name,x,depth,points,token,bevel=0):
 # Closed extruded Y/Z polygon, all sides solid.
 k=len(points);vs=[(xx,y,z) for xx in (x-depth/2,x+depth/2) for y,z in points]
 fs=[tuple(range(k-1,-1,-1)),tuple(range(k,2*k))]+[(i,(i+1)%k,(i+1)%k+k,i+k) for i in range(k)]
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);return finish(o,name,token,bevel)
def text(name,words,pos,width,height,token):
 bpy.ops.object.text_add(location=pos);o=bpy.context.object;o.data.body=words;o.data.align_x='CENTER';o.data.align_y='CENTER';o.data.size=1;o.data.space_line=.9;o.data.extrude=.0015;o.data.resolution_u=2;o.data.offset=.012
 bpy.ops.object.convert(target='MESH');o=bpy.context.object
 # Fit converted local geometry; Blender text dimensions can lag rotation updates.
 xs=[v.co.x for v in o.data.vertices];ys=[v.co.y for v in o.data.vertices]
 cx=(min(xs)+max(xs))/2;cy=(min(ys)+max(ys))/2
 scale=min(width/(max(xs)-min(xs)),height/(max(ys)-min(ys)))
 for v in o.data.vertices:v.co.x=(v.co.x-cx)*scale;v.co.y=(v.co.y-cy)*scale;v.co.z*=scale
 o.rotation_euler=Matrix(((0,0,1),(1,0,0),(0,1,0))).to_euler()
 return finish(o,name,token)
def ring(name,pos,r,thickness,token):
 bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=6,major_radius=r,minor_radius=thickness,location=pos,rotation=(0,math.pi/2,0));return finish(bpy.context.object,name,token)
def collider(name,pos,size):
 e=empty('col:'+name,pos,parent);e['collider']='cuboid';e['size']=list(size)
ASSET={'id':'prop.lab-signs','category':'prop','tier':'side'}
root['asset_id']=ASSET['id'];root['tier']='side';root['forward']='+X'
# Each sign keeps its own named parent for layout placement. Front plane = +X.
def post(name,y,height=1.66):
 global parent
 parent=empty(name,parent=root)
 box('galvanized post',(-.025,y,(height-.5)/2),(.075,.075,height-.5),'silver',.01)
 box('post foot',(-.025,y,.025),(.16,.16,.05),'uiDark',.01)
 for z in (.16,.30):box('post perforation',(.016,y,z),(.005,.017,.026),'uiDark',.001)
def plate(y,w,h,z,face):
 box('sign metal backing',(0,y,z),(.055,w+.035,h+.035),'silver',.022)
 box('sign border',(.035,y,z),(.017,w,h),'uiDark',.018)
 box('sign face',(.048,y,z),(.014,w-.028,h-.028),face,.014)
 for yy in (y-w*.40,y+w*.40):
  for zz in (z-h*.40,z+h*.40):rod('plate screw',(.057,yy,zz),(.067,yy,zz),.011,'silver',8)
# Authorized personnel plate: white inner border and red face.
y=-1.72;post('sign_authorized',y,1.70);plate(y,.64,.79,1.30,'picketWhite')
box('authorized red face',(.058,y,1.30),(.009,.578,.728),'survivorRed',.012)
text('authorized text','AUTHORIZED\nPERSONNEL\nONLY',(.068,y,1.30),.52,.61,'picketWhite')
collider('authorized',(0,y,.86),(.12,.68,1.72))
# No bicycles: raised black bicycle, prohibition ring and exact wording.
y=-.86;post('sign_nobike',y,1.72);plate(y,.66,.96,1.27,'picketWhite')
for yy in (y-.145,y+.145):ring('bicycle wheel',(.069,yy,1.53),.083,.008,'uiDark')
for q1,q2 in [((y-.145,1.53),(y-.045,1.67)),((y-.045,1.67),(y+.035,1.53)),((y+.035,1.53),(y-.145,1.53)),((y+.035,1.53),(y+.105,1.69)),((y+.105,1.69),(y+.145,1.53)),((y-.045,1.67),(y+.10,1.67)),((y+.105,1.69),(y+.14,1.72)),((y-.075,1.70),(y-.018,1.70))]:rod('bicycle frame',(.074,*q1),(.074,*q2),.009,'uiDark',8)
ring('prohibition ring',(.086,y,1.60),.238,.017,'survivorRed')
rod('prohibition slash',(.099,y-.165,1.78),(.099,y+.165,1.42),.016,'survivorRed',10)
text('no bicycle wording','NO BICYCLES\nBEYOND THIS\nPOINT',(.071,y,1.06),.59,.32,'uiDark')
collider('nobike',(0,y,.89),(.15,.70,1.78))
# Hazard triangular extrusions, deliberately solid with outward normals.
y=0;post('sign_hazard',y,1.66)
shape=[(y-.39,.94),(y+.39,.94),(y,1.69)]
profile('triangular backing',0,.055,shape,'silver',.025)
profile('black triangle border',.036,.018,[(y-.374,.956),(y+.374,.956),(y,1.678)],'uiDark',.018)
profile('yellow warning face',.051,.014,[(y-.333,.978),(y+.333,.978),(y,1.621)],'schoolBusYellow',.013)
box('exclamation stem',(.065,y,1.33),(.013,.049,.235),'uiDark',.017)
sphere('exclamation dot',(.070,y,1.12),(.009,.036,.036),'uiDark')
collider('hazard',(0,y,.86),(.15,.83,1.72))
# Delivery instruction with a geometry arrow.
y=.88;post('sign_deliveries',y,1.64);plate(y,.75,.77,1.27,'picketWhite')
text('deliveries wording','DELIVERIES',(.067,y,1.49),.65,.16,'uiDark')
text('side door wording','SIDE DOOR',(.067,y,1.07),.65,.15,'uiDark')
profile('direction arrow',.074,.009,[(y-.23,1.26),(y+.07,1.26),(y+.07,1.19),(y+.25,1.31),(y+.07,1.43),(y+.07,1.36),(y-.23,1.36)],'uiDark')
collider('deliveries',(0,y,.83),(.13,.79,1.66))
# Security keypad, raised silver buttons on an inset dark panel.
y=1.77;post('keypad',y,1.64)
box('keypad casing',(0,y,1.26),(.23,.45,.79),'silver',.045)
box('keypad inner bezel',(.123,y,1.28),(.024,.344,.643),'uiDark',.025)
box('keypad inset panel',(.141,y,1.25),(.014,.292,.54),'denim',.013)
box('green display recess',(.148,y,1.48),(.013,.259,.113),'uiDark',.008)
box('green display',(.158,y,1.48),(.009,.211,.059),'foliageLight',.005)
# Legible tiny display status rather than a plain green square.
text('keypad READY','READY',(.165,y,1.48),.175,.038,'picketWhite')
for row in range(4):
 for col in range(3):
  yy=y+(col-1)*.077;zz=1.34-row*.073
  box('numeric key',(.166,yy,zz),(.025,.056,.052),'silver',.006)
  text('key digit',str(row*3+col+1) if row<3 else ['*','0','#'][col],(.181,yy,zz),.027,.030,'uiDark')
box('card-reader slot',(.157,y,1.00),(.015,.21,.017),'uiDark',.003)
for yy in (y-.175,y+.175):
 for zz in (.95,1.56):rod('casing fastener',(.126,yy,zz),(.142,yy,zz),.012,'uiDark',8)
collider('keypad',(0,y,.83),(.27,.47,1.66))
empty('front',(.35,0,1),root)
# Reference has short mounting stubs rather than waist-high roadside posts.
for o in parts:
 if not o.name.startswith(('galvanized post','post foot','post perforation')):o.location.z-=.5
for o in bpy.context.scene.objects:
 if o.name.startswith('col:'):
  o.location.z-=.25;o['size']=[o['size'][0],o['size'][1],o['size'][2]-.5]
# Centre the complete placement kit on X/Y, with its contacts still at z=0.
bpy.context.view_layer.update()
coordinates=[o.matrix_world@v.co for o in parts for v in o.data.vertices]
centre_x=(min(v.x for v in coordinates)+max(v.x for v in coordinates))/2
centre_y=(min(v.y for v in coordinates)+max(v.y for v in coordinates))/2
root.location=(-centre_x,-centre_y,0)
bpy.context.view_layer.update()
# Material merging stays within each semantic placement assembly.
for owner in [o for o in bpy.context.scene.objects if o.type=='EMPTY' and o.parent==root]:
 for material in M.values():
  obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==owner and o.data.materials[0]==material]
  if not obs:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in obs:o.select_set(True)
  bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=owner.name+'_'+material.name
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
def count():
 deps=bpy.context.evaluated_depsgraph_get();total=0
 for o in meshes:
  ev=o.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles();total+=len(me.loop_triangles);ev.to_mesh_clear()
 return total
bpy.context.view_layer.update()
points=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
lo=[min(q[i] for q in points) for i in range(3)];hi=[max(q[i] for q in points) for i in range(3)]
report={'id':ASSET['id'],'tier':'side','triangles':{'lod0':count()},'draw_calls':len(meshes),'materials':sorted(m.name for m in M.values()),'dimensions_blender':[hi[i]-lo[i] for i in range(3)],'bbox_blender':{'min':lo,'max':hi},'nodes':[o.name for o in bpy.context.scene.objects if o.type=='EMPTY'],'baked_ao':False,'backface_culling':True,'render_engine':'Eevee'}
asset=list(bpy.context.scene.objects)
if a.glb:
 ao.bake_all(meshes,samples=32);report['baked_ao']=True
 def export(path):
  bpy.ops.object.select_all(action='DESELECT')
  for o in asset:o.select_set(True)
  bpy.ops.export_scene.gltf(filepath=str(Path(path).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
 export(a.glb)
 for level,ratio in ((1,.12),(2,.03)):
  originals=[]
  for o in meshes:
   m=o.modifiers.new('LOD','DECIMATE');m.ratio=ratio;m.use_collapse_triangulate=True
   bpy.context.view_layer.update()
   original=o.data;reduced=bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
   o.modifiers.remove(m);o.data=reduced;originals.append((o,original,reduced))
   # Decimation can shift paper-thin plates outward; constrain to the original envelope.
   inverse=o.matrix_world.inverted()
   for v in reduced.vertices:
    world=o.matrix_world@v.co
    for axis in range(3):world[axis]=max(lo[axis],min(hi[axis],world[axis]))
    v.co=inverse@world
  bpy.context.view_layer.update();report['triangles']['lod'+str(level)]=count()
  export(Path(a.glb).with_name('model.lod'+str(level)+'.glb'))
  for o,original,reduced in originals:o.data=original;bpy.data.meshes.remove(reduced)
 (HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
if a.render:
 scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE'
 scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.10,.15,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.55
 target=Vector(((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2))
 span=max(hi[0]-lo[0],hi[1]-lo[1]);parent=root
 box('studio floor',(0,0,-.045),(200,200,.075),'uiDark',0)
 for pos,power,size,color in [((4,-5,8),850,6,(1,.81,.64)),((-3,3,7),650,5,(.68,.77,1)),((2,6,5),600,4,(1,.68,.41))]:
  bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
 offset={'ref':Vector((12,-1.5,4.5)),'game':Vector((9,-5,10)),'rear':Vector((-9,5,7))}[a.view]
 bpy.ops.object.camera_add(location=target+offset);cam=bpy.context.object;cam.rotation_euler=(-offset).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=span*1.26;scene.camera=cam
 scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
print('OK '+json.dumps(report))
