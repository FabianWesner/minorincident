"""Sunset Grove house B. Deterministic, texture-free, metres, +X front, Z up."""
import argparse, json, math, random, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.lod import export_lods, rebuild_from_baked

HERE=Path(__file__).resolve().parent
if '--lod-only' in sys.argv:
    rebuild_from_baked(HERE/'model.glb')
    sys.exit(0)

p=argparse.ArgumentParser()
for f in ['render','glb']: p.add_argument('--'+f)
p.add_argument('--view',default='ref'); p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
rng=random.Random(208)
M={}
for token,h in {'sidewalk':'b9a4a0','picketWhite':'f2e6dc','brick':'a8483a','woodWarm':'b0703f','foliage':'7da23c','grass':'6f8f3a','uiDark':'25222c','schoolBusYellow':'f2b630','survivorRed':'d9363e','windowGlow':'ffc773'}.items():
    rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    col=tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)
    m=bpy.data.materials.new('pal_'+token); m.use_nodes=True
    bs=m.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value=col; bs.inputs['Roughness'].default_value=.78
    M[token]=m
m=M['windowGlow'].copy(); m.name='emi_windowGlow'; bs=m.node_tree.nodes['Principled BSDF']; bs.inputs['Emission Color'].default_value=bs.inputs['Base Color'].default_value; bs.inputs['Emission Strength'].default_value=1.0; M['glow']=m

def empty(name,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc
    if parent:
        bpy.context.view_layer.update(); w=o.matrix_world.copy(); o.parent=parent; o.matrix_world=w
    return o
root=empty('root'); root['asset_id']='bld.house-b'
body=empty('body',parent=root); roof=empty('roof',parent=root); interior=empty('interior',parent=root)
parts=[]
def finish(o,name,mat,parent,bevel=0):
    o.name=name; o.data.materials.append(M[mat])
    if bevel:
        b=o.modifiers.new('soft edges','BEVEL'); b.width=bevel; b.segments=2 if bevel>=.025 else 1
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=b.name)
        n=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=n.name)
    o.parent=parent; o.matrix_parent_inverse=parent.matrix_world.inverted(); parts.append(o); return o

def box(name,loc,size,mat='picketWhite',parent=body,bevel=.025,rot=None):
    sx,sy,sz=[v/2 for v in size]
    vs=[(x,y,z) for x in [-sx,sx] for y in [-sy,sy] for z in [-sz,sz]]
    me=bpy.data.meshes.new(name); me.from_pydata(vs,[],[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)]); me.update()
    o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o); o.location=loc
    if rot:o.rotation_euler=rot
    return finish(o,name,mat,parent,min(bevel,min(size)*.3))
def beam(name,p1,p2,width,mat='picketWhite',parent=body):
    d=Vector(p2)-Vector(p1); o=box(name,(Vector(p1)+Vector(p2))/2,(width,width,d.length),mat,parent)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return o

def poly(name,verts,faces,mat,parent=body):
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o); return finish(o,name,mat,parent,.018)

def gable(name,x0,x1,y0,y1,eave,peak,parent=body):
    mid=(y0+y1)/2
    vs=[(x,y,z) for x in [x0,x1] for y,z in [(y0,eave),(y1,eave),(mid,peak)]]
    return poly(name,vs,[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)],'sidewalk',parent)
# Foundation and clapboard: overlapping boards have stepped, non-coplanar faces.
box('foundation',(0,0,.22),(6.15,5.15,.44),'sidewalk')
for x in [-2.9,2.9]:box('house_wall',(x,0,2.07),(.2,5,3.3),'sidewalk')
for y in [-2.4,2.4]:box('house_wall',(0,y,2.07),(5.8,.2,3.3),'sidewalk')
for z in [.58+i*.27 for i in range(12)]:
    for x in [-3.035,3.035]:box('front_clapboard',(x,0,z),(.075,4.98,.248),'sidewalk',bevel=.012)
    for y in [-2.535,2.535]:box('side_clapboard',(0,y,z),(5.98,.075,.248),'sidewalk',bevel=.012)
