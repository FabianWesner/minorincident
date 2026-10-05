"""Sunset Grove civic safe zone. Reproducible metre-scale +X-forward asset."""
import bpy, bmesh, math, sys, json, random
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parent
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def arg(k,d=None): return ARGS[ARGS.index(k)+1] if k in ARGS else d
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
M={}
colors={'brick':'a8483a','picketWhite':'f2e6dc','sidewalk':'b9a4a0','asphalt':'5b4f5c','uiDark':'25222c','backpackTeal':'2f6e6a','policeBlue':'2f6bff','woodWarm':'b0703f','schoolBusYellow':'f2b630','foliage':'7da23c','windowGlow':'ffc773'}
for token,h in colors.items():
    name=('emi_' if token=='windowGlow' else 'pal_')+token
    m=bpy.data.materials.new(name); m.use_nodes=True
    c=tuple((int(h[i:i+2],16)/255)**2.2 for i in (0,2,4))+(1,)
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=c; bs.inputs['Roughness'].default_value=.76
    if token=='windowGlow': bs.inputs['Emission Color'].default_value=c; bs.inputs['Emission Strength'].default_value=1.25
    M[token]=m

def empty(name,parent=None,loc=(0,0,0)):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc; o.parent=parent; return o
root=empty('root'); root['assetId']='bld.civic-center'; root['forward']='+X'
roof=empty('roof',root); interior=empty('interior',root)
for name,loc,size in [('wall_rear',(-4.45,0,3.15),(.36,12,5.8)),('wall_L',(0,-6,3.15),(9,.36,5.8)),('wall_R',(0,6,3.15),(9,.36,5.8)),('facade_L',(4.35,-3.8,3.15),(.4,4.4,5.8)),('facade_R',(4.35,3.8,3.15),(.4,4.4,5.8))]:
 col=empty('col:'+name,root,loc); col['collider']='cuboid'; col['shape']='cuboid'; col['size']=list(size)

def finish(o,name,mat,parent=root):
    o.name=name; o.data.materials.append(M[mat]); o.parent=parent; return o

def box(name,loc,size,mat,bev=.025,parent=root):
    # Direct mesh construction avoids thousands of scene-wide operator updates.
    bm=bmesh.new(); bmesh.ops.create_cube(bm,size=1)
    for v in bm.verts:
        for i in range(3): v.co[i]*=size[i]
    if bev:
        segments=1 if any(k in name for k in ('brick','paving','frame','window','seam')) else 2
        edges=list(bm.edges)
        # Only exterior masonry edges are seen; keep their bevels and omit hidden rear bevels.
        if name in ('facade brick','side brick','rear brick'):
            axis=1 if name=='side brick' else 0
            direction=(-1 if name=='rear brick' else (1 if loc[axis]>0 else -1))
            outer=direction*size[axis]/2
            edges=[e for e in bm.edges if all(abs(v.co[axis]-outer)<1e-5 for v in e.verts)]
        bmesh.ops.bevel(bm,geom=edges,offset=bev,segments=segments,affect='EDGES',clamp_overlap=True)
    me=bpy.data.meshes.new(name);bm.to_mesh(me);bm.free();me.update()
    o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.location=loc
    return finish(o,name,mat,parent)
def cyl(name,loc,r,depth,mat,rot=(0,0,0),parent=root,verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=loc,rotation=rot)
    o=finish(bpy.context.object,name,mat,parent)
    md=o.modifiers.new('rim bevel','BEVEL'); md.width=.015; md.segments=2
    bpy.ops.object.modifier_apply(modifier=md.name); return o

def text(body,loc,size,mat='picketWhite',parent=root):
    cu=bpy.data.curves.new('raised lettering','FONT'); cu.body=body; cu.align_x='CENTER'; cu.align_y='CENTER'; cu.size=size; cu.extrude=.006; cu.resolution_u=2; cu.bevel_depth=0
    o=bpy.data.objects.new(body,cu); bpy.context.collection.objects.link(o); o.location=loc; o.rotation_euler=(math.pi/2,0,math.pi/2); o.parent=parent; cu.materials.append(M[mat]); bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False); return o

