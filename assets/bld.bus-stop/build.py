"""Sunset Grove shelter. Metres, Z-up, open entrance +X.
Procedural palette geometry only; poster layers have >= 3 mm clearance.
Static parts merge by material, roof remains separately hideable.
"""
import bpy, bmesh, math, argparse, sys
from pathlib import Path
from mathutils import Matrix
from mathutils import Vector
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.lod import simplify as simplify_lod

p=argparse.ArgumentParser(); p.add_argument('--render'); p.add_argument('--view',default='ref'); p.add_argument('--samples',type=int,default=16); p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540); p.add_argument('--glb'); p.add_argument('--blend'); a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
colors={'asphalt':'5b4f5c','uiDark':'25222c','woodWarm':'b0703f','picketWhite':'f2e6dc','backpackTeal':'2f6e6a','schoolBusYellow':'f2b630','survivorRed':'d9363e','sidewalk':'b9a4a0'}
M={}
for n,h in colors.items():
 m=bpy.data.materials.new('pal_'+n); m.diffuse_color=tuple(((int(h[i:i+2],16)/255+.055)/1.055)**2.4 if int(h[i:i+2],16)/255>.04045 else int(h[i:i+2],16)/255/12.92 for i in (0,2,4))+(1,); m.use_nodes=True; b=m.node_tree.nodes.get('Principled BSDF'); b.inputs['Base Color'].default_value=m.diffuse_color; b.inputs['Roughness'].default_value=.78; b.inputs['Metallic'].default_value=0; M[n]=m
parts=[]
font_path=Path('/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf')
font=bpy.data.fonts.load(str(font_path)) if font_path.exists() else bpy.data.fonts.get('Bfont')
def box(n,loc,size,mat,bev=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=n; o.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(M[mat]); parts.append(o)
 if bev:
  mod=o.modifiers.new('soft toy edges','BEVEL'); mod.width=bev; mod.segments=2 if bev>=.025 else 1; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
def mesh(n,verts,faces,mat):
 d=bpy.data.meshes.new(n); d.from_pydata(verts,[],faces); d.update(); bm=bmesh.new(); bm.from_mesh(d); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(d); bm.free(); o=bpy.data.objects.new(n,d); bpy.context.collection.objects.link(o); o.data.materials.append(M[mat]); parts.append(o); return o
# Roof rises from z=2.25 at its lips to z=2.65 at its crown.
def arch(n,x0,x1,mat,thick=.12,lift=0):
 vs=[]
 for x in (x0,x1):
  for lower in (False,True):
   for i in range(25):
    y=-.92+1.84*i/24; z=2.25+.40*math.sin(math.pi*i/24)+lift-(thick if lower else 0); vs.append((x,y,z))
 fs=[]
 for i in range(24):
  fs.extend([(i,i+1,51+i,50+i),(25+i,75+i,76+i,26+i),
             (i,25+i,26+i,i+1),(50+i,51+i,76+i,75+i)])
 fs.extend([(0,50,75,25),(24,49,99,74)])
 return mesh(n,vs,fs,mat)
arch('canopy',-1.95,1.95,'asphalt')
# Solid semicircular end panels tucked beneath the roof skin.
for end in (-1.90,1.90):
 verts=[]
 for x in (end-.025,end+.025):
  for i in range(25):
   y=-.86+1.72*i/24
   verts.append((x,y,2.23+.34*math.sin(math.pi*i/24)))
 faces=[tuple(range(24,-1,-1)),tuple(range(25,50))]
 faces.extend((i,i+1,i+26,i+25) for i in range(24))
 faces.append((24,0,25,49))
 mesh('canopy_endcap',verts,faces,'woodWarm')
for x in (-1.9,-.63,.63,1.9): arch('bold_arch_band',x-.055,x+.055,'woodWarm',.17,.025)
for y in (-.9,.9): box('canopy_lip',(0,y,2.20),(4.04,.16,.20),'asphalt',.035)
for x in (-1.78,1.78):
 for y in (-.76,.76):
  box('post',(x,y,1.12),(.19,.19,2.24),'asphalt',.025)
  box('foot',(x,y,.065),(.34,.34,.13),'asphalt',.025)
for z in (.30,1.90): box('rear_rail',(0,.76,z),(3.58,.13,.14),'uiDark',.015)
# Bench comfortably inset, with generous gaps rather than tiny subdivisions.
for y in (-.30,-.08,.14): box('seat_slat',(0,y,.57),(2.62,.20,.13),'woodWarm',.035)
for z in (.85,1.10,1.35):
 o=box('back_slat',(0,.30,z),(2.62,.14,.20),'woodWarm',.03); o.rotation_euler.x=math.radians(-8)
# Bench A-frame supports with an open arch beneath the seat.
for x in (-1.00,1.00):
 for y in (-.29,.30):
  o=box('splayed_leg',(x,y,.28),(.13,.15,.49),'uiDark',.025)
  o.rotation_euler.x=math.radians(18 if y<0 else -18)
  box('bench_foot',(x,y,.035),(.25,.23,.07),'woodWarm',.015)
 box('bench_crosspiece',(x,0,.48),(.16,.76,.13),'uiDark',.02)
 box('bench_back_support',(x,.34,.90),(.14,.15,.98),'uiDark',.015)
box('bench_underrail',(0,.07,.44),(2.25,.14,.13),'uiDark',.02)
# Solid end boards remain opaque and readable; no glass or textures.
for x in (-1.78,1.78):
 box('poster_frame',(x,0,1.20),(.16,1.32,1.66),'woodWarm',.035)
 box('poster_board',(x,0,1.20),(.18,1.14,1.48),'asphalt' if x<0 else 'picketWhite',.015)
def text(label, x, y, z, size, material, side=1):
 bpy.ops.object.text_add(location=(x,y,z))
 o=bpy.context.object; o.name='lettering_'+label
 o.data.font=font; o.data.body=label; o.data.align_x='CENTER'; o.data.align_y='CENTER'
 o.data.size=size; o.data.extrude=0; o.data.resolution_u=1
 # Text local X is horizontal across the end panel; local Y points up.
 o.rotation_euler=Matrix(((0,0,side),(side,0,0),(0,1,0))).to_euler()
 o.data.materials.append(M[material]); bpy.ops.object.convert(target='MESH'); parts.append(o)

def bolt(loc, axis='X', radius=.024):
 rot=(0,math.pi/2,0) if axis=='X' else ((math.pi/2,0,0) if axis=='Y' else (0,0,0))
 bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=radius,location=loc)
 o=bpy.context.object; o.name='fastener'; o.scale=(.45,1,1) if axis=='X' else ((1,.45,1) if axis=='Y' else (1,1,.45)); o.data.materials.append(M['uiDark']); parts.append(o)

