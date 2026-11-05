"""STOP HERE trailer: metres, +X sign/front, Z up; raised geometry-only markings."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
for flag in ['render','glb']: p.add_argument('--'+flag)
p.add_argument('--view',default='ref'); p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
M={}
for token,h in {'schoolBusYellow':'f58b24','woodWarm':'b0703f','uiDark':'25222c','asphalt':'5b4f5c','sidewalk':'b9a4a0','picketWhite':'f2e6dc','survivorRed':'d9363e','windowGlow':'ffc773'}.items():
    rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    color=tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)
    m=bpy.data.materials.new('pal_'+token); m.use_nodes=True
    bs=m.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value=color; bs.inputs['Roughness'].default_value=.52
    if token=='sidewalk': bs.inputs['Metallic'].default_value=.65
    M[token]=m
for token,strength in [('schoolBusYellow',2),('survivorRed',1)]:
    m=M[token].copy(); m.name='emi_'+token; bs=m.node_tree.nodes['Principled BSDF']
    bs.inputs['Emission Color'].default_value=bs.inputs['Base Color'].default_value; bs.inputs['Emission Strength'].default_value=strength; M['emi_'+token]=m

def empty(name,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc
    if parent:
        bpy.context.view_layer.update(); w=o.matrix_world.copy(); o.parent=parent; o.matrix_world=w
    return o
root=empty('root'); root['asset_id']='prop.stop-here-sign-trailer'
root['ss_physics']=json.dumps({'class':'heavy','mass':450,'friction':.8,'restitution':.05,'pushable':False,'kickable':False,'vaultable':False,'flammable':False,'sounds':'prop.metal-heavy'})
body=empty('body',parent=root); board=empty('sign_board',(-.12,0,2.05),root)
parents=[body,board]
def finish(o,name,mat,parent,bevel=0):
    o.name=name; o.data.materials.append(M[mat])
    if bevel:
        mod=o.modifiers.new('soft edges','BEVEL'); mod.width=bevel; mod.segments=1
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.update(); w=o.matrix_world.copy(); o.parent=parent; o.matrix_world=w
    return o
def box(name,loc,size,mat,parent=body,bevel=.01):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,parent,min(bevel,min(size)*.35))
def cyl(name,loc,r,depth,mat,parent=body,axis='z',n=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=depth,location=loc); o=bpy.context.object
    if axis=='x':o.rotation_euler.y=math.pi/2
    if axis=='y':o.rotation_euler.x=math.pi/2
    return finish(o,name,mat,parent)
def beam(name,start,end,width,mat,parent=body):
    s,e=Vector(start),Vector(end); o=box(name,(s+e)/2,(width,width,(e-s).length),mat,parent)
    o.rotation_euler=(e-s).to_track_quat('Z','Y').to_euler(); return o
# Chassis, generator cabinet, top lid and service panels.
box('chassis',(-.1,0,.53),(1.6,1.18,.18),'uiDark',bevel=.025)
box('generator',(-.15,0,.93),(1.42,1.05,.70),'schoolBusYellow',bevel=.06)
box('lid',(-.15,0,1.30),(1.44,1.07,.075),'schoolBusYellow',bevel=.025)
for y in [-.535,.535]:
    box('panel_seam',(-.25,y,.93),(.85,.015,.52),'woodWarm')
    box('service_door',(-.25,y+math.copysign(.015,y),.93),(.82,.018,.49),'schoolBusYellow')
    box('vent_recess',(-.45,y+math.copysign(.028,y),.98),(.39,.018,.26),'uiDark')
    for z in [.89,.95,1.01,1.07]:box('vent_louver',(-.45,y+math.copysign(.044,y),z),(.33,.025,.026),'asphalt')
    box('latch',(.06,y+math.copysign(.035,y),.91),(.075,.03,.045),'uiDark')
box('mast',(-.12,0,1.60),(.21,.24,.56),'asphalt',bevel=.02)
box('mast_base',(-.12,0,1.355),(.42,.42,.07),'uiDark')
for x in [-.27,.03]:
    for y in [-.15,.15]:cyl('mast_bolt',(x,y,1.406),.024,.035,'sidewalk',n=12)
box('controller',(.32,-.12,1.43),(.30,.34,.21),'asphalt',bevel=.025)
box('controller_screen',(.477,-.12,1.44),(.012,.22,.12),'uiDark')
box('controller_indicator',(.488,-.20,1.44),(.01,.027,.065),'emi_survivorRed')
# Board: thick orange shell, separate charcoal bezel, recessed matrix.
box('board_shell',(-.12,0,2.35),(.26,2.64,1.66),'schoolBusYellow',board,.065)
box('bezel',(.022,0,2.35),(.055,2.64,1.66),'asphalt',board,.045)
box('matrix_back',(.057,0,2.35),(.023,2.40,1.43),'uiDark',board,.015)
for y in [-1.218,1.218]:box('inner_rim',(.078,y,2.35),(.025,.018,1.46),'sidewalk',board,.003)
for z in [1.62,3.08]:box('inner_rim',(.078,0,z),(.025,2.44,.018),'sidewalk',board,.003)
# Dark cells are front quads, 4mm above the backing, never coplanar.
verts=[]; faces=[]
for row in range(23):
    for col in range(40):
        y=-1.17+col*.060; z=1.69+row*.060; k=len(verts)
        verts +=[(.073,y-.024,z-.024),(.073,y+.024,z-.024),(.073,y+.024,z+.024),(.073,y-.024,z+.024)]
        faces.append((k,k+1,k+2,k+3))
mesh=bpy.data.meshes.new('matrix_cells'); mesh.from_pydata(verts,[],faces); mesh.update()
o=bpy.data.objects.new('unlit_cells',mesh); bpy.context.collection.objects.link(o); finish(o,'unlit_cells','asphalt',board)
FONT={'S':['01110','10001','10000','01110','00001','10001','01110'],'T':['11111','00100','00100','00100','00100','00100','00100'],'O':['01110','10001','10001','10001','10001','10001','01110'],'P':['11110','10001','10001','11110','10000','10000','10000'],'H':['10001','10001','10001','11111','10001','10001','10001'],'E':['11111','10000','10000','11110','10000','10000','11111'],'R':['11110','10001','10001','11110','10100','10010','10001']}
for word,z0 in [('STOP',2.87),('HERE',2.27)]:
    for ci,ch in enumerate(word):
        for row,line in enumerate(FONT[ch]):
            for col,on in enumerate(line):
                if on=='1':box('LED',(.090,-.93+(ci*6+col)*.081,z0-row*.081),(.020,.059,.059),'emi_schoolBusYellow',board,0)
for y in [-1.26,-.88,-.43,0,.43,.88,1.26]:
    for z in [1.57,3.13]:cyl('bezel_bolt',(.061,y,z),.018,.014,'sidewalk',board,'x',12)
for y in [-1.26,1.26]:
    for z in [1.88,2.35,2.82]:cyl('bezel_bolt',(.061,y,z),.018,.014,'sidewalk',board,'x',12)
for y in [-.9,0,.9]:box('top_hinge',(-.12,y,3.191),(.17,.22,.025),'uiDark',board)
# Axle and independent wheels, with joint-centred origins.
cyl('axle',(-.28,0,.42),.065,1.65,'uiDark',axis='y')
for side in [-1,1]:
    y=side*.73; wheel=empty('wheelL' if side<0 else 'wheelR',(-.28,y,.42),root); parents.append(wheel)
    cyl('tire',(-.28,y,.42),.42,.26,'uiDark',wheel,'y',40)
    cyl('sidewall',(-.28,y+side*.139,.42),.345,.026,'asphalt',wheel,'y',40)
    cyl('rim',(-.28,y+side*.158,.42),.266,.025,'sidewalk',wheel,'y',32)
    cyl('rim_dish',(-.28,y+side*.175,.42),.208,.012,'asphalt',wheel,'y',32)
    cyl('hub',(-.28,y+side*.192,.42),.102,.06,'uiDark',wheel,'y',24)
    for i in range(8):
        t=i*math.tau/8; x=-.28+math.sin(t)*.171; z=.42+math.cos(t)*.171
        cyl('rim_hole',(x,y+side*.186,z),.034,.013,'uiDark',wheel,'y',12)
        cyl('lug',(-.28+math.sin(t)*.12,y+side*.195,.42+math.cos(t)*.12),.016,.02,'sidewalk',wheel,'y',8)
    for i in range(32):
        t=i*math.tau/32
        o=box('tread',(-.28+math.sin(t)*.422,y,.42+math.cos(t)*.422),(.066,.276,.033),'uiDark',wheel,0); o.rotation_euler.y=t
    # Angular fender, with open wheel clearance.
    for start,end in [((-.88,y,.58),(-.62,y,.95)),((-.62,y,.95),(.06,y,.95)),((.06,y,.95),(.32,y,.58))]:
        s,e=Vector(start),Vector(end); o=box('fender',(s+e)/2,((e-s).length,.36,.06),'asphalt',bevel=.015); o.rotation_euler.y=-math.atan2(e.z-s.z,e.x-s.x)
# Four deployed stabilizers and raised diagonal safety bands.
for x in [-.89,.77]:
    for side in [-1,1]:
        y=side*1.07
        box('outrigger',(x,side*.80,.57),(.13,.67,.12),'uiDark')
        box('jack_shaft',(x,y,.40),(.10,.10,.67),'asphalt')
        box('jack_sleeve',(x,y,.60),(.145,.145,.43),'picketWhite')
        box('jack_cap',(x,y,.84),(.18,.18,.07),'asphalt')
        box('foot',(x,y,.045),(.33,.29,.09),'sidewalk',bevel=.015)
        for z in [.47,.65]:
            # bands on both outward faces; clipped parallelogram faces with thickness clearance.
            vs=[(x-.077,y+side*.079,z-.05),(x+.077,y+side*.079,z+.025),(x+.077,y+side*.079,z+.105),(x-.077,y+side*.079,z+.03)]
            me=bpy.data.meshes.new('stripe'); me.from_pydata(vs,[],[(0,1,2,3)]); me.update(); ob=bpy.data.objects.new('stripe',me); bpy.context.collection.objects.link(ob); finish(ob,'stripe','survivorRed',body)
            vs=[(x+.080,y-.077,z-.05),(x+.080,y+.077,z+.025),(x+.080,y+.077,z+.105),(x+.080,y-.077,z+.03)]
            me=bpy.data.meshes.new('stripe_front'); me.from_pydata(vs,[],[(0,1,2,3)]); me.update(); ob=bpy.data.objects.new('stripe_front',me); bpy.context.collection.objects.link(ob); finish(ob,'stripe_front','survivorRed',body)
# A frame tongue and coupler.
for y in [-.44,.44]:beam('tongue',(.60,y,.55),(1.56,0,.50),.105,'asphalt')
box('coupler',(1.64,0,.50),(.38,.18,.13),'sidewalk',bevel=.035)
box('latch',(1.65,0,.595),(.18,.06,.055),'uiDark')
for side in [-1,1]:
    for i in range(9):
        t=i/8; cyl('chain_link',(1.56-.30*t,side*(.10+.12*math.sin(t*math.pi)),.44-.24*math.sin(t*math.pi)),.023,.018,'asphalt',axis='y',n=8)
# Rear lights on independent nodes.
for side in [-1,1]:
    lamp=empty('lampL' if side<0 else 'lampR',(-.92,side*.45,.65),root); parents.append(lamp)
    box('lamp_socket',(-.92,side*.45,.65),(.07,.22,.13),'uiDark',lamp)
    box('red_lens',(-.963,side*.45,.65),(.024,.17,.08),'emi_survivorRed',lamp)
# Join only within materials and movable assemblies.
for parent in parents:
    for mat in M.values():
        obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==parent and o.data.materials[0]==mat]
        if not obs:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join(); obs[0].name=parent.name+'_'+mat.name
for o in bpy.context.scene.objects:
    if o.type=='MESH':
        mat=o.data.materials[0]; o.data.materials.clear(); o.data.materials.append(mat)
        for face in o.data.polygons:face.material_index=0
    if o.type=='MESH' and any(m.name.startswith('emi_') for m in o.data.materials):o['decorativeEmissive']=True
col=empty('col:base',(-.12,0,.85),root); col['collider']='cuboid'; col['shape']='cuboid'; col['size']=[1.6,1.6,1.3]
col=empty('col:board',(-.12,0,2.35),root); col['collider']='cuboid'; col['shape']='cuboid'; col['size']=[.32,2.64,1.66]
# Ground the tread blocks and centre the complete trailer footprint.
for name in ['wheelL','wheelR']:bpy.data.objects[name].location.z+=.0185
for o in list(root.children):o.location.x-=.4275
asset=list(bpy.context.scene.objects); meshes=[o for o in asset if o.type=='MESH']
tri=0
for o in meshes:
    o.data.calc_loop_triangles(); tri+=len(o.data.loop_triangles)
    attr=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
    for d in attr.data:d.color=(1,1,1,1)
report={'id':'prop.stop-here-sign-trailer','tier':'Side','triangles':tri,'draw_calls':len(meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials}),'nodes_ok':all(bpy.data.objects.get(n) is not None for n in ['root','body','sign_board','wheelL','wheelR','lampL','lampR','col:base','col:board']),'within_budget':6000<=tri<=12000 and len(meshes)<=30,'rounds':3,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
if a.glb:
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.seed=28
    scene.render.bake.target='VERTEX_COLORS'; scene.render.bake.use_clear=True
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.data.color_attributes.active_color=o.data.color_attributes['ao']; o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]; bpy.ops.object.bake(type='AO')
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
print('BUILD OK',tri,'triangles',len(meshes),'draw calls')
if a.render:
    scene=bpy.context.scene; world=bpy.data.worlds.new('studio'); scene.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.25,.22,.29,1); world.node_tree.nodes['Background'].inputs[1].default_value=.5
    bpy.ops.mesh.primitive_plane_add(size=200)
    m=bpy.data.materials.new('stage'); m.diffuse_color=(.12,.105,.14,1); bpy.context.object.data.materials.append(m)
    for loc,power,size,color in [((4,-4,7),950,5,(1,.80,.61)),((-3,2,5),650,4,(.72,.80,1))]:
        bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.data.energy=power; o.data.size=size; o.data.color=color; o.rotation_euler=(Vector((0,0,1.6))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(); cam=bpy.context.object; scene.camera=cam; target=Vector((-.1775,0,1.6))
    cam.location={'ref':(7,4,3.5),'game':(7,-7,8),'front':(8,0,1.6),'side':(0,-8,2),'rear':(-7,4,4)}[a.view]
    cam.data.type='ORTHO'; cam.data.ortho_scale=8.2 if a.view=='game' else 6.8; cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.engine='CYCLES'; scene.cycles.samples=a.samples; scene.cycles.use_denoising=True
    scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.view_settings.view_transform='AgX'
    scene.render.filepath=str(Path(a.render).resolve()); bpy.ops.render.render(write_still=True); print('RENDER OK')