def poly(name,coords,depth,x,mat,parent=root):
    vs=[(x+d,y,z) for d in (0,depth) for y,z in coords]; n=len(coords)
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    me=bpy.data.meshes.new(name); me.from_pydata(vs,[],faces); me.update(); o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o); return finish(o,name,mat,parent)
# Wide hall footprint, tiled pavement and real joints.
for i in range(16):
 for j in range(17): box('paving',(-5.2+i*.85,-7.2+j*.85,.11),(.832,.832,.22),'sidewalk',.025)
box('interior floor',(0,0,.29),(9,11.4,.22),'sidewalk',parent=interior)
# Wall masonry: openings are actual gaps, rather than black paint on a solid wall.
for row in range(20):
 z=.55+row*.285
 for col in range(22):
    y=-5.9+col*.55+(row%2)*.275
    if y>6: continue
    opening=(abs(y)<1.52 and z<3.2) or (abs(y)<2.0 and 3.7<z<5.25)
    if not opening: box('facade brick',(4.35,y,z),(.36,.531,.267),'brick',.012)
 for side in (-1,1):
  for col in range(16):
    x=-4.1+col*.55+(row%2)*.275
    if x>4.35: continue
    opening=any(abs(x-w)<.85 for w in (-2.5,.2,2.7)) and (.9<z<2.8 or 3.55<z<5.2)
    if not opening: box('side brick',(x,side*6,z),(.531,.36,.267),'brick',.012)
 for col in range(22):
    y=-5.9+col*.55
    box('rear brick',(-4.45,y,z),(.32,.531,.267),'brick',.012)
# Foundation, cornices, corner and facade pilasters.
for y in (-5.85,-2.4,2.4,5.85):
 box('pier',(4.55,y,3.1),(.52,.62,5.8),'brick',.025)
 for z,w,h in ((.6,.82,.76),(1,.7,.15),(5.35,.82,.22),(5.85,.76,.62),(6.22,.92,.25)):
  box('stone pier band',(4.57,y,z),(.65,w,h),'picketWhite',.035)
box('rear foundation',(-4.45,0,.6),(.45,12.3,.76),'picketWhite',.035)
for side in (-1,1):
 box('foundation',(0,side*6,.6),(9.25,.45,.76),'picketWhite',.035)
 box('side cornice',(0,side*6,5.95),(9.35,.5,.24),'picketWhite',.04)
# Flat roof separate, parapet blocks, tile seams.
box('roof deck',(-.1,0,5.88),(9.3,12.25,.24),'asphalt',.03,roof)
for x in [-4.6+i*.8 for i in range(12)]:
 for y in (-6.12,6.12): box('parapet coping',(x,y,6.3),(.79,.48,.24),'picketWhite',.03,roof)
for y in [-5.75+i*.8 for i in range(15)]:
 for x in (-4.55,4.5): box('parapet coping',(x,y,6.3),(.48,.79,.24),'picketWhite',.03,roof)
for x in [-4+i*1.3 for i in range(7)]: box('roof seam',(x,0,6.013),(.014,11.7,.01),'sidewalk',.002,roof)
for y in [-5.6+i*1.4 for i in range(9)]: box('roof seam',(-.1,y,6.013),(8.6,.014,.01),'sidewalk',.002,roof)
# Entry upper windows and side gym windows with mullions.
def frontwindow(y,z,w,h,parent=root):
 box('window glass',(4.37,y,z),(.12,w,h),'windowGlow',.01,parent)
 for dy in (-w/2,w/2): box('window jamb',(4.5,y+dy,z),(.23,.12,h+.2),'picketWhite',.02,parent)
 for dz in (-h/2,h/2): box('window sill',(4.51,y,z+dz),(.26,w+.22,.14),'picketWhite',.025,parent)
 box('window mullion',(4.53,y,z),(.10,.07,h),'uiDark',.009,parent)
 box('window transom',(4.54,y,z+h*.22),(.1,w,.075),'uiDark',.009,parent)
