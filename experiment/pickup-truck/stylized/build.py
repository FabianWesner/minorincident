# Identity features: red-and-cream two-tone body; single cab with sloping windshield;
# open pickup bed; four oversized wheels; square warm headlights; broad dark grille.
# Simplified parts: chassis, hood, cab shell/roof, opaque windows, arch-shaped side
# panels, bed floor/walls, bumpers, three grille bars, lamps, mirrors and wheels.
# Omitted: bolts, wipers, tread, lettering, plate, panel seams and fine chrome trim.
import bpy, math, argparse, sys, json
from mathutils import Vector
from pathlib import Path
p=argparse.ArgumentParser(); p.add_argument('--render'); p.add_argument('--view',default='ref'); p.add_argument('--samples',type=int,default=16); p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540); p.add_argument('--glb'); p.add_argument('--blend'); a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
M={}
def mat(token,h,em=False):
 m=bpy.data.materials.new(('emi_' if em else 'pal_')+token); m.diffuse_color=(*[(lambda v: v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4)(int(h[i:i+2],16)/255) for i in (0,2,4)],1); m.use_nodes=True; n=m.node_tree.nodes.get('Principled BSDF'); n.inputs['Base Color'].default_value=m.diffuse_color; n.inputs['Metallic'].default_value=0; n.inputs['Roughness'].default_value=.78
 if em: n.inputs['Emission Color'].default_value=m.diffuse_color; n.inputs['Emission Strength'].default_value=3
 M[token]=m; return m
for t,h in [('survivorRed','d9363e'),('picketWhite','f2e6dc'),('uiDark','25222c'),('sidewalk','b9a4a0'),('glassDark','30434c'),('brick','a8483a')]: mat(t,h)
mat('windowGlow','ffc773',True); mat('sirenRed','ff2d2d',True)
static=[]; wheels=[]
def finish(o,name,token,bevel=0,group=True):
 o.name=name; o.data.materials.append(M[token]); bpy.context.view_layer.objects.active=o
 if bevel:
  mod=o.modifiers.new('soft toy edges','BEVEL'); mod.width=bevel; mod.segments=2; bpy.ops.object.modifier_apply(modifier=mod.name)
  mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=mod.name)
 if group: static.append(o)
 return o
def box(name,loc,size,t,b=.04,group=True):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); return finish(o,name,t,b,group)
def prism(name,poly,y0,y1,t,b=0):
 verts=[(x,y,z) for y in (y0,y1) for x,z in poly]; n=len(poly); faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]; me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update(); o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o); return finish(o,name,t,b)
box('chassis',(0,0,.66),(4.65,1.68,.35),'uiDark',.08)
box('lower_body',(0,0,.96),(4.7,1.83,.5),'survivorRed',.10)
# White side band with real semicircular wheel clearance.
for sy in [-1,1]:
 poly=[(-2.36,1.49),(2.36,1.49),(2.36,.92)]
 for cx in [1.45,-1.45]:
  poly.append((cx+.68,.92))
  for j in range(9):
   th=j*math.pi/8; poly.append((cx+.68*math.cos(th),.70+.68*math.sin(th)))
 poly.append((-2.36,.92))
 prism('cream_arch_panel',poly,sy*.92-.065,sy*.92+.065,'picketWhite',.025)
box('hood',(1.55,0,1.51),(1.64,1.87,.28),'survivorRed',.10)
prism('cab',[(-.66,1.38),(.83,1.38),(.34,2.35),(-.62,2.35)],-.9,.9,'survivorRed',.09)
box('roof',(-.16,0,2.36),(1.13,1.94,.18),'survivorRed',.09)
# Side windows inset into the sloped cab profile.
for sy in [-1,1]:
 prism('side_window',[(-.53,1.64),(.62,1.64),(.27,2.25),(-.53,2.25)],sy*.916-.012,sy*.916+.012,'glassDark',.025)
 box('door_cream',(.0,sy*.955,1.45),(1.27,.035,.34),'picketWhite',.025)
 box('mirror',(.65,sy*1.09,1.77),(.26,.24,.25),'uiDark',.035)
# Windshield fitted to sloping forward face.
o=box('windshield',(.582,0,1.97),(.025,1.62,.73),'glassDark',.025); o.rotation_euler[1]=-.468
box('rear_window',(-.67,0,2.0),(.025,1.47,.5),'glassDark',.025)
# Open bed: thick rails, cream side walls, red interior floor.
box('bed_floor',(-1.53,0,1.13),(1.68,1.66,.15),'brick',.04)
for sy in [-1,1]:
 box('bed_wall',(-1.55,sy*.87,1.43),(1.70,.17,.58),'picketWhite',.045)
 box('bed_red_rail',(-1.55,sy*.87,1.73),(1.80,.21,.17),'survivorRed',.045)
