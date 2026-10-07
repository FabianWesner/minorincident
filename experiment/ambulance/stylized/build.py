# Identity features: tall white patient box; broad red stripe; blue Star of Life;
# sloping toy cab; four chunky wheels; thick red/blue emergency light bar.
# Simplified parts: beveled box body, wedge cab, hood, dark window slabs,
# stripe slabs, six-arm medical emblems, grille, bumpers, lamps, wheels/hubs.
# Dropped: lettering, hinges, seams, handles, wipers, mirrors, bolts, tire treads,
# tiny marker lamps, detailed snake/staff, interior seats and chrome trim.
import bpy, bmesh, math, argparse, sys, json
from mathutils import Vector
p=argparse.ArgumentParser(); p.add_argument('--render'); p.add_argument('--view',default='ref'); p.add_argument('--samples',type=int,default=16); p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540); p.add_argument('--glb'); p.add_argument('--blend'); a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
M={}
def mat(token,h,emit=False):
 srgb=tuple(int(h[i:i+2],16)/255 for i in (0,2,4)); c=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in srgb); m=bpy.data.materials.new(('emi_' if emit else 'pal_')+token); m.diffuse_color=(*c,1); m.use_nodes=True; s=m.node_tree.nodes.get('Principled BSDF'); s.inputs['Base Color'].default_value=(*c,1); s.inputs['Metallic'].default_value=0; s.inputs['Roughness'].default_value=.78
 if emit: s.inputs['Emission Color'].default_value=(*c,1); s.inputs['Emission Strength'].default_value=3
 M[token]=m; return m
for t,h in [('picketWhite','f2e6dc'),('survivorRed','d9363e'),('policeBlue','2f6bff'),('uiDark','25222c'),('sidewalk','b9a4a0'),('glassDark','263746')]: mat(t,h)
for t,h in [('sirenRed','ff2d2d'),('windowGlow','ffc773'),('policeBlueGlow','2f6bff')]: mat(t,h,True)
# policeBlueGlow is an emissive alias, renamed to the established palette token.
M['policeBlueGlow'].name='emi_policeBlue'
parts=[]; moving=[]
def finish(o,name,m,bevel=0):
 o.name=name; o.data.materials.append(M[m]); bpy.context.view_layer.objects.active=o; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  b=o.modifiers.new('soft toy corners','BEVEL'); b.width=bevel; b.segments=2; bpy.ops.object.modifier_apply(modifier=b.name)
  n=o.modifiers.new('weighted faces','WEIGHTED_NORMAL'); n.keep_sharp=True; bpy.ops.object.modifier_apply(modifier=n.name)
 bm=bmesh.new(); bm.from_mesh(o.data); bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(o.data); bm.free()
 parts.append(o); return o
def box(name,loc,size,m,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size; return finish(o,name,m,bevel)
def prism(name,profile,width,m,bev=0):
 verts=[(x,y,z) for y in [-width/2,width/2] for x,z in profile]; n=len(profile); faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]; mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update(); o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o); return finish(o,name,m,bev)
box('patient_box',(-1.12,0,1.92),(3.9,2.32,2.34),'picketWhite',.13)
box('chassis',(-.05,0,.76),(5.85,2.12,.34),'uiDark',.07)
prism('cab',[(.72,.85),(2.96,.85),(2.96,1.43),(2.29,1.63),(1.66,2.57),(.72,2.57)],2.12,'picketWhite',.1)
box('hood',(2.54,0,1.4),(1.03,2.12,.38),'picketWhite',.12)
# windshield fitted to the large slanted cab face
prism('windshield',[(1.75,2.46),(2.3,1.68),(2.34,1.69),(1.79,2.47)],1.79,'glassDark',.025)
for side in [-1,1]:
 y=side*1.071
 # broad trapezoidal side glass, rather than tiny frame pieces
 verts=[(.9,y,1.69),(2.15,y,1.69),(1.61,y,2.43),(.9,y,2.43)]
 mesh=bpy.data.meshes.new('sideglass'); mesh.from_pydata(verts,[],[(0,1,2,3)]); mesh.update(); o=bpy.data.objects.new('side_window',mesh); bpy.context.collection.objects.link(o); finish(o,'side_window','glassDark')
 box('box_stripe',(-1.12,side*1.165,1.25),(3.68,.025,.43),'survivorRed')
 box('cab_stripe',(1.92,side*1.071,1.21),(2.0,.025,.34),'survivorRed')
 # Single watertight medical emblem avoids overlapping coplanar bars.
 def emblem(name,center,roof=False):
  outline=[]
  for k in range(6):
   theta=k*math.pi/3+math.pi/6
   for r,offset in [(math.hypot(.52,.16),-math.atan2(.16,.52)),(math.hypot(.52,.16),math.atan2(.16,.52)),(.32,math.pi/6)]:
    outline.append((r*math.cos(theta+offset),r*math.sin(theta+offset)))
  vertices=[]
  for depth in [-.018,.018]:
   for u,v in outline:
    vertices.append((center[0]+u,center[1]+v,center[2]+depth) if roof else (center[0]+u,center[1]+depth,center[2]+v))
  n=len(outline); faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
  mesh=bpy.data.meshes.new(name); mesh.from_pydata(vertices,[],faces); mesh.update(); o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o);finish(o,name,'policeBlue')
 emblem('star_of_life',(-1.55,side*1.19,2.18))
 box('medical_staff',(-1.55,side*1.216,2.18),(.12,.02,.63),'picketWhite')