gable('front_attic',-3,3,-2.5,2.5,3.72,5.66)
for z in [3.88+i*.25 for i in range(7)]:
    w=5*(5.66-z)/(5.66-3.72)
    for x in [-3.038,3.038]:box('gable_siding',(x,0,z),(.07,max(.1,w),.23),'sidewalk',bevel=.012)
for x in [-3.09,3.09]:
    for y in [-2.51,2.51]:box('corner_trim',(x,y,2.05),(.15,.18,3.42))
box('skirt_front',(3.08,0,.44),(.13,5.15,.16))
# Attached single garage.
box('garage_plinth',(-.3,4.05,.19),(5.6,3.12,.38),'sidewalk')
box('garage_shell',(-.3,4.05,1.55),(5.45,3,2.72),'sidewalk')
for z in [.52+i*.26 for i in range(9)]:
    box('garage_siding',(2.46,4.05,z),(.08,2.98,.24),'sidewalk',bevel=.012)
    box('garage_siding',(-.3,5.59,z),(5.4,.08,.24),'sidewalk',bevel=.012)
gable('garage_attic',-3.025,2.425,2.55,5.55,2.91,4.05)
for y in [2.65,5.48]:box('garage_jamb',(2.55,y,1.5),(.22,.16,2.7))
box('garage_lintel',(2.56,4.06,2.84),(.24,3,.19))
garage=empty('door_garage',(2.49,4.05,2.72),root); garage['joint']='overhead hinge'
box('garage_door',(2.50,4.05,1.52),(.12,2.63,2.36),'picketWhite',garage)
for z in [.68,1.25,1.82]:
    for y in [3.13,4.05,4.97]:
        box('panel_inset',(2.569,y,z),(.025,.77,.42),'sidewalk',garage,.016)
        box('panel_face',(2.59,y,z),(.028,.68,.33),'picketWhite',garage,.018)
for y in [3.14,4.05,4.96]:
    box('garage_glass_bezel',(2.58,y,2.44),(.055,.8,.32),'woodWarm',garage)
    box('garage_glass',(2.616,y,2.44),(.024,.67,.23),'uiDark',garage)
box('garage_handle',(2.66,4.05,1.05),(.06,.27,.045),'uiDark',garage)
# Tiled roofs: each shingle has actual thickness and rounded visible edges.
def tiled_roof(name,x0,x1,ymid,ends,peak,parent=roof):
    for end,eave in ends:
        dy=end-ymid; dz=eave-peak; length=math.hypot(dy,dz); ang=math.atan2(dz,dy)
        box(name+'_deck',((x0+x1)/2,(ymid+end)/2,(peak+eave)/2),(x1-x0,length,.12),'brick',parent,.025,(ang,0,0))
        rows=math.ceil(length/.36); cols=math.ceil((x1-x0)/.52)
        for row in range(rows):
            t=(row+.5)/rows
            for col in range(cols):
                xx=x0+(col+.5)*(x1-x0)/cols
                yy=ymid+dy*t; zz=peak+dz*t+.085
                box('clay_tile',(xx,yy,zz),((x1-x0)/cols-.015,length/rows-.018,.065),'brick',parent,.022,(ang,0,0))
        beam('eave_fascia',(x0,end,eave-.08),(x1,end,eave-.08),.18,parent=parent)
        for x in [x0,x1]:beam('rake_trim',(x,ymid,peak-.04),(x,end,eave-.07),.17,parent=parent)
    for i in range(math.ceil((x1-x0)/.5)):
        xx=x0+(i+.5)*(x1-x0)/math.ceil((x1-x0)/.5)
        box('ridge_cap',(xx,ymid,peak+.13),(.48,.25,.12),'brick',parent,.05)
