"""First-aid medkit pickup; metres, +X front, Z up. No textures.
Raised markings clear their support by >= 3 mm. Lid and handle pivots are joints.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
for k in ('render','glb'): p.add_argument('--'+k)
p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.world=bpy.data.worlds.new("Studio")

def material(token,h):
 m=bpy.data.materials.new('pal_'+token);m.use_nodes=True
 c=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
 m.diffuse_color=(*c,1);n=m.node_tree.nodes['Principled BSDF'];n.inputs['Base Color'].default_value=(*c,1);n.inputs['Roughness'].default_value=.48
 return m
white=material('picketWhite','f2e6dc');red=material('survivorRed','d9363e')
orange=material('woodWarm','b0703f');dark=material('uiDark','25222c');steel=material('sidewalk','b9a4a0')
def empty(name,loc=(0,0,0),parent=None):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.location=loc;o.parent=parent;return o
root=empty('root');root['asset_id']='pick.medkit'
root['ss_physics']={'class':'light','mass':2,'friction':.65,'restitution':.12,'centerOfMass':[0,.30,0],'pushable':True,'kickable':True,'flammable':False}
body=empty('body',parent=root);lid=empty('lid',(-.112,0,.108),root)
handle=empty('handle',(0,0,.60),root)
def finish(o,name,mat,parent=body,bevel=0):
 o.name=name;o.data.materials.append(mat)
 bpy.context.view_layer.objects.active=o
 if bevel:
  b=o.modifiers.new('rounded moulding','BEVEL');b.width=bevel;b.segments=3;bpy.ops.object.modifier_apply(modifier=b.name)
  n=o.modifiers.new('weighted normals','WEIGHTED_NORMAL');n.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=n.name)
 bpy.context.view_layer.update();o.parent=parent;o.matrix_parent_inverse=parent.matrix_world.inverted()
 for poly in o.data.polygons:poly.use_smooth=True
 return o

def box(name,loc,size,mat,bevel=.015,parent=body):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return finish(o,name,mat,parent,bevel)

def cylinder(name,loc,r,depth,mat,parent=body,axis='X',vertices=16):
 rot=(0,math.pi/2,0) if axis=='X' else ((math.pi/2,0,0) if axis=='Y' else (0,0,0))
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc,rotation=rot)
 return finish(bpy.context.object,name,mat,parent,.002)

# The broad face is +X; the red case is upright on its lower bumper.
box('rear shell',(-.047,0,.285),(.108,.70,.55),red,.053)
box('continuous dark closure gasket',(.010,0,.285),(.022,.703,.548),dark,.046)
box('front shell',(.063,0,.285),(.094,.70,.55),red,.048,lid)
# Raised rim and segmented guards define the moulded protective case.
for x,group in [(-.103,body),(.116,lid)]:
 for y in [-.305,.305]:
  for z in [.075,.285,.490]:
   box('segmented corner guard',(x,y,z),(.040,.105,.150),red,.024,group)
 for y in [-.23,.23]:
  for z in [.040,.530]:
   box('end corner wing',(x,y,z),(.029,.17,.080),red,.016,group)
 # Small moulded waist ribs remain clearly separate from the large emblem.
 for y in [-.225,.225]:box('waist rib',(x,y,.270),(.019,.17,.017),red,.006,group)
for y in [-.354,.354]:
 box('side bumper',(0,y,.285),(.064,.035,.32),dark,.019)
 for z in [.12,.43]:box('bumper end',(0,y,z),(.179,.042,.085),red,.015)
# Clasp straps wrap over the top of the front half.
for y in [-.222,.222]:
 box('top clasp',( .081,y,.552),(.10,.090,.029),red,.012,lid)
 box('clasp face',(.124,y,.504),(.035,.094,.106),red,.013,lid)
 box('hinge back',(-.110,y,.105),(.028,.097,.042),dark,.009)
 cylinder('hinge pin',(-.112,y,.108),.012,.105,steel,axis='Y')
box('handle plinth',(0,0,.567),(.13,.365,.028),red,.011)
for y in [-.132,.132]:
 box('handle foot',(0,y,.592),(.078,.076,.033),dark,.012)
 box('handle upright',(0,y,.635),(.065,.058,.124),dark,.023,handle)
 cylinder('handle joint',(.043,y,.600),.011,.007,steel)
box('orange carry grip',(0,0,.698),(.066,.264,.065),orange,.027,handle)
# A single extruded cross avoids overlapping coplanar centre faces.
outline=[(-.055,-.15),(.055,-.15),(.055,-.055),(.15,-.055),(.15,.055),(.055,.055),(.055,.15),(-.055,.15),(-.055,.055),(-.15,.055),(-.15,-.055),(-.055,-.055)]
verts=[(x,y*1.10,z*1.10+.285) for x in [.113,.132] for y,z in outline]
n=len(outline);faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
mesh=bpy.data.meshes.new('cross');mesh.from_pydata(verts,[],faces);mesh.update()
o=bpy.data.objects.new('raised medical cross',mesh);scene.collection.objects.link(o);finish(o,o.name,white,lid,.004)
# Static geometry is joined by material within each articulated assembly.
for group in [body,lid,handle]:
 for m in [white,red,orange,dark,steel]:
  obs=[o for o in list(scene.objects) if o.type=='MESH' and o.parent==group and o.data.materials[0]==m]
  if not obs:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in obs:o.select_set(True)
  bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=group.name+'_'+m.name

col=empty('col:body',(0,0,.365),root);col['collider']='cuboid';col['shape']='cuboid';col['size']=[.25,.75,.73]
scene.unit_settings.system='METRIC'
meshes=[o for o in scene.objects if o.type=='MESH']
# Clamped bevels can produce coincident vertices on thin guards.
for o in meshes:
 bm=bmesh.new();bm.from_mesh(o.data)
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
 bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.000001)
 bmesh.ops.triangulate(bm,faces=list(bm.faces))
 collapsed=[f for f in bm.faces if f.calc_area()<1e-12]
 if collapsed:bmesh.ops.delete(bm,geom=collapsed,context='FACES_ONLY')
 bm.to_mesh(o.data);bm.free();o.data.update()
# Deterministic 32-ray vertex ambient occlusion, baked in world space.
bpy.context.view_layer.update()
verts=[];faces=[]
for o in meshes:
 offset=len(verts);verts.extend(o.matrix_world @ v.co for v in o.data.vertices)
 faces.extend(tuple(offset+i for i in f.vertices) for f in o.data.polygons)
bvh=BVHTree.FromPolygons(verts,faces)
for o in meshes:
 colors=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='POINT')
 values=[];normal_matrix=o.matrix_world.to_3x3().inverted().transposed()
 for v in o.data.vertices:
  n=(normal_matrix @ v.normal).normalized();t=n.cross(Vector((0,0,1)) if abs(n.z)<.9 else Vector((0,1,0))).normalized();b=n.cross(t)
  origin=o.matrix_world @ v.co+n*.001;hits=0
  for j in range(32):
   z=(j+.5)/32;r=math.sqrt(1-z*z);angle=j*2.3999632297
   direction=t*(r*math.cos(angle))+b*(r*math.sin(angle))+n*z
   hits+=bvh.ray_cast(origin,direction,.10)[0] is not None
  value=1-.45*hits/32;values.extend((value,value,value,1))
 colors.data.foreach_set('color',values)
triangles=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
report={'id':'pick.medkit','tier':'Side','triangles':triangles,'draw_calls':sum(len(o.data.materials) for o in meshes),'materials':[m.name for m in [white,red,orange,dark,steel]],'nodes_ok':all(bpy.data.objects.get(n) is not None for n in ('root','body','lid','handle','col:body')),'within_budget':6000<=triangles<=12000 and len(meshes)<=30,'rounds':4,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'build-stats.json').write_text(json.dumps(report,indent=2))
if a.glb:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
if a.render:
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.008));ground=bpy.context.object
 gm=bpy.data.materials.new('stage');gm.use_nodes=True;gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.028,.024,.034,1);gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85;ground.data.materials.append(gm)
 scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.045,.038,.055,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
 def area(loc,power,color,size):
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.color=color;o.data.size=size;o.rotation_euler=(Vector((0,0,.4))-o.location).to_track_quat('-Z','Y').to_euler()
 area((2,-3,4),420,(1,.79,.59),3);area((-2,1,3),180,(.63,.69,1),3)
 bpy.ops.object.camera_add();cam=bpy.context.object;target=Vector((0,0,.35));az=math.radians(18);elev=math.radians(16)
 if a.view=='game':az=math.radians(45);elev=math.radians(54)
 elif a.view=='front':az=0
 elif a.view=='side':az=math.pi/2
 elif a.view=='rear':az=math.pi
 cam.location=target+Vector((math.cos(az)*math.cos(elev),-math.sin(az)*math.cos(elev),math.sin(elev)))*(3.45 if a.view=='game' else 2.5)
 cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.60 if a.view=='game' else 1.55;scene.camera=cam
 scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=a.render;bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