for side in (-1,1):
 x=-1.78+side*.104
 for label,z,size in [('STILL',1.73,.40),('HERE',1.41,.40),('TOGETHER',1.10,.27)]:
  text(label,x,0,z,size,'schoolBusYellow',side)
 box('house_body',(x,0,.67),(.012,.36,.30),'schoolBusYellow')
 mesh('house_gable',[(x+side*.010,-.27,.78),(x+side*.010,.27,.78),(x+side*.010,0,1.00)],[(0,1,2) if side>0 else (2,1,0)],'schoolBusYellow')
 box('house_window',(x+side*.018,0,.69),(.012,.11,.11),'asphalt')
 box('chimney',(x,.14,.88),(.012,.07,.21),'schoolBusYellow')
 # Map: inset paper, coloured neighbourhood blocks, raised road network.
 x=1.78+side*.104
 for row in range(4):
  for col in range(3):
   y=-.37+col*.36; z=.67+row*.26
   box('map_district',(x,y,z),(.014,.27,.18),['asphalt','woodWarm','backpackTeal','schoolBusYellow'][(row+col)%4],.008)
 for z in (.79,1.31): box('map_street',(x+side*.024,0,z),(.012,1.04,.035),'schoolBusYellow',.005)
 for y in (-.18,.18): box('map_street',(x+side*.044,y,1.17),(.012,.035,1.04),'schoolBusYellow',.005)
 for y,z in [(-.37,.79),(-.18,1.31),(.18,1.05),(.37,1.31)]:
  bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.047,depth=.014,location=(x+side*.063,y,z),rotation=(0,math.pi/2,0))
  o=bpy.context.object; o.name='map_stop'; o.data.materials.append(M['survivorRed']); parts.append(o)
 text('SUNSET GROVE',x+side*.022,0,1.81,.104,'survivorRed',side)
 text('TRANSIT MAP',x+side*.022,0,.52,.081,'asphalt',side)
 for end in (-1.78,1.78):
  for y in (-.59,.59):
   for z in (.45,1.94): bolt((end+side*.096,y,z))
# Framing caps, foot plates and visible fasteners.
for x in (-1.78,1.78):
 for y in (-.76,.76):
  box('post_plinth',(x,y,.14),(.27,.27,.17),'asphalt',.022)
  box('foot_plate',(x,y,.024),(.39,.39,.048),'woodWarm',.012)
  for dx in (-.14,.14): bolt((x+dx,y,.052),'Z',.021)
 for z in (.40,2.00): box('poster_edge',(x,0,z),(.23,1.38,.095),'uiDark',.014)
for x in (-1.9,-.63,.63,1.9):
 for y in (-.985,.985):
  box('roof_splice',(x,y,2.20),(.19,.035,.19),'asphalt',.009)
  bolt((x,y+(.024 if y>0 else -.024),2.20),'Y',.026)
for x in (-1.02,1.02):
 for z in (.85,1.10,1.35): bolt((x,.215,z),'Y',.024)
 for y in (-.30,-.08,.14): bolt((x,y,.644),'Z',.022)