tiled_roof('main',-3.28,3.29,0,[(-4.08,2.94),(2.79,3.58)],5.8)
tiled_roof('garage',-3.25,2.70,4.06,[(2.37,2.99),(5.75,2.99)],4.22)
# Dormer faces the porch side (-Y), with its own tiled gable roof.
box('dormer_wall',(-.6,-2.48,4.48),(1.75,1.28,1.38),'sidewalk',roof)
# Dormer triangular top, ridge along Y.
vs=[(x,y,z) for y in [-3.13,-1.7] for x,z in [(-1.52,5.1),(.32,5.1),(-.6,5.82)]]
poly('dormer_gable',vs,[(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)],'sidewalk',roof)
for z in [4.04,4.31,4.58,4.85]:box('dormer_siding',(-.6,-3.145,z),(1.75,.06,.24),'sidewalk',roof,.012)
# roof helper works along X; rotate this little assembly 90 degrees around dormer.
droof=empty('dormer_roof',parent=roof)
start=len(parts); tiled_roof('dormer',-1.45,.2,0,[(-1.05,5.12),(1.05,5.12)],5.86,droof)
for o in parts[start:]:
    x,y,z=o.location; o.location=(-.6-y,-2.45+x,z); o.rotation_euler.z+=math.pi/2
# Windows all built from deeply layered bezels, bright panes, mullions and sills.
def window(name,pos,w,h,side=False,parent=body,shutters=False):
    x,y,z=pos
    def b(n,u,v,d,sz,mat):
        loc=(x+d*(1 if x>0 else -1),y+u,z+v) if not side else (x+u,y+d*(1 if y>0 else -1),z+v)
        size=(sz[2],sz[0],sz[1]) if not side else (sz[0],sz[2],sz[1])
        return box(n,loc,size,mat,parent,.014)
    b(name+'_recess',0,0,.012,(w+.18,h+.18,.075),'woodWarm')
    b(name+'_glow',0,0,.065,(w,h,.04),'glow')
    for u in [-w/2-.075,w/2+.075]:b('window_casing',u,0,.125,(.15,h+.29,.15),'picketWhite')
    for v in [-h/2-.09,h/2+.09]:b('window_casing',0,v,.13,(w+.3,.16,.17),'picketWhite')
    for u in ([-w/2,-w/4,0,w/4,w/2] if name=='front_double' else [-w/2,w/2,0]):b('sash_vertical',u,0,.13,(.055,h,.065),'woodWarm')
    for v in ([-h/2,-h/6,h/6,h/2] if name=='front_double' else [-h/2,h/2,0]):b('sash_horizontal',0,v,.145,(w,.055,.06),'woodWarm')
    if name=='front_double':b('paired_window_post',0,0,.175,(.11,h+.1,.13),'picketWhite')
    b('deep_sill',0,-h/2-.17,.18,(w+.43,.12,.33),'picketWhite')
    if shutters:
        for u in [-w/2-.38,w/2+.38]:
            b('shutter',u,0,.13,(.37,h,.12),'grass')
            for v in [-h/2+.09+i*.19 for i in range(int(h/.19))]:b('shutter_louver',u,v,.205,(.28,.065,.055),'foliage')
    anchor=empty('light:'+name,pos,parent)
    anchor['ss_light']=json.dumps({'type':'window','color':'light_window_warm','intensity':1.2,'range':3,'pool':True,'beam':'none','flare':False,'reflect':True,'shadow':'none','heroPriority':0,'flicker':'none','animation':None,'powerGroup':'sunset-grove-residential','breakable':True,'emissiveNodes':[parent.name+'_emi_windowGlow'],'tiers':'all'})
    anchor.rotation_euler=(math.pi/2,0,0) if side else (0,-math.pi/2,0)