frontwindow(0,4.45,3.7,1.3)
for y in (-1.23,1.23): box('upper mullions',(4.57,y,4.45),(.13,.13,1.4),'picketWhite',.015)
for side in (-1,1):
 for x in (-2.5,.2,2.7):
  for z,h in ((1.9,1.7),(4.4,1.6)):
   box('gym glazing',(x,side*6.03,z),(1.55,.12,h),'windowGlow',.01)
   for dx in (-.83,0,.83): box('gym frame',(x+dx,side*6.15,z),(.12,.18,h+.2),'picketWhite',.02)
   for dz in (-h/2,h*.2,h/2): box('gym sill',(x,side*6.15,z+dz),(1.8,.20,.12),'picketWhite',.02)
# Central entry, two independently hinged doors.
for y in (-1.32,1.32): box('entry pillars',(4.6,y,1.85),(.55,.24,2.85),'picketWhite',.03)
box('entry transom',(4.5,0,2.9),(.22,2.45,.42),'windowGlow',.02)
box('entrance canopy',(4.85,0,3.34),(.7,3.2,.32),'asphalt',.04)
for side in (-1,1):
 hinge=empty('door_'+('L' if side<0 else 'R'),root,(4.57,side*1.16,.42)); hinge['animated']=True
 box('door frame',(0,-side*.57,1.12),(.16,1.13,2.24),'uiDark',.025,hinge)
 box('door glazing',(.125,-side*.57,1.48),(.025,.84,1.13),'windowGlow',.012,hinge)
 box('door lower inset',(.125,-side*.57,.42),(.026,.86,.44),'asphalt',.015,hinge)
 box('door handle',(.17,-side*1.01,1.02),(.08,.045,.28),'schoolBusYellow',.015,hinge)
# Three shallow stairs, flanking stone cheek blocks.
for i in range(3): box('entry step',(5.02+i*.37,0,.48-i*.10),(.75,3.6+i*.3,.2),'picketWhite',.035)
for y in (-2.08,2.08): box('step cheek',(5.45,y,.44),(1.7,.35,.44),'sidewalk',.04)
# Pediment and clock; text is physically raised > 3mm.
poly('pediment',[(-2.55,5.35),(2.55,5.35),(0,7.25)],.22,4.5,'picketWhite')
for s in (-1,1):
 o=box('sloped pediment trim',(4.69,s*1.31,6.36),(.38,3.22,.18),'picketWhite',.03); o.rotation_euler.x=-s*math.atan2(1.9,2.55)
box('sign plate',(4.69,0,5.51),(.28,4.9,.99),'picketWhite',.025)
text('SUNSET GROVE',(4.844,0,5.78),.35,'uiDark'); text('CIVIC CENTER',(4.844,0,5.35),.42,'uiDark')
cyl('clock rim',(4.79,0,6.53),.51,.14,'uiDark',(0,math.pi/2,0))
cyl('clock dial',(4.872,0,6.53),.445,.025,'picketWhite',(0,math.pi/2,0))
for i in range(12):
 a=i*math.tau/12; o=box('clock tick',(4.895,math.sin(a)*.36,6.53+math.cos(a)*.36),(.022,.035,.09),'uiDark',.004); o.rotation_euler.x=-a
for a,length in ((.12,.28),(.85,.24)):
 o=box('clock hand',(4.92,math.sin(a)*length/2,6.53+math.cos(a)*length/2),(.022,.04,length),'uiDark',.004); o.rotation_euler.x=-a
cyl('clock pin',(4.944,0,6.53),.045,.022,'uiDark',(0,math.pi/2,0))
# Roof chimney, HVAC housings with inset grilles and circular fans.
box('roof access',(-.6,-.3,6.6),(1.8,2,1.35),'brick',.03,roof)
for row in range(5):
 for col in range(4):
  for x in (-1.51,.31): box('tower brick',(x,-1.05+col*.49,6.12+row*.26),(.03,.47,.24),'brick',.012,roof)
 for col in range(4):
  for y in (-1.31,.71): box('tower brick',(-1.28+col*.46,y,6.12+row*.26),(.44,.03,.24),'brick',.01,roof)
