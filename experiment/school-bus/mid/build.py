# Round 3: derived from round 2, richer only at medium scale.
# Identity: yellow rounded bus body; short chunky hood; repeated dark windows;
# two bold black stripes; oversized wheels; red octagonal stop paddle.
# Simplified parts: body/roof/hood, windows, stripes, grille/bumper,
# four wheels with plain hubs, paired warning lamps, headlights, stop paddle.
# Simplified additions: framed glazing, folding door, hollow flared arches,
# sculpted hood, three-part wheels, mirrors, extruded lettering, segmented lamps.
# Dropped: bolts, hinges, wipers, tread blocks, lug nuts, tiny lettering, fine trim.
import bpy, math, sys, argparse, json
from mathutils import Vector
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--render');p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=16);p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540);p.add_argument('--glb');p.add_argument('--blend');a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
M={}
def mat(t,h,em=False):
 m=bpy.data.materials.new(('emi_' if em else 'pal_')+t);m.diffuse_color=(*tuple(((int(h[i:i+2],16)/255+.055)/1.055)**2.4 if int(h[i:i+2],16)/255>.04045 else int(h[i:i+2],16)/255/12.92 for i in (0,2,4)),1);m.use_nodes=True
 n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=m.diffuse_color;n.inputs['Roughness'].default_value=.78;n.inputs['Metallic'].default_value=0
 if em:n.inputs['Emission Color'].default_value=m.diffuse_color;n.inputs['Emission Strength'].default_value=3
 M[t]=m;return m
mat('schoolBusYellow','f2b630');mat('uiDark','25222c');mat('glassDark','343448');mat('sidewalk','b9a4a0');mat('picketWhite','f2e6dc');mat('survivorRed','d9363e');mat('windowGlow','ffc773',True);mat('sirenRed','ff2d2d',True)
static=[]
def box(n,loc,size,t,b=0,keep=False):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=n;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(M[t])
 if b:
  mod=o.modifiers.new('soft toy corners','BEVEL');mod.width=b;mod.segments=3 if n in ['body','upper_cabin','round_roof','hood','front_bumper','rear_bumper'] else 1;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 if not keep:static.append(o)
 return o
