"""Medical courier cooler; metres, +X front, Z up. No textures.
Raised markings clear their support by >= 3 mm. Lid and handle pivots are joints.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy
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
white=material('picketWhite','f2e6dc');orange=material('schoolBusYellow','f77922')
dark=material('uiDark','25222c');steel=material('sidewalk','b9a4a0');wear=material('woodWarm','b0703f')

def empty(name,loc=(0,0,0),parent=None):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.location=loc;o.parent=parent;return o
root=empty('root');root['asset_id']='prop.medical-cooler'
root['ss_physics']={'class':'light','mass':8,'friction':.65,'restitution':.12,'centerOfMass':[0,.30,0],'pushable':True,'kickable':True,'flammable':False}
body=empty('body',parent=root);lid=empty('lid',(-.227,0,.638),root)
handle=empty('handle',(0,0,.786),lid)
# Keep world placement while establishing local joint transforms.
handle.location=(.227,0,.148)
def finish(o,name,mat,parent=body,bevel=0):
 o.name=name;o.data.materials.append(mat)
 bpy.context.view_layer.objects.active=o
 if bevel:
  b=o.modifiers.new('rounded moulding','BEVEL');b.width=bevel;b.segments=2 if len(o.data.vertices)==8 else 1;bpy.ops.object.modifier_apply(modifier=b.name)
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
box('insulated shell',(0,0,.342),(.46,.76,.604),white,.058)
for y in [-.28,.28]:
 for x in [-.15,.15]:
  box('rubber foot',(x,y,.02),(.13,.14,.04),dark,.011)
  box('corner bumper',(x*1.20,y*1.17,.105),(.105,.118,.12),orange,.025)
  cylinder('bumper fastener',(x*1.20+.055,y*1.17,.115),.009,.006,wear)
box('lower orange seal',(0,0,.600),(.478,.778,.034),orange,.014)
box('dark lid gasket',(0,0,.624),(.470,.770,.010),dark,.004)
box('upper orange seal',(0,0,.641),(.478,.778,.032),orange,.014,lid)
box('rounded lid',(0,0,.694),(.462,.762,.112),white,.047,lid)
box('top orange inset',(0,0,.747),(.347,.635,.017),orange,.018,lid)
for y in [-.28,.28]:box('lid reinforcing rib',(0,y,.762),(.357,.042,.024),orange,.010,lid)
box('lid front name recess',(.234,0,.691),(.015,.28,.033),orange,.008,lid)
for y in [-.256,.256]:
 box('front latch bed',(.240,y,.611),(.048,.082,.160),dark,.014)
 box('latch recessed face',(.267,y,.582),(.012,.051,.078),wear,.005)
 box('latch lever',(.276,y,.589),(.016,.043,.069),dark,.006)
 box('latch upper clasp',(.264,y,.661),(.045,.079,.054),dark,.014,lid)
 cylinder('clasp pin',(.290,y,.665),.009,.007,steel,lid)
for y in [-.388,.388]:
 box('end latch',(0,y,.604),(.11,.035,.176),dark,.014)
 box('end latch recess',(0,y*1.05,.574),(.070,.007,.072),wear,.008)
 box('end latch panel',(0,y*1.064,.577),(.059,.009,.061),dark,.005)
 box('end inset surround',(0,y,.165),(.20,.025,.20),orange,.024)
 box('end inset shadow',(0,y*1.04,.177),(.149,.010,.108),wear,.011)
 box('end inset panel',(0,y*1.059,.172),(.127,.012,.082),orange,.009)
for y in [-.27,.27]:
 cylinder('lid hinge',(-.227,y,.638),.021,.092,dark,lid,'Y')
 box('handle mount',(0,y,.772),(.090,.074,.025),dark,.008,lid)
 box('handle upright',(0,y,.865),(.052,.054,.197),dark,.022,handle)
 cylinder('handle pivot',(.030,y,.786),.013,.009,steel,lid)
box('handle top frame',(0,0,.961),(.054,.594,.061),dark,.026,handle)
box('orange carry grip',(0,0,.965),(.062,.454,.065),orange,.029,handle)
for y in [-.233,.233]:box('grip collar',(0,y,.963),(.067,.012,.065),dark,.005,handle)
# Raised warning plate and real mesh biohazard glyph (three paired circular lobes).
box('biohazard plate',(.235,0,.332),(.018,.322,.313),orange,.016)
for y in [-.143,.143]:
 for z in [.193,.470]:cylinder('plate rivet',(.249,y,z),.0045,.005,steel)
# Boolean crescents in the YZ plane, union visually with central triangular spokes.
for i in range(3):
 t=math.radians(90+i*120);cy=.052*math.cos(t);cz=.333+.052*math.sin(t)
 ob=cylinder('biohazard lobe',(.253,cy,cz),.077,.008,dark,vertices=64)
 bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=.062,depth=.05,location=(.253,cy+.034*math.cos(t),cz+.034*math.sin(t)),rotation=(0,math.pi/2,0))
 cut=bpy.context.object;bpy.context.view_layer.objects.active=ob
 mod=ob.modifiers.new('open crescent','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cut;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
# Inner ring, separated from the plate by 6 mm.
bpy.ops.mesh.primitive_torus_add(major_segments=64,minor_segments=8,location=(.254,0,.333),rotation=(0,math.pi/2,0),major_radius=.047,minor_radius=.005)
finish(bpy.context.object,'hazard inner ring',dark)
cylinder('hazard center',(.259,0,.333),.018,.006,orange)
# Restrained moulded scuffs: solid geometry, no floating coplanar paint.
for y,z,s in [(-.33,.28,.016),(.34,.40,.012),(-.18,.12,.010),(.20,.49,.012),(.32,.18,.014)]:
 ob=box('case scuff',(.233,y,z),(.007,s,s*.42),wear,.001);ob.rotation_euler.x=.55
# Static surfaces joined by material within each articulated assembly.
for group in [body,lid,handle]:
 for m in [white,orange,dark,steel,wear]:
  obs=[o for o in list(scene.objects) if o.type=='MESH' and o.parent==group and o.data.materials[0]==m]
  if not obs:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in obs:o.select_set(True)
  bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=group.name+'_'+m.name

col=empty('col:body',(0,0,.395),root);col['collider']='cuboid';col['shape']='cuboid';col['size']=[.48,.78,.79]
scene.unit_settings.system='METRIC'
meshes=[o for o in scene.objects if o.type=='MESH']
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
report={'id':'prop.medical-cooler','tier':'Side','triangles':triangles,'draw_calls':sum(len(o.data.materials) for o in meshes),'materials':[m.name for m in [white,orange,dark,steel,wear]],'nodes_ok':all(bpy.data.objects.get(n) is not None for n in ('root','body','lid','handle','col:body')),'within_budget':6000<=triangles<=12000 and len(meshes)<=30,'rounds':4,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'build-stats.json').write_text(json.dumps(report,indent=2))
if a.glb:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
if a.render:
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.008));ground=bpy.context.object
 gm=bpy.data.materials.new('stage');gm.use_nodes=True;gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.028,.024,.034,1);gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85;ground.data.materials.append(gm)
 scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.045,.038,.055,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
 def area(loc,power,color,size):
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.color=color;o.data.size=size;o.rotation_euler=(Vector((0,0,.4))-o.location).to_track_quat('-Z','Y').to_euler()
 area((2,-3,4),180,(1,.79,.59),3);area((-2,1,3),120,(.63,.69,1),3)
 bpy.ops.object.camera_add();cam=bpy.context.object;target=Vector((0,0,.47));az=math.radians(40);elev=math.radians(27)
 if a.view=='game':az=math.radians(45);elev=math.radians(54)
 elif a.view=='front':az=0
 elif a.view=='side':az=math.pi/2
 elif a.view=='rear':az=math.pi
 cam.location=target+Vector((math.cos(az)*math.cos(elev),-math.sin(az)*math.cos(elev),math.sin(elev)))*(3.45 if a.view=='game' else 2.5)
 cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.03 if a.view=='game' else 2.08;scene.camera=cam
 scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.filepath=a.render;bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