box('roof access cap',(-.6,-.3,7.3),(2.05,2.25,.18),'picketWhite',.035,roof)
for n,(x,y) in enumerate(((-2.2,-3.8),(-2.1,3.5),(1.4,3.8))):
 box('HVAC plinth',(x,y,6.15),(1.4,1.55,.18),'uiDark',.025,roof)
 box('HVAC housing',(x,y,6.64),(1.25,1.4,.9),'sidewalk',.05,roof)
 box('HVAC grille',(x+.639,y,6.64),(.022,1.08,.65),'uiDark',.008,roof)
 for i in range(12): box('HVAC grille slat',(x+.659,y,6.34+i*.051),(.022,1.04,.022),'asphalt',.004,roof)
 cyl('fan rim',(x,y,7.11),.44,.035,'uiDark',parent=roof)
 for a in range(8):
  o=box('fan spokes',(x,y,7.14),(.72,.022,.016),'asphalt',.004,roof); o.rotation_euler.z=a*math.pi/8
 cyl('fan center',(x,y,7.15),.105,.04,'sidewalk',parent=roof)
for x,y in ((2.1,-3.7),(-3.4,.6)):
 box('vent',(x,y,6.28),(.45,.48,.5),'sidewalk',.025,roof); box('vent hood',(x,y,6.58),(.56,.56,.15),'picketWhite',.02,roof)
# Blue fabric panels, mounting poles, bold safe-zone relief icons.
for y in (-4.05,4.05):
 box('SAFE ZONE banner',(4.65,y,2.98),(.10,1.58,3.65),'policeBlue',.035)
 for dy in (-.79,.79): box('banner edge',(4.713,y+dy,2.98),(.02,.035,3.6),'backpackTeal',.005)
 for z in (1.18,4.83):
  o=cyl('banner rod',(4.72,y,z),.042,1.86,'uiDark',(math.pi/2,0,0))
  for dy in (-.89,.89): cyl('rod finial',(4.72,y+dy,z),.067,.06,'schoolBusYellow',(math.pi/2,0,0))
 poly('shelter icon',[(y-.36,3.88),(y+.36,3.88),(y+.36,4.31),(y+.5,4.31),(y,4.74),(y-.5,4.31),(y-.36,4.31)],.018,4.716,'picketWhite')
 box('shelter opening',(4.74,y,4.13),(.012,.17,.25),'policeBlue',.002)
 text('SAFE',(4.721,y,3.45),.53); text('ZONE',(4.721,y,2.89),.53)
 text('STRONGER',(4.721,y,2.26),.19); text('TOGETHER',(4.721,y,2.02),.19)
 poly('heart',[(y,1.5),(y-.16,1.7),(y-.15,1.81),(y-.06,1.85),(y,1.77),(y+.06,1.85),(y+.15,1.81),(y+.16,1.7)],.018,4.718,'picketWhite')
# Lanterns: separate, named units with light semantics.
for n,(y,z,x) in enumerate(((-2.93,3.3,4.78),(2.93,3.3,4.78),(-1.95,1.85,5.03),(1.95,1.85,5.03))):
 lamp=empty('lamp_'+str(n),root)
 if n>1: cyl('lamp post',(x,y,.9),.065,1.25,'uiDark',parent=lamp); cyl('post base',(x,y,.55),.16,.7,'asphalt',parent=lamp)
 box('lamp bracket',(x-.16,y,z+.22),(.42,.08,.09),'uiDark',.01,lamp)
 glass=box('lamp_glow_'+str(n),(x,y,z),(.22,.22,.38),'windowGlow',.02,lamp)
 for dy in (-.14,.14):
  for dx in (-.14,.14): box('lantern frame',(x+dx,y+dy,z),(.035,.035,.46),'uiDark',.008,lamp)
 box('lantern cap',(x,y,z+.26),(.38,.38,.13),'woodWarm',.03,lamp)
 box('lantern base',(x,y,z-.25),(.33,.33,.10),'uiDark',.02,lamp)
 # Put the lantern assembly origin at its mounting joint.
 pivot=Vector((x-.16,y,z+.22))
 for child in lamp.children: child.location-=pivot
 lamp.location=pivot
 anchor=empty('light:entry_'+str(n),root,(x,y,z)); anchor['ss_light']=json.dumps({'type':'point','color':'light_window_warm','intensity':2,'range':4,'pool':True,'beam':'none','flare':True,'reflect':True,'shadow':'none','heroPriority':1,'flicker':'none','powerGroup':'D-CIVIC','breakable':True,'emissiveNodes':[glass.name],'tiers':'all'})