def cyl(n,loc,r,depth,t,sides=12,keep=False):
 bpy.ops.mesh.primitive_cylinder_add(vertices=sides,radius=r,depth=depth,location=loc,rotation=(math.pi/2,0,0));o=bpy.context.object;o.name=n;o.data.materials.append(M[t]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if not keep:static.append(o)
 return o
def join_parts(parts,name,pivot=None):
 bpy.ops.object.select_all(action='DESELECT')
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=parts[0];o.name=name
 if pivot is not None:
  bpy.context.scene.cursor.location=pivot;bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
 return o
def text(n,word,loc,size,t,side=-1):
 cu=bpy.data.curves.new(n,'FONT');cu.body=word;cu.align_x='CENTER';cu.align_y='CENTER';cu.size=size;cu.extrude=.012;cu.resolution_u=1
 font=Path('/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf')
 if font.exists():cu.font=bpy.data.fonts.load(str(font))
 o=bpy.data.objects.new(n,cu);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(math.pi/2,0,0 if side<0 else math.pi);o.data.materials.append(M[t])
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');static.append(o);return o
def cut_arch(o,x):
 cutter=cyl('cutter',(x,0,.72),.84,4,'uiDark',16,True)
 mod=o.modifiers.new('wheel opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
def arch(n,x,side,t):
 verts=[]
 for y in [side*1.28,side*1.50]:
  for r in [.83,1.00]:
   for i in range(17):
    ang=i*math.pi/16;verts.append((x+r*math.cos(ang),y,.72+r*math.sin(ang)))
 faces=[]
 for i in range(16):
  for a,b in [(0,17),(34,51),(0,34),(17,51)]:faces.append((a+i,a+i+1,b+i+1,b+i))
 faces.extend([(0,17,51,34),(16,50,67,33)])
 me=bpy.data.meshes.new(n);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);o.data.materials.append(M[t]);static.append(o)
body=box('body',(-.65,0,1.6),(6.9,2.55,1.3),'schoolBusYellow',.13);cut_arch(body,-2.7)
cabin=box('upper_cabin',(-.65,0,2.88),(6.9,2.55,1.5),'schoolBusYellow',.16)
# Subtle taper narrows the cabin crown, rather than a square slab.
for v in cabin.data.vertices:
 if v.co.z>0:v.co.y*=.97
box('round_roof',(-.65,0,3.64),(7,2.63,.46),'schoolBusYellow',.22)
hood=box('hood',(3.48,0,1.73),(1.62,2.24,1.18),'schoolBusYellow',.19)
for v in hood.data.vertices:
 if v.co.z>0:v.co.z-=.12*(v.co.x+.81)/1.62;v.co.y*=.94
cut_arch(hood,3.1)
box('underframe',(0,0,.62),(7.9,1.5,.25),'uiDark',.05)
box('front_bumper',(4.35,0,.83),(.38,2.85,.44),'uiDark',.09)
box('bumper_center',(4.56,0,.83),(.025,.52,.23),'sidewalk',.015)
box('rear_bumper',(-4.18,0,.83),(.34,2.8,.38),'uiDark',.07)
for side in [-1,1]:
 for i,x in enumerate([-3.48,-2.35,-1.22,-.09,1.04]):
  box('window_frame',(x,side*1.283,2.9),(1.05,.105,1.02),'uiDark',.065)
  box('window_inset',(x,side*1.342,2.9),(.93,.022,.88),'glassDark',.035)
  box('window_sash',(x,side*1.36,2.91),(.94,.027,.035),'uiDark',.008)
 for z in [2.25,1.36]:box('black_stripe',(-.65,side*1.29,z),(6.75,.075,.15),'uiDark',.025)
 text('school_bus_lettering','SCHOOL BUS',(-1.62,side*1.345,1.83),.66,'uiDark',side)
 for x in [3.1,-2.7]:arch('flared_arch',x,side,'schoolBusYellow' if x>0 else 'uiDark')
 # Complete folding entry door, with an inset dark seam and four framed panes.
 parts=[]
 parts.append(box('door_seam',(2.23,side*1.30,2.05),(1.01,.08,2.48),'uiDark',.04,True))
 for x in [2.0,2.45]:
  parts.append(box('door_leaf',(x,side*1.353,2.05),(.42,.06,2.38),'schoolBusYellow',.025,True))
  for z,h in [(1.43,1.04),(2.67,1.02)]:
   parts.append(box('door_gasket',(x,side*1.39,z),(.34,.025,h),'uiDark',.025,True))
   parts.append(box('door_glass',(x,side*1.407,z),(.27,.018,h-.09),'glassDark',.018,True))
 parts.append(box('door_handle',(2.58,side*1.44,2.06),(.08,.07,.21),'uiDark',.018,True))
 join_parts(parts,'doorL' if side<0 else 'doorR',(1.76,side*1.3,.83))
 box('entry_step',(2.23,side*1.4,.83),(1.03,.30,.13),'uiDark',.025)
 box('mirror_arm',(2.79,side*1.49,2.98),(.10,.46,.08),'uiDark',.025)
 box('mirror_case',(2.8,side*1.72,2.73),(.20,.23,.53),'uiDark',.045)
 box('mirror_face',(2.917,side*1.72,2.73),(.023,.17,.43),'glassDark',.02)
 for x in [-3.55,.95,3.73]:box('lightsIndicator',(x,side*1.37,3.42 if x<2 else 1.88),(.25,.065,.12),'windowGlow',.025)
for y in [-.64,.64]:
 box('windshield_frame',(2.824,y,2.88),(.105,1.17,1.08),'uiDark',.055)
 box('windshield',(2.885,y,2.88),(.025,1.04,.94),'glassDark',.035)
box('grille_surround',(4.305,0,1.64),(.12,1.38,.82),'schoolBusYellow',.055)
box('grille',(4.38,0,1.64),(.055,1.24,.70),'uiDark',.035)
for z in [1.39,1.55,1.71,1.87]:box('grille_bar',(4.417,0,z),(.05,1.10,.055),'sidewalk',.014)
for y in [-.94,.94]:
 box('headlamp_frame',(4.30,y,1.49),(.16,.43,.54),'uiDark',.055)
 box('lightsFront',(4.397,y,1.49),(.07,.32,.40),'windowGlow',.045)
for x in [2.84,-4.16]:
 for y in [-.94,.94]:
  box('warning_mount',(x,y,3.49),(.13,.59,.35),'uiDark',.07)
  for dy in [-.145,.145]:
   o=cyl('lightsWarning',(x+(.085 if x>0 else -.085),y+dy,3.49),.115,.07,'sirenRed',12);o.rotation_euler=(0,math.pi/2,0)
for y in [-.95,.95]:box('lightsBrake',(-4.14,y,1.65),(.10,.27,.4),'sirenRed',.035)
box('rear_door_seam',(-4.13,0,2.04),(.06,1.25,2.26),'uiDark',.04)
box('rear_door',(-4.17,0,2.04),(.035,1.13,2.14),'schoolBusYellow',.035)
box('rear_glass_frame',(-4.197,0,2.73),(.025,1.00,.85),'uiDark',.035)
box('rear_glass',(-4.214,0,2.73),(.018,.89,.73),'glassDark',.025)
# Rounded sidewalls, a contrasting rim and hub cap, with no tread or lugs.
for x,ax in [(3.1,'F'),(-2.7,'R')]:
 for sy,side in [(-1,'L'),(1,'R')]:
  w=cyl('wheel'+ax+side,(x,sy*1.31,.72),.72,.48,'uiDark',16,True)
  mod=w.modifiers.new('rounded sidewalls','BEVEL');mod.width=.085;mod.segments=3;bpy.context.view_layer.objects.active=w;bpy.ops.object.modifier_apply(modifier=mod.name)
  rim=cyl('rim',(x,sy*1.553,.72),.43,.055,'sidewalk',16,True)
  hub=cyl('hubcap',(x,sy*1.597,.72),.235,.075,'uiDark',16,True)
  join_parts([w,rim,hub],'wheel'+ax+side)
edge=cyl('stop_border',(.85,-1.49,1.86),.50,.12,'picketWhite',8,True)
face=cyl('stop_face',(.85,-1.564,1.86),.435,.035,'survivorRed',8,True)
label=text('stop_text','STOP',(.85,-1.592,1.86),.38,'picketWhite');static.remove(label)
join_parts([edge,face,label],'door_stop_paddle',(1.36,-1.43,1.86))
# Static geometry joined by palette; animated wheels and stop paddle stay separate.
groups={m:[o for o in static if o.data.materials[0]==m] for m in M.values()}
for m,group in groups.items():
 if group:
  bpy.ops.object.select_all(action='DESELECT')
  for o in group:o.select_set(True)
  bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();group[0].name='body' if m==M['schoolBusYellow'] else ('lightsFront' if m==M['windowGlow'] else 'lightsBrake' if m==M['sirenRed'] else 'static_'+m.name)
assets=[o for o in bpy.context.scene.objects if o.type=='MESH']
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root)
for o in assets:o.parent=root
for name,loc in [('driverSeat',(2,-.65,2)),('exitL',(2,-1.6,.1)),('exitR',(2,1.6,.1))]:
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=root
tris=sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in assets)
print('OK triangles',tris,'meshes',len(assets))
if a.glb:
 bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
 for o in root.children:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
