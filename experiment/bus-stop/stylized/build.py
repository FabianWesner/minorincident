# Identity features: barrel-arched canopy; chunky four-post frame; warm slatted
# bench; framed house poster; bold route-map poster; open waiting area.
# Simplified parts: 8-facet solid canopy, three arch bands, four posts and feet,
# two end poster panels, rear rails, five bench slats and two broad supports.
# Dropped: weathering, screws, hinges, fine lettering, thin ribs and map labels.
import bpy, bmesh, math, argparse, sys, json
from mathutils import Vector
p=argparse.ArgumentParser(); p.add_argument('--render'); p.add_argument('--view',default='ref'); p.add_argument('--samples',type=int,default=16); p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540); p.add_argument('--glb'); p.add_argument('--blend'); a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
colors={'asphalt':'5b4f5c','uiDark':'25222c','woodWarm':'b0703f','picketWhite':'f2e6dc','backpackTeal':'2f6e6a','schoolBusYellow':'f2b630','survivorRed':'d9363e','sidewalk':'b9a4a0'}
M={}
for n,h in colors.items():
 m=bpy.data.materials.new('pal_'+n); m.diffuse_color=tuple(((int(h[i:i+2],16)/255+.055)/1.055)**2.4 if int(h[i:i+2],16)/255>.04045 else int(h[i:i+2],16)/255/12.92 for i in (0,2,4))+(1,); m.use_nodes=True; b=m.node_tree.nodes.get('Principled BSDF'); b.inputs['Base Color'].default_value=m.diffuse_color; b.inputs['Roughness'].default_value=.78; b.inputs['Metallic'].default_value=0; M[n]=m
parts=[]
def box(n,loc,size,mat,bev=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=n; o.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(M[mat]); parts.append(o)
 if bev:
  mod=o.modifiers.new('soft toy edges','BEVEL'); mod.width=bev; mod.segments=1; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def mesh(n,verts,faces,mat):
 d=bpy.data.meshes.new(n); d.from_pydata(verts,[],faces); d.update(); bm=bmesh.new(); bm.from_mesh(d); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(d); bm.free(); o=bpy.data.objects.new(n,d); bpy.context.collection.objects.link(o); o.data.materials.append(M[mat]); parts.append(o); return o
# Roof rises from z=2.25 at its lips to z=2.65 at its crown.
def arch(n,x0,x1,mat,thick=.12,lift=0):
 vs=[]
 for x in (x0,x1):
  for lower in (False,True):
   for i in range(9):
    y=-.92+1.84*i/8; z=2.25+.40*math.sin(math.pi*i/8)+lift-(thick if lower else 0); vs.append((x,y,z))
 fs=[]
 for i in range(8):
  fs.extend([(i,i+1,19+i,18+i),(9+i,27+i,28+i,10+i),(i,9+i,10+i,i+1),(18+i,19+i,28+i,27+i)])
 fs.extend([(0,18,27,9),(8,17,35,26)]); return mesh(n,vs,fs,mat)
arch('canopy',-1.95,1.95,'asphalt')
for x in (-1.9,0,1.9): arch('bold_arch_band',x-.055,x+.055,'woodWarm',.17,.025)
for y in (-.9,.9): box('canopy_lip',(0,y,2.20),(4.04,.16,.20),'asphalt',.035)
for x in (-1.78,1.78):
 for y in (-.76,.76):
  box('post',(x,y,1.12),(.19,.19,2.24),'uiDark',.025)
  box('foot',(x,y,.065),(.34,.34,.13),'asphalt',.025)
for z in (.30,1.90): box('rear_rail',(0,.76,z),(3.58,.13,.14),'uiDark',.015)
# Bench comfortably inset, with generous gaps rather than tiny subdivisions.
for y in (-.26,.02): box('seat_slat',(0,y,.57),(2.62,.25,.15),'woodWarm',.035)
for z in (.85,1.10,1.35):
 o=box('back_slat',(0,.30,z),(2.62,.14,.20),'woodWarm',.03); o.rotation_euler.x=math.radians(-8)
for x in (-1.00,1.00):
 box('bench_leg',(x,-.02,.26),(.21,.54,.52),'uiDark',.035)
 box('bench_back_support',(x,.34,.90),(.14,.15,.98),'uiDark',.015)
# Solid end boards remain opaque and readable; no glass or textures.
for x in (-1.78,1.78):
 box('poster_frame',(x,0,1.20),(.16,1.32,1.66),'woodWarm',.035)
 box('poster_board',(x,0,1.20),(.18,1.14,1.48),'backpackTeal' if x<0 else 'picketWhite',.015)
# Posters have chunky geometry on both faces, so all study angles remain useful.
for side in (-1,1):
 x=-1.78+side*.103
 box('house_body',(x,0,1.03),(.026,.50,.45),'schoolBusYellow')
 verts=[(x+side*.016,-.35,1.23),(x+side*.016,.35,1.23),(x+side*.016,0,1.60)]
 mesh('house_roof',verts,[(0,1,2) if side>0 else (2,1,0)],'schoolBusYellow')
 box('house_door',(x+side*.019,0,.94),(.028,.15,.26),'backpackTeal')
 box('poster_heading',(x,0,1.78),(.028,.76,.14),'picketWhite',.015)
 # Route poster: three large blocks, two wide crossing routes and three stations.
 x=1.78+side*.103
 for y,z,sy,sz in [(-.30,1.61,.35,.42),(.30,1.59,.34,.47),(-.27,.82,.38,.45),(.31,.89,.30,.30)]: box('map_district',(x,y,z),(.027,sy,sz),'backpackTeal')
 for y,z,sy,sz in [(0,1.20,1.02,.13),(.04,1.23,.13,1.18)]: box('map_route',(x+side*(.024 if sy>sz else .04),y,z),(.03,sy,sz),'schoolBusYellow',.015)
 for y,z in [(-.36,1.2),(.04,1.53),(.32,1.2)]:
  bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.09,depth=.035,location=(x+side*.05,y,z),rotation=(0,math.pi/2,0)); o=bpy.context.object; o.name='map_station'; o.data.materials.append(M['survivorRed']); parts.append(o)