# Staggered rounded sacks: seams and tied ends, deterministic variation.
rng=random.Random(72)
for side in (-1,1):
 for layer in range(4):
  for i in range(4):
   y=side*4.05+(i-1.5)*.57+(layer%2)*.12
   bm=bmesh.new();bmesh.ops.create_uvsphere(bm,u_segments=16,v_segments=8,radius=1)
   for v in bm.verts:
    for axis,scale in enumerate((.345,.31,.145)):
     value=v.co[axis];v.co[axis]=math.copysign(abs(value)**.6,value)*scale
   me=bpy.data.meshes.new('soft sack');bm.to_mesh(me);bm.free()
   for face in me.polygons:face.use_smooth=True
   o=bpy.data.objects.new('sandbag',me);bpy.context.collection.objects.link(o);o.location=(5.22,y,.365+layer*.22);finish(o,'sandbag','woodWarm');o.rotation_euler.z=rng.uniform(-.09,.09)
   cyl('bag knot',(5.25,y+.31,.365+layer*.22),.042,.07,'woodWarm',(math.pi/2,0,0),verts=8)
# Small shrubs at rear corners.
for side in (-1,1):
 for i in range(12):
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.19,location=(-3.5+rng.uniform(-.3,.3),side*6.35+rng.uniform(-.22,.22),.35+rng.random()*.65)); finish(bpy.context.object,'shrub','foliage')
# Emissive windows are decorative; lamps use the anchors above.
for o in list(bpy.context.scene.objects):
 if o.type=='MESH' and any(m.name.startswith('emi_') for m in o.data.materials): o['decorativeEmissive']=True
# Join by material within static ownership groups; preserve hinged doors and roof visibility.
for parent in (root,roof,interior):
 for mat in M.values():
  objs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==parent and len(o.data.materials)==1 and o.data.materials[0]==mat]
  if not objs: continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in objs: o.select_set(True)
  bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join(); objs[0].name=parent.name+'_'+mat.name
  if mat.name.startswith('emi_'): objs[0]['decorativeEmissive']=True
# Keep lanterns as one object each, light anchors point to final emissive geometry.
for p in [o for o in bpy.context.scene.objects if o.type=='EMPTY' and o.name.startswith('lamp_')]:
 for mat in M.values():
  objs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==p and o.data.materials[0]==mat]
  if len(objs)>1:
   bpy.ops.object.select_all(action='DESELECT')
   for o in objs:o.select_set(True)
   bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join()
# Final geometry counts and export; LODs use collapse decimation on actual joined meshes.
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
def stats():
 for o in meshes:o.data.calc_loop_triangles()
 return sum(len(o.data.loop_triangles) for o in meshes),sum(len(o.data.materials) for o in meshes)
# Bake deterministic short-range vertex AO; the runtime palette shader can reuse it.
def bake_ao():
 from mathutils.bvhtree import BVHTree
 bpy.context.view_layer.update()
 vertices=[];faces=[]
 for o in meshes:
  offset=len(vertices);vertices.extend(o.matrix_world @ v.co for v in o.data.vertices)
  faces.extend(tuple(offset+i for i in p.vertices) for p in o.data.polygons)
 tree=BVHTree.FromPolygons(vertices,faces)
 directions=[Vector((math.cos(i*2.399963)*math.sqrt(1-((i+.5)/32)**2),math.sin(i*2.399963)*math.sqrt(1-((i+.5)/32)**2),(i+.5)/32)) for i in range(32)]
 for o in meshes:
  attr=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='POINT')
  o.data.color_attributes.active_color_index=len(o.data.color_attributes)-1; o.data.color_attributes.render_color_index=len(o.data.color_attributes)-1
  matrix=o.matrix_world.copy();normal_matrix=matrix.to_3x3().inverted().transposed()
  samples=[(matrix @ v.co,(normal_matrix @ v.normal).normalized()) for v in o.data.vertices]
  values=[]
  for point,normal in samples:
   rotation=Vector((0,0,1)).rotation_difference(normal);point=point+normal*.006
   hits=sum(tree.ray_cast(point,rotation @ direction,.6)[0] is not None for direction in directions)
   value=1-.35*hits/32;values.extend((value,value,value,1))
  attr.data.foreach_set('color',values)