window('front_double',(3.09,-.65,2.03),2.10,1.91,shutters=True)
window('front_right',(3.09,1.67,2.12),.73,1.58)
window('porch_window',(-1.5,-2.57,1.92),.84,1.66,True)
window('dormer_window',(-.6,-3.18,4.47),.95,1.15,True,roof)
window('back_window',(-3.09,-.9,2.05),1.4,1.6)
window('right_window',(-.8,2.57,2.18),1.2,1.5,True)
# Front gable louver vent.
box('attic_vent_frame',(3.13,0,4.65),(.16,.48,.66))
box('attic_vent_dark',(3.23,0,4.65),(.04,.34,.51),'uiDark')
for z in [4.43+i*.065 for i in range(8)]:box('vent_louver',(3.27,0,z),(.06,.34,.03),'sidewalk',bevel=.008)
# Side porch and hinged entrance.
box('porch_base',(.3,-3.37,.31),(5.45,1.65,.62),'sidewalk')
for i in range(16):box('porch_floor_board',(-2.3+i*.335,-3.37,.647),(.318,1.54,.07),'woodWarm',bevel=.013)
for x in [-2.26,2.77]:
    box('porch_post',(x,-3.94,1.80),(.20,.20,2.3))
    box('post_plinth',(x,-3.94,.76),(.32,.32,.24))
    box('post_cap',(x,-3.94,2.91),(.3,.3,.14))
for x in [-2.30,-.80,2.74]:
    box('rail_post',(x,-4.05,1.12),(.23,.23,.96))
    box('rail_cap',(x,-4.05,1.64),(.32,.31,.09))
for l,r in [(-2.3,-.8),(1.1,2.74)]:
    for z in [.83,1.48]:box('porch_rail',((l+r)/2,-4.05,z),(r-l,.14,.14))
    for i in range(1,int((r-l)/.20)):
        box('baluster',(l+i*.20,-4.05,1.15),(.065,.075,.62))
for j in range(3):box('porch_step',(.2,-4.35-j*.28,.51-j*.16),(1.76,.57,.18),'woodWarm')
box('step_bottom',(.2,-5.0,.07),(1.95,.32,.14),'sidewalk')
door=empty('door_entry',(.15,-2.65,.71),root); door['joint']='hinge_z'
box('entry_door',(.67,-2.655,1.77),(1.02,.13,2.10),'woodWarm',door)
for xx in [.46,.89]:
    box('door_upper_pane',(xx,-2.735,2.15),(.34,.025,.9),'glow',door)
    box('door_lower_panel',(xx,-2.74,1.16),(.33,.035,.48),'brick',door)
for z in [1.68,2.15,2.66]:box('door_crossbar',(.67,-2.77,z),(1.02,.065,.06),'woodWarm',door)
for xx in [.12,1.22]:box('entry_jamb',(xx,-2.70,1.77),(.14,.20,2.24))
box('door_header',(.67,-2.7,2.92),(1.24,.21,.17))
box('knob',(.98,-2.82,1.65),(.09,.09,.09),'uiDark',door,.03)
# Brick chimney, offset masonry courses and pale stone crown.
box('chimney_core',(-1.62,.8,5.73),(.65,.68,1.64),'brick',roof)
for row in range(7):
    for j in range(2):
        xx=-1.79+j*.34
        box('chimney_brick',(xx,.445,5.07+row*.205),(.31,.065,.18),'brick',roof,.015)
        box('chimney_brick',(-1.97,.62+j*.34,5.07+row*.205),(.065,.31,.18),'brick',roof,.015)