# Sparse, proud paint wear: large readable chips rather than texture noise.
for x,y,z in [(-1.78,-.861,.42),(1.78,-.861,1.75),(-.72,-.994,2.17),(.81,-.994,2.24)]:
 box('paint_chip',(x,y,z),(.12,.009,.024),'woodWarm',.004)
# Broad chipped paint shapes follow the canopy, 12 mm above its skin.
for x,y in [(-1.50,-.47),(-1.06,.20),(-.31,-.22),(.25,.34),(.91,-.37),(1.48,.27)]:
 verts=[]
 for dx,dy in [(-.20,-.022),(-.14,.020),(-.035,.026),(.0,.060),(.15,.018),(.23,-.035),(.05,-.016),(-.08,-.045)]:
  yy=y+dy; verts.append((x+dx,yy,2.262+.4*math.sin(math.pi*(yy+.92)/1.84)))
 mesh('canopy_weathering',verts,[tuple(range(8))],'woodWarm')
# Raised wood grain scars remain readable without texture maps.
for z in (.85,1.10,1.35):
 for x in (-.67,.28,.71):
  box('wood_scar',(x,.220,z-.036),(.20,.009,.012),'asphalt',.003)
# Name roof geometry before merging so it remains independently hideable.
roof_parts=[o for o in parts if any(k in o.name for k in ('canopy','arch_band','roof_splice')) or o.location.z>2.1]
# Merge by material, one draw per palette colour.
for group_name, subset in [('roof',roof_parts),('static',[o for o in parts if o not in roof_parts])]:
 groups=[[o for o in subset if o.data.materials[0]==mat] for mat in M.values()]
 for objs in groups:
  if not objs: continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in objs:o.select_set(True)
  bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join(); objs[0].name=group_name+'_'+objs[0].data.materials[0].name
  # Model authoring uses width X; rotate to the production +X entrance.
  objs[0].matrix_world=Matrix.Rotation(math.pi/2,4,'Z')@Matrix.Diagonal((1.23,1,1,1))@objs[0].matrix_world
  bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
roof=bpy.data.objects.new('roof',None); bpy.context.collection.objects.link(roof)
root=bpy.data.objects.new('root',None); bpy.context.collection.objects.link(root)
for o in list(bpy.context.scene.objects):
 if o.type=='MESH': o.parent=roof if o.name.startswith('roof_') else root
roof.parent=root
root['asset_id']='bld.bus-stop'
root['front']='+X'
interior=bpy.data.objects.new('interior',None); bpy.context.collection.objects.link(interior); interior.parent=root
asset=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in asset: o.data.calc_loop_triangles()
tris=sum(len(o.data.loop_triangles) for o in asset)
assert 6000 <= tris <= 12000, f'Side triangle budget exceeded: {tris}'
assert len(asset) <= 30, 'Side draw-call budget exceeded'
print('OK asset triangles',tris,'meshes',len(asset))
if a.glb:
 # Deterministic vertex AO, available to the game's palette shader.
 scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.seed=17
 scene.render.bake.target='VERTEX_COLORS'
 bpy.ops.object.select_all(action='DESELECT')
 for o in asset:
  layer=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
  o.data.color_attributes.active_color=layer
  o.select_set(True)
 bpy.context.view_layer.objects.active=asset[0]
 bpy.ops.object.bake(type='AO')
 bpy.ops.object.select_all(action='DESELECT'); root.select_set(True); roof.select_set(True); interior.select_set(True)
 for o in asset:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
 originals={o:o.data for o in asset}
 for level,ratio in [(1,.55),(2,.25)]:
  for o,data in originals.items():
   o.data=data.copy()
   # Closed canopy volume survives reduction; the boundary guard rejects tears.
   simplify_lod(o,ratio)
  bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).with_name('model.lod%d.glb'%level)),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
  for o,data in originals.items():
   reduced=o.data;o.data=data;bpy.data.meshes.remove(reduced)

# Presentation stage is excluded from GLB.
scene=bpy.context.scene
box('stage',(0,0,-.10),(200,200,.2),'sidewalk')
world=bpy.data.worlds.new('warm studio'); world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.27,.40,1); world.node_tree.nodes['Background'].inputs[1].default_value=.5; scene.world=world
for name,loc,energy,size,col in [('key',(-3,-4,7),950,5,(1,.78,.56)),('fill',(4,-1,5),650,4,(.71,.79,1))]:
 bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.name=name; o.data.energy=energy; o.data.shape='DISK'; o.data.size=size; o.data.color=col; o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(); cam=bpy.context.object; scene.camera=cam
if a.view=='game':
 target=Vector((0,0,1.15)); d=22; el=math.radians(36); cam.location=target+Vector((d*math.cos(el)/math.sqrt(2),d*math.cos(el)/math.sqrt(2),d*math.sin(el)))
else: target=Vector((0,0,1.25)); cam.location=(8.3,6.2,4.4)
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