# Merge by material, one draw per palette colour.
groups={mat.name:[o for o in parts if o.data.materials[0]==mat] for mat in M.values()}
for mat in M.values():
 objs=groups[mat.name]
 if not objs: continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.select_set(True)
 bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join(); objs[0].name='static_'+mat.name
root=bpy.data.objects.new('root',None); bpy.context.collection.objects.link(root)
for o in list(bpy.context.scene.objects):
 if o.type=='MESH': o.parent=root
asset=[o for o in bpy.context.scene.objects if o.type=='MESH']; tris=sum(len(o.data.polygons) for o in asset)
for o in asset: o.data.calc_loop_triangles()
tris=sum(len(o.data.loop_triangles) for o in asset)
print('OK asset triangles',tris,'meshes',len(asset))
if a.glb:
 bpy.ops.object.select_all(action='DESELECT'); root.select_set(True)
 for o in asset:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
# Presentation stage is excluded from GLB.
scene=bpy.context.scene
box('stage',(0,0,-.10),(200,200,.2),'sidewalk')
world=bpy.data.worlds.new('warm studio'); world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.27,.40,1); world.node_tree.nodes['Background'].inputs[1].default_value=.5; scene.world=world
for name,loc,energy,size,col in [('key',(-3,-4,7),950,5,(1,.78,.56)),('fill',(4,-1,5),650,4,(.71,.79,1))]:
 bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.name=name; o.data.energy=energy; o.data.shape='DISK'; o.data.size=size; o.data.color=col; o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(); cam=bpy.context.object; scene.camera=cam
if a.view=='game':
 target=Vector((0,0,1.15)); d=36; el=math.radians(36); cam.location=target+Vector((d*math.cos(el)/math.sqrt(2),-d*math.cos(el)/math.sqrt(2),d*math.sin(el)))
else: target=Vector((0,0,1.25)); cam.location=(6.0,-8.0,5.1)
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='PERSP'; cam.data.lens=81 if a.view=='game' else 48
scene.render.engine='CYCLES'; scene.cycles.samples=a.samples; scene.cycles.use_denoising=True
try:
 prefs=bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type='METAL'; prefs.get_devices()
 for dev in prefs.devices: dev.use=True
 scene.cycles.device='GPU'
except: pass
scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100; scene.view_settings.view_transform='AgX'
if a.blend:bpy.ops.wm.save_as_mainfile(filepath=a.blend)
if a.render:scene.render.filepath=a.render; bpy.ops.render.render(write_still=True)