box('chimney_crown',(-1.62,.8,6.61),(.86,.88,.20),'picketWhite',roof)
box('chimney_flue',(-1.62,.8,6.745),(.48,.48,.09),'brick',roof)
box('flue_opening',(-1.62,.8,6.795),(.34,.34,.018),'uiDark',roof,.006)
# Attached porch and garage lanterns, separated at wall mount.
for name,pos in [('porch',(-.56,-2.8,2.45)),('garage',(2.7,5.49,2.45))]:
    lamp=empty('lamp_'+name,pos,root); x,y,z=pos
    box('lantern_glow',(x,y,z),(.17,.17,.33),'glow',lamp)
    for dz in [-.20,.20]:box('lantern_cap',(x,y,z+dz),(.25,.25,.09),'woodWarm',lamp)
    for dx in [-.105,.105]:
        for dy in [-.105,.105]:box('lantern_bar',(x+dx,y+dy,z),(.025,.025,.35),'uiDark',lamp,.007)
    beam('lamp_mount',(x,y,z+.25),(x-.12,y+.10,z+.39),.055,'uiDark',lamp)
    anchor=empty('light:'+name,pos,lamp); anchor['ss_light']=json.dumps({'type':'point','color':'light_window_warm','intensity':2,'range':3,'pool':True,'beam':'none','flare':True,'reflect':True,'shadow':'none','heroPriority':0,'flicker':'none','animation':None,'powerGroup':'sunset-grove-residential','breakable':True,'emissiveNodes':[lamp.name+'_emi_windowGlow'],'tiers':'all'})
# Raised garden beds, tapered pots, dense purposeful leaf clusters and flowers.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1)
leaf_template=bpy.context.object.data.copy(); bpy.data.objects.remove(bpy.context.object,do_unlink=True)
def leaf(loc,size,mat):
    me=leaf_template.copy(); o=bpy.data.objects.new('leaf',me); bpy.context.collection.objects.link(o); o.location=loc
    for v in me.vertices:
        for axis in range(3):v.co[axis]*=size[axis]
    o.rotation_euler=(rng.uniform(-.8,.8),rng.uniform(-.8,.8),rng.uniform(0,6.28))
    return finish(o,'leaf',mat,body)
def shrub(x,y,z,r,h,flowers=0):
    for i in range(65):
        ang=rng.random()*6.28; zz=rng.random()*h; radius=r*math.sqrt(rng.random())*(1-.5*zz/h)
        leaf((x+math.cos(ang)*radius,y+math.sin(ang)*radius,z+zz),(.10,.22,.055),'foliage' if i%3 else 'grass')
    for i in range(flowers):
        ang=rng.random()*6.28; rr=r*rng.uniform(.35,.85); cx=x+math.cos(ang)*rr; cy=y+math.sin(ang)*rr; cz=z+h*rng.uniform(.5,.95)
        mat=['survivorRed','picketWhite','schoolBusYellow'][i%3]
        for j in range(5):leaf((cx+.075*math.cos(j*6.28/5),cy+.075*math.sin(j*6.28/5),cz),(.085,.055,.046),mat)
        leaf((cx,cy,cz+.025),(.035,.035,.035),'schoolBusYellow')
for y,w in [(-1.91,.85),(.97,.85),(3.9,2.4)]:
    box('garden_bed',(3.5,y,.16),(.9,w,.32),'woodWarm')
    box('soil',(3.5,y,.334),(.75,w-.12,.035),'uiDark',bevel=.005)
shrub(3.5,-1.95,.35,.45,1.67,3); shrub(3.5,1.02,.35,.5,1.9,4)
for y in [-1.1,-.35,.32,3.08,3.86,4.65]:shrub(3.5,y,.35,.41,.62,7)
for x,y in [(-1.7,-4.25),(1.85,-4.28),(2.7,-4.16)]:shrub(x,y,.12,.48,.85,8)
for x in [-1.52,-.5]:
    box('window_flower_box',(3.37,x,.88),(.40,.72,.23),'woodWarm')
    shrub(3.44,x,.98,.32,.40,6)
for x,y in [(-1.7,-3.45),(1.8,-3.3)]:
    bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=.19,radius2=.25,depth=.37,location=(x,y,.86)); finish(bpy.context.object,'terracotta_pot','woodWarm',body,.016)
    shrub(x,y,1.02,.27,.39,3)
# Interior floors remain independent for roof cutaway.
box('ground_floor',(0,0,.47),(5.8,4.8,.10),'woodWarm',interior)
box('attic_floor',(0,0,3.6),(5.8,4.8,.12),'woodWarm',interior)
for name,loc,size in [('house',(0,0,1.9),(6,5,3.8)),('garage',(-.3,4.05,1.5),(5.45,3,3))]:
    col=empty('col:'+name,loc,root); col['collider']='cuboid'; col['shape']='cuboid'; col['size']=list(size)