# Presentation stage is excluded from the GLB.
box('stage',(0,0,-.15),(200,200,.3),'asphalt' if 'asphalt' in M else 'sidewalk')
world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.24,.2,.32,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6
for name,loc,power,size,color in [('key',(0,-7,12),1800,7,(1,.82,.59)),('fill',(-6,4,8),1300,8,(.62,.7,1)),('rim',(6,5,10),1800,6,(1,.74,.42))]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,1.8))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;target=Vector((0,0,1.8));az=math.radians(45 if a.view=='game' else 56);el=math.radians(36 if a.view=='game' else 23);dist=70 if a.view=='game' else 22
cam.location=target+Vector((math.cos(az)*math.cos(el),-math.sin(az)*math.cos(el),math.sin(el)))*dist;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='PERSP';cam.data.lens=81.2 if a.view=='game' else 48;bpy.context.scene.camera=cam
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=a.samples;s.cycles.use_denoising=True
try:
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
 for d in prefs.devices:d.use=True
 s.cycles.device='GPU'
except:pass
s.render.resolution_x=a.width;s.render.resolution_y=a.height;s.render.resolution_percentage=100;s.view_settings.view_transform='AgX'
if a.blend:bpy.ops.wm.save_as_mainfile(filepath=a.blend)
if a.render:s.render.filepath=a.render;bpy.ops.render.render(write_still=True)