# Roof emblem gives the game camera an immediate medical identity.
emblem('roof_star',(-1.2,0,3.112),True)
box('rear_stripe',(-3.078,0,1.25),(.025,2.11,.43),'survivorRed')
box('grille',(3.045,0,1.21),(.045,1.14,.46),'uiDark',.035)
for z in [1.08,1.25,1.42]: box('grille_bar',(3.077,0,z),(.04,1.0,.055),'sidewalk')
box('front_bumper',(3.12,0,.78),(.26,2.33,.27),'sidewalk',.065)
box('rear_bumper',(-3.15,0,.76),(.23,2.41,.25),'sidewalk',.055)
for side in [-1,1]:
 o=box('lightsFront',(3.045,side*.83,1.3),(.07,.39,.37),'windowGlow',.035); moving.append(o)
 o=box('lightsBrake',(-3.08,side*.89,1.73),(.06,.25,.47),'sirenRed',.025); moving.append(o)
box('siren_mount',(.77,0,2.69),(.46,1.89,.14),'uiDark',.035)
for side in [-1,1]:
 o=box('sirenL' if side==-1 else 'sirenR',(.77,side*.64,2.87),(.43,.62,.31),'sirenRed',.055); moving.append(o)
o=box('light_blue',(.77,0,2.87),(.43,.55,.31),'policeBlueGlow',.045); moving.append(o)
for x,axle in [(2.19,'front'),(-1.97,'rear')]:
 for y,side in [(-1.15,'left'),(1.15,'right')]:
  bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.57,depth=.38,location=(x,y,.57),rotation=(math.pi/2,0,0)); o=finish(bpy.context.object,'wheel_'+axle+'_'+side,'uiDark',.045)
  bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.3,depth=.025,location=(x,y+(-.2 if y<0 else .2),.57),rotation=(math.pi/2,0,0)); hub=finish(bpy.context.object,'hub','sidewalk',.02)
  bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); hub.select_set(True); bpy.context.view_layer.objects.active=o; bpy.ops.object.join(); moving.append(o)
  o['contract_name']=('wheelF' if axle=='front' else 'wheelR')+('L' if side=='left' else 'R')
# Merge every static material group to minimize draw calls.
static=[o for o in bpy.context.scene.objects if o.type=='MESH' and o not in moving]
for material in M.values():
 group=[o for o in bpy.context.scene.objects if o.type=='MESH' and o not in moving and o.data.materials[0]==material]
 if not group: continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in group:o.select_set(True)
 bpy.context.view_layer.objects.active=group[0]; bpy.ops.object.join(); group[0].name='body' if material==M['picketWhite'] else 'static_'+material.name
root=bpy.data.objects.new('ambulance',None); bpy.context.collection.objects.link(root)
for o in list(bpy.context.scene.objects):
 if o.type=='MESH':o.parent=root
for name,loc in [('driverSeat',(1.25,-.55,1.4)),('exitL',(1.1,-1.45,0)),('exitR',(1.1,1.45,0))]:
 o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc; o.parent=root
asset=[o for o in bpy.context.scene.objects if o.type=='MESH']; triangles=sum(len(p.vertices)-2 for o in asset for p in o.data.polygons)
print('OK geometry',json.dumps({'triangles':triangles,'meshes':len(asset),'materials':[m.name for m in M.values()]}))
if a.glb:
 bpy.ops.object.select_all(action='DESELECT'); root.select_set(True)
 for o in root.children:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
if a.blend:bpy.ops.wm.save_as_mainfile(filepath=a.blend)
if a.render:
 box('stage',(0,0,-.13),(200,200,.25),'sidewalk')
 scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=a.samples
 scene.cycles.use_denoising=True
 prefs=bpy.context.preferences.addons['cycles'].preferences
 try:
  prefs.compute_device_type='METAL'; prefs.get_devices()
  for d in prefs.devices:d.use=True
  scene.cycles.device='GPU'
 except:pass
 scene.world.color=(.3,.3,.3)
 world=scene.world; world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.36,.40,.52,1); world.node_tree.nodes['Background'].inputs[1].default_value=.65
 def area(loc,power,color,size):
  bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1.3))-o.location).to_track_quat('-Z','Y').to_euler()
 area((5,-7,10),1500,(1,.78,.56),7);area((-4,3,7),1000,(.59,.69,1),6)
 bpy.ops.object.camera_add(); cam=bpy.context.object; target=Vector((0,0,1.35)); az=math.radians(45 if a.view=='game' else 35); el=math.radians(36 if a.view=='game' else 24); dist=49 if a.view=='game' else 15
 cam.location=target+Vector((math.cos(az)*math.cos(el),-math.sin(az)*math.cos(el),math.sin(el)))*dist;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='PERSP';cam.data.angle=math.radians(25 if a.view=='game' else 38);scene.camera=cam
 scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=a.render;scene.view_settings.view_transform='AgX';bpy.ops.render.render(write_still=True)