if arg('--glb'): bake_ao()
tri,draw=stats()
report={'id':'bld.civic-center','tier':'Hero','triangles':tri,'draw_calls':draw,'materials':sorted(m.name for m in M.values()),'nodes_ok':all(bpy.data.objects.get(n) for n in ('root','roof','interior','door_L','door_R')),'within_budget':tri<=100000 and draw<=40,'rounds':1,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(OUT/'geometry.json').write_text(json.dumps(report,indent=2))
def export(path):
 bpy.ops.object.select_all(action='SELECT'); bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
if arg('--glb'):
 export(Path(arg('--glb')).resolve())
 originals={o:o.data.copy() for o in meshes}
 lodstats={}
 for level,ratio in ((1,.125),(2,.03)):
  for o in meshes:
   o.data=originals[o].copy(); bpy.context.view_layer.objects.active=o
   md=o.modifiers.new('LOD','DECIMATE');md.ratio=ratio;bpy.ops.object.modifier_apply(modifier=md.name)
  export(OUT/f'model.lod{level}.glb');lodstats[str(level)]={'triangles':stats()[0]}
 for o in meshes:o.data=originals[o]
 (OUT/'lod-stats.json').write_text(json.dumps(lodstats,indent=2))
if arg('--render'):
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=int(arg('--samples',24));scene.cycles.use_denoising=True
 scene.world.color=(.17,.15,.19)
 for name,loc,power,size,color in [('key',(7,-9,15),4200,8,(1,.78,.57)),('fill',(2,8,12),2400,10,(.68,.77,1)),('rim',(-8,1,12),2500,7,(1,.63,.35))]:
  d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color;o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,3))-o.location).to_track_quat('-Z','Y').to_euler()
 cam=bpy.data.objects.new('Camera',bpy.data.cameras.new('Camera'));bpy.context.collection.objects.link(cam);scene.camera=cam
 views={'ref':(27,21,19),'game':(22,22,26),'front':(30,0,12),'side':(0,30,13),'rear':(-22,-22,18)}
 cam.location=views[arg('--view','ref')];cam.rotation_euler=(Vector((0,0,3))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=29 if arg('--view','ref')=='game' else 26.5
 scene.render.resolution_x=int(arg('--width',960));scene.render.resolution_y=int(arg('--height',540));scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
 scene.render.filepath=str(Path(arg('--render')).resolve());bpy.ops.render.render(write_still=True)
 if arg('--view','ref')=='ref':
  cam.data.ortho_scale=29;cam.location=views['game'];cam.rotation_euler=(Vector((0,0,3))-cam.location).to_track_quat('-Z','Y').to_euler()
  scene.cycles.samples=24;scene.render.resolution_x=960;scene.render.resolution_y=540
  destination=Path(arg('--render'));filename=destination.name.replace('-ref','-game') if '-ref' in destination.name else 'game.png'
  game_path=destination.with_name(filename).resolve()
  scene.render.filepath=str(game_path);bpy.ops.render.render(write_still=True)
  if arg('--glb') and report['within_budget']:
   (OUT/'renders'/'game.png').write_bytes(game_path.read_bytes())
   if destination.name!='hero.png':
    cam.data.ortho_scale=26.5;cam.location=views['ref'];cam.rotation_euler=(Vector((0,0,3))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x=1600;scene.render.resolution_y=900;scene.cycles.samples=96
    scene.render.filepath=str(OUT/'renders'/'hero.png');bpy.ops.render.render(write_still=True)
print('BUILD OK',tri,'triangles',draw,'draw calls')