box('tailgate',(-2.33,0,1.43),(.17,1.83,.58),'picketWhite',.04)
box('tailgate_red_top',(-2.34,0,1.745),(.20,1.87,.17),'survivorRed',.04)
box('front_face',(2.33,0,1.25),(.16,1.85,.53),'survivorRed',.04)
box('grille_frame',(2.425,0,1.26),(.10,1.04,.45),'sidewalk',.04)
box('grille',(2.486,0,1.26),(.035,.94,.35),'uiDark',.018)
for z in [1.16,1.29,1.42]: box('grille_bar',(2.51,0,z),(.045,.91,.045),'sidewalk',.008)
for sy in [-1,1]:
 box('lamp_surround',(2.43,sy*.70,1.29),(.14,.42,.44),'sidewalk',.045)
 box('headlamp',(2.51,sy*.70,1.29),(.055,.31,.32),'windowGlow',.06)
 box('tail_lamp',(-2.435,sy*.73,1.43),(.045,.22,.34),'sirenRed',.03)
box('front_bumper',(2.49,0,.89),(.23,2.06,.25),'sidewalk',.07)
box('rear_bumper',(-2.48,0,.88),(.22,1.99,.22),'sidewalk',.06)
for x,label in [(1.45,'front'),(-1.45,'rear')]:
 for sy,side in [(-1,'left'),(1,'right')]:
  parts=[]
  for rad,depth,y,t in [(.59,.40,sy*.96,'uiDark'),(.32,.045,sy*1.178,'sidewalk'),(.17,.055,sy*1.205,'uiDark')]:
   bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=rad,depth=depth,location=(x,y,.59),rotation=(math.pi/2,0,0)); o=bpy.context.object; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); finish(o,'wheel',t,.025,False); parts.append(o)
  bpy.ops.object.select_all(action='DESELECT')
  for o in parts:o.select_set(True)
  bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join(); o=parts[0]; o.name='wheel_'+label+'_'+side; bpy.context.scene.cursor.location=(x,sy*.96,.59); bpy.ops.object.origin_set(type='ORIGIN_CURSOR'); wheels.append(o)
# Merge static meshes by material, preserving centered wheel pivots.
groups=[(m,[o for o in static if o.data.materials[0]==m]) for m in M.values()]
for m,obs in groups:
 if not obs:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join(); obs[0].name='body' if m==M['survivorRed'] else ('lightsFront' if m==M['windowGlow'] else ('lightsBrake' if m==M['sirenRed'] else 'static_'+m.name))
for name,loc in [('driverSeat',(-.1,-.43,1.4)),('exitL',(0,-1.4,.1)),('exitR',(0,1.4,.1))]:
 o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc
asset=[o for o in bpy.context.scene.objects]; tris=sum(len(o.data.polygons) for o in []); tris=0
for o in asset:
 if o.type=='MESH':o.data.calc_loop_triangles(); tris+=len(o.data.loop_triangles)
if a.glb:
 bpy.ops.object.select_all(action='SELECT'); bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
print('OK triangles',tris,'meshes',sum(o.type=='MESH' for o in asset))
# Studio objects excluded from GLB.
box('stage',(0,0,-.09),(200,200,.16),'sidewalk',0,False)
world=bpy.context.scene.world; world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.29,.25,.36,1); world.node_tree.nodes['Background'].inputs[1].default_value=.7
for name,loc,power,size,color in [('key',(4,-5,8),1500,5,(1,.81,.62)),('fill',(-3,-1,5),900,5,(.68,.76,1)),('rim',(-3,5,6),1200,4,(1,.65,.40))]:
 bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.name=name; o.data.energy=power; o.data.shape='DISK'; o.data.size=size; o.data.color=color; o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(); cam=bpy.context.object; target=Vector((0,0,1.1)); elev=math.radians(36 if a.view=='game' else 24); az=math.radians(45 if a.view=='game' else 36); dist=43 if a.view=='game' else 16.0; cam.location=target+Vector((math.cos(elev)*math.cos(az),-math.cos(elev)*math.sin(az),math.sin(elev)))*dist; cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='PERSP'; cam.data.lens=81.2; bpy.context.scene.camera=cam
s=bpy.context.scene; s.render.engine='CYCLES'; s.cycles.samples=a.samples
try:
 prefs=bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type='METAL'; prefs.get_devices()
 for d in prefs.devices:d.use=True
 s.cycles.device='GPU'
except:pass
s.render.resolution_x=a.width; s.render.resolution_y=a.height; s.render.resolution_percentage=100; s.view_settings.view_transform='AgX'
if a.blend:bpy.ops.wm.save_as_mainfile(filepath=a.blend)
if a.render:s.render.filepath=a.render; bpy.ops.render.render(write_still=True)