# Merge only within assemblies, so roof removal and hinges remain functional.
parents={o.parent for o in parts}
for parent in sorted(parents,key=lambda o:o.name):
    for mat in M.values():
        obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==parent and o.data.materials[0]==mat]
        if not obs:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join(); obs[0].name=parent.name+'_'+mat.name
asset=list(bpy.context.scene.objects); meshes=[o for o in asset if o.type=='MESH']
for o in meshes:
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    bm=bmesh.new(); bm.from_mesh(o.data); bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='FIXED',ngon_method='EAR_CLIP'); bm.to_mesh(o.data); bm.free()
# Actual deterministic Cycles vertex AO on export, with no image maps.
if a.glb:
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.seed=208
    scene.render.bake.target='VERTEX_COLORS'; scene.render.bake.use_clear=True
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        attr=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER'); o.data.color_attributes.active_color=attr; o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]; bpy.ops.object.bake(type='AO')
tri=0
for o in meshes:o.data.calc_loop_triangles(); tri+=len(o.data.loop_triangles)
report={'id':'bld.house-b','tier':'Hero','triangles':tri,'draw_calls':len(meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials}),'nodes_ok':all(bpy.data.objects.get(n) for n in ['root','roof','interior','door_entry','door_garage']),'within_budget':tri<=100000 and len(meshes)<=40,'rounds':3,'webgpu_ok':False,'webgl2_ok':False,'gaps':['Rear facade inferred from the single reference view; interior is unfurnished.']}
(HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset:o.select_set(True)
    def export_glb(path):
        bpy.ops.export_scene.gltf(filepath=str(path.resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    export_glb(Path(a.glb))
    export_lods(Path(a.glb), meshes)

print('BUILD OK',tri,'triangles',len(meshes),'draw calls')
if a.render:
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=a.samples; scene.cycles.use_denoising=True
    scene.cycles.seed=208
    world=bpy.data.worlds.new('studio'); scene.world=world; world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.25,.21,.30,1); world.node_tree.nodes['Background'].inputs[1].default_value=.4
    bpy.ops.mesh.primitive_plane_add(size=200); floor=bpy.context.object; floor.name='studio_floor'
    m=bpy.data.materials.new('studio'); m.use_nodes=True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.028,.022,.035,1); floor.data.materials.append(m); floor.location.z=-.035
    for loc,power,size,col in [((7,-8,12),2100,7,(1,.79,.58)),((-5,-2,9),1600,6,(.68,.76,1)),((0,7,11),1800,5,(1,.70,.44))]:
        bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.data.energy=power; o.data.size=size; o.data.color=col; o.rotation_euler=(Vector((0,0,2))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(); cam=bpy.context.object; scene.camera=cam; target=Vector((0,.25,2.9))
    views={'ref':(12,-17,12),'game':(14,-14,20),'front':(18,0,7),'side':(0,-19,8),'rear':(-14,13,11)}
    cam.location=views[a.view]; cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=17.7
    prefs=bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type='METAL'; prefs.get_devices()
    for d in prefs.devices:d.use=True
    scene.cycles.device='GPU'; scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'; scene.render.filepath=str(Path(a.render).resolve()); bpy.ops.render.render(write_still=True)
    if a.view=='ref':
        cam.location=views['game']; cam.data.ortho_scale=19.2; cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.render.resolution_x=960; scene.render.resolution_y=540; scene.cycles.samples=24
        game_path=Path(a.render).with_name('game.png' if Path(a.render).stem=='hero' else Path(a.render).stem.replace('-ref','')+'-game.png')
        scene.render.filepath=str(game_path.resolve()); bpy.ops.render.render(write_still=True)
    print('RENDER OK')
