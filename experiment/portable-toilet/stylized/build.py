# Identity: blue upright cubicle; cream barrel roof; arched front door;
# oversized restroom pictogram; chunky dark handle; broad molded side panels.
# Simplified parts: three shell walls, corner uprights, single door with icon/handle,
# faceted barrel cap, two side panel masses, broad plinth and four feet.
# Dropped: bolts, hinges, tiny latch indicator, fine roof ribs, panel seams, lettering.
import bpy, math, sys, json
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def arg(k,d=None): return args[args.index(k)+1] if k in args else d
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
def mat(token,h):
 m=bpy.data.materials.new('pal_'+token);m.use_nodes=True
 c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
 c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
 m.diffuse_color=c;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=c;p.inputs['Roughness'].default_value=.78;p.inputs['Metallic'].default_value=0
 return m
blue=mat('policeBlue','2f6bff');cream=mat('picketWhite','f2e6dc');dark=mat('uiDark','25222c');base=mat('sidewalk','b9a4a0')
asset=[];doorparts=[]
def finish(o,name,m,bev=0,door=False):
 o.name=name;o.data.materials.append(m)
 if bev:
  mod=o.modifiers.new('Soft toy edges','BEVEL');mod.width=bev;mod.segments=1
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
  mod=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');mod.keep_sharp=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 asset.append(o)
 if door:doorparts.append(o)
 return o
def box(name,loc,size,m,bev=.03,door=False):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 return finish(o,name,m,bev,door)
def extrude(name,poly,x0,x1,m,bev=0,door=False):
 n=len(poly);verts=[(x,y,z) for x in (x0,x1) for y,z in poly]
 faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);scene.collection.objects.link(o)
 return finish(o,name,m,bev,door)
# Width/depth exaggerated for a stable toy silhouette, 2.3m high.
box('back_wall',(-.54,0,1.16),(.13,1.10,1.91),blue,.065)
for y in [-.50,.50]:
 box('side_wall',(0,y,1.16),(1.1,.13,1.91),blue,.06)
 for x in [-.52,.52]:box('corner_post',(x,y,1.17),(.15,.15,1.96),blue,.045)
# Dark reveal makes the door legible at distance.
box('door_reveal',(.565,0,1.14),(.08,.96,1.87),dark,.065)
poly=[(-.445,.24),(.445,.24),(.445,1.83),(.38,1.98),(.22,2.06),(-.22,2.06),(-.38,1.98),(-.445,1.83)]
extrude('door_front',poly,.59,.68,blue,.045,True)
# Roof is a chunky 8-facet barrel, not a realistic thin plastic sheet.
roof=[(-.66,2.075),(.66,2.075)]+[(.66*math.cos(i*math.pi/8),2.075+.31*math.sin(i*math.pi/8)) for i in range(9)]
# remove duplicate start at +width
roof=roof[:2]+roof[3:]
extrude('barrel_roof',roof,-.68,.70,cream,.035)
box('roof_front_lip',(.69,0,2.09),(.13,1.33,.14),cream,.04)
box('roof_rear_lip',(-.65,0,2.09),(.12,1.33,.14),cream,.04)
for y in [-.59,.59]:
 for z,h in [(.66,.66),(1.50,.62)]:box('broad_side_molding',(0,y,z),(.77,.09,h),blue,.035)
box('raised_base',(0,0,.16),(1.35,1.30,.19),base,.045)
for x in [-.48,.48]:
 for y in [-.46,.46]:box('base_foot',(x,y,.06),(.35,.35,.12),base,.025)
box('restroom_sign',(.746,-.035,1.57),(.085,.64,.58),cream,.035,True)
# Two bold human silhouettes, each >10cm wide; no lettering or tiny symbols.
for y in [-.20,.13]:
 bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=1,location=(.80,y,1.74));o=bpy.context.object;o.scale=(.026,.062,.066);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,'symbol_head',dark,0,True)
 if y<0: extrude('symbol_dress',[(y-.085,1.51),(y+.085,1.51),(y+.05,1.685),(y-.05,1.685)],.788,.818,dark,0,True)
 else: box('symbol_body',(.803,y,1.60),(.03,.13,.17),dark,.012,True)
 for dy in [-.042,.042]:box('symbol_leg',(.803,y+dy,1.455),(.03,.05,.14),dark,.01,True)
box('handle_backplate',(.741,-.31,.99),(.06,.14,.27),dark,.025,True)
box('chunky_handle',(.807,-.31,.99),(.10,.075,.21),base,.018,True)
# Merge static geometry by palette material, retaining door as an animatable unit.
bpy.ops.object.select_all(action='DESELECT')
for o in doorparts:o.select_set(True)
bpy.context.view_layer.objects.active=doorparts[0];bpy.ops.object.join();door=bpy.context.object;door.name='door_front'
scene.cursor.location=(.59,.445,.24);bpy.ops.object.origin_set(type='ORIGIN_CURSOR');scene.cursor.location=(0,0,0)
statics=[o for o in scene.objects if o.type=='MESH' and o!=door]
for m in [blue,cream,dark,base]:
 group=[o for o in scene.objects if o.type=='MESH' and o!=door and o.data.materials[0]==m]
 if not group:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in group:o.select_set(True)
 bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();bpy.context.object.name='static_'+m.name
models=[o for o in scene.objects if o.type=='MESH']
root=bpy.data.objects.new('root',None);scene.collection.objects.link(root)
for o in models:o.parent=root
tri=sum(len(p.vertices)-2 for o in models for p in o.data.polygons)
print('OK triangles',tri,'meshes',len(models))
if arg('--glb'):
 bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
 for o in models:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=arg('--glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
# Studio is excluded from the exported GLB.
box('studio_ground',(0,0,-.10),(200,200,.18),mat('studio','807581'),0)
scene.world=bpy.data.worlds.new('Studio World');scene.world.color=(.22,.22,.22)
world=scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.30,.34,.47,1);world.node_tree.nodes['Background'].inputs[1].default_value=.65
for name,loc,power,color,size in [('sunsoft',(3,-4,7),650,(1,.80,.61),5),('fill',(-3,-1,4),450,(.58,.70,1),5)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.lens_unit='FOV';cam.data.angle=math.radians(25)
target=Vector((0,0,1.16));view=arg('--view','ref');elev=math.radians(36 if view=='game' else 22);az=math.radians(45 if view=='game' else 35);distance=17 if view=='game' else 12.8
cam.location=target+distance*Vector((math.cos(elev)*math.cos(az),-math.cos(elev)*math.sin(az),math.sin(elev)));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=int(arg('--samples','16'))
scene.render.resolution_x=int(arg('--width','960'));scene.render.resolution_y=int(arg('--height','540'));scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
if arg('--blend'):bpy.ops.wm.save_as_mainfile(filepath=arg('--blend'))
if arg('--render'):scene.render.filepath=arg('--render');bpy.ops.render.render(write_still=True)
