"""Deterministic Sunset Grove supermarket cutaway. Run via blender_run.py."""
import bpy, math, sys, json, random
from pathlib import Path
from mathutils import Vector
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parents[1] / 'tools/blender'))
from sslib import palette, ao
ASSET = {'id': 'int.supermarket', 'category': 'building'}
ARGS = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def arg(key, default=None):
    return ARGS[ARGS.index(key)+1] if key in ARGS else default
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
rng = random.Random(74)
mesh_cache = {}
static = []
def empty(name, loc=(0,0,0), parent=None):
    o = bpy.data.objects.new(name, None); scene.collection.objects.link(o)
    o.location = loc; o.parent = parent
    return o
root = empty('root'); root['assetId'] = ASSET['id']; root['forward'] = '+X'
interior = empty('interior', parent=root)
def finish(o, name, token, bevel=0, parent=None):
    o.name = name; o.data.materials.append(palette.mat({'light_window_warm':'windowGlow','light_fluorescent':'picketWhite'}.get(token,token), token.startswith('light_')))
    if bevel:
        m = o.modifiers.new('Soft edges', 'BEVEL'); m.width = bevel; m.segments = 1 if bevel <= .012 else 2
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier=m.name)
        m = o.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); m.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=m.name)
    o.parent = parent or interior
    if parent is None: static.append(o)
    return o
def cached(name, key, loc, rot, parent):
    if key not in mesh_cache: return None
    o=bpy.data.objects.new(name,mesh_cache[key]); scene.collection.objects.link(o)
    o.location=loc; o.rotation_euler=rot; o.parent=parent or interior
    if parent is None: static.append(o)
    return o
def box(name, loc, size, token, bevel=.018, parent=None):
    key=('box',tuple(size),token,bevel)
    o=cached(name,key,loc,(0,0,0),parent)
    if o: return o
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o=bpy.context.object
    o.scale=size; bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(o,name,token,min(bevel,min(size)*.2),parent); mesh_cache[key]=o.data
    return o
def cyl(name, loc, radius, depth, token, rot=(0,0,0), vertices=12, parent=None):
    key=('cylinder',radius,round(depth,6),token,vertices)
    o=cached(name,key,loc,rot,parent)
    if o: return o
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    o=finish(bpy.context.object,name,token,min(.008,radius*.25,depth*.2) if depth>.025 else 0,parent); mesh_cache[key]=o.data
    return o
def rod(name,a,b,r,token,parent=None):
    d=Vector(b)-Vector(a); o=cyl(name,(Vector(a)+Vector(b))/2,r,d.length,token,parent=parent)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return o
def text(name, words, loc, size, token, face='x', parent=None):
    bpy.ops.object.text_add(location=loc); o=bpy.context.object; o.name=name
    o.data.body=words; o.data.size=size; o.data.align_x='CENTER'; o.data.align_y='CENTER'
    o.data.extrude=.002; o.data.bevel_depth=.0005; o.data.resolution_u=3
    o.rotation_euler=(math.pi/2,0,math.pi/2) if face=='x' else (math.pi/2,0,0)
    bpy.ops.object.convert(target='MESH'); return finish(bpy.context.object,name,token,0,parent)
def pivot(name, loc):
    o=empty(name,loc,interior); o['animatable']=True; return o
def anchor(name,loc,meshes,color='light_fluorescent'):
    o=empty('light:'+name,loc,root)
    o['ss_light']=json.dumps({'type':'area','color':color,'intensity':2.5,'range':5,'pool':True,'beam':'none','flare':False,'reflect':True,'shadow':'none','heroPriority':0,'flicker':'none','animation':None,'powerGroup':'supermarket','breakable':True,'emissiveNodes':meshes,'tiers':'all'})
# The thin tile gaps reveal a solid grout bed; each tile has its own bevel.
box('slab',(0,0,.13),(8.4,9,.26),'asphalt',.04)
box('grout',(0,0,.285),(8.35,8.95,.05),'sidewalk',.01)
for i in range(12):
    for j in range(13):
        box('floor_tile',(-3.85+i*.7,-4.18+j*.69,.325),(.687,.677,.065),'skinBlush' if (i+j)%4 else 'sidewalk',.012)
# Open +X and -Y sides. Tile seams in the warm peach walls.
for z in range(5):
    for j in range(11):
        box('wall_tile',(-4.08,-4.1+j*.81,.65+z*.6),(.18,.802,.592),'skinWarm',.009)
    for i in range(10):
        box('wall_tile',(-3.65+i*.81,4.38,.65+z*.6),(.802,.18,.592),'skinWarm',.009)
box('left_wall_cap',(-4.08,0,3.39),(.23,8.9,.09),'sidewalk')
box('back_wall_cap',(0,4.38,3.39),(8.4,.23,.09),'sidewalk')
# Sign and warm staff doorway on the left wall.
box('poster_border',(-3.946,.5,2.2),(.11,2.08,2.18),'foliage',.025)
box('poster_face',(-3.881,.5,2.2),(.025,1.9,2.0),'grass',.01)
text('fresh_food','FRESH\nFOOD\nBETTER\nDAYS',(-3.858,.5,2.26),.30,'picketWhite')
box('staff_recess',(-3.94,2.49,1.72),(.13,1.05,2.55),'uiDark')
box('staff_light',(-3.86,2.49,1.72),(.022,.86,2.34),'light_window_warm',.01)
box('staff_sill',(-3.73,2.49,.54),(.38,1.18,.12),'woodWarm')
anchor('staff',(-3.6,2.49,2.2),['static_emi_windowGlow'],'light_window_warm')
products=['survivorRed','schoolBusYellow','policeBlue','backpackTeal','foliage','woodWarm']
def package(x,y,z,color,face='x',size=(.26,.26,.32),detail=True):
    box('carton',(x,y,z),size,color,.024)
    if detail:
        if face=='x':
            box('carton_label',(x+size[0]/2+.010,y,z-.015),(.012,size[1]*.62,size[2]*.4),'picketWhite',0)
            box('carton_brand',(x+size[0]/2+.019,y,z),(.008,size[1]*.30,size[2]*.12),'schoolBusYellow',0)
        else:
            box('carton_label',(x,y-size[1]/2-.010,z-.015),(size[0]*.62,.012,size[2]*.4),'picketWhite',0)
            box('carton_brand',(x,y-size[1]/2-.019,z),(size[0]*.3,.008,size[2]*.12),'schoolBusYellow',0)
def shelf(name,x,y,length,height=2.05,depth=.65,rows=4):
    box(name+'_back',(x-depth/2+.05,y,.38+height/2),(.1,length,height),'woodWarm')
    for end in [-1,1]:
        box(name+'_end',(x,y+end*(length/2-.055),.38+height/2),(depth,.11,height),'woodWarm',.04)
        box(name+'_cap',(x,y+end*(length/2-.055),.38+height),(depth+.04,.14,.14),'survivorRed',.035)
    n=int((length-.2)/.3)
    for row in range(rows):
        z=.52+row*.43
        box(name+'_shelf',(x,y,z),(depth,length-.12,.07),'sidewalk',.014)
        box(name+'_price_rail',(x+depth/2+.008,y,z+.027),(.035,length-.14,.075),'picketWhite',.006)
        for k in range(n):
            py=y-(n-1)*.3/2+k*.3
            package(x+.04,py,z+.2,products[(k+row*2)%6],size=(depth*.59,.25,.30))
            if k%2==0:
                box('price_label',(x+depth/2+.03,py,z+.03),(.009,.15,.052),'schoolBusYellow',.002)
                for d in range(3):
                    box('barcode',(x+depth/2+.038,py-.045+d*.03,z+.03),(.006,.009,.029),'uiDark',0)
    for k in range(n):
        package(x,y-(n-1)*.3/2+k*.3,.38+height+.12,products[(k+1)%6],size=(.30,.25,.24))
shelf('wall_shelf',-3.52,-2.01,2.6,1.95)
shelf('aisle_one',-1.6,.38,4.25)
shelf('aisle_two',1.7,1.05,3.55)
# Small end-cap impulse rack, offset from the aisle panels.
for z in [.82,1.35]:
    box('endcap_tray',(-1.56,-1.86,z),(.75,.34,.09),'asphalt',.025)
    for i in range(3): package(-1.84+i*.25,-1.92,z+.13,products[i],face='y',size=(.2,.22,.2))
# Six refrigerator bays with individual hinge origins; no invisible solid glass panes.
for i in range(6):
    x=-2.55+i*1.03
    box('refrigerator_housing',(x,3.99,1.77),(1.02,.61,2.77),'asphalt',.035)
    box('cold_back',(x,3.664,1.79),(.89,.028,2.53),'policeBlue',.01)
    for row in range(4):
        z=.65+row*.57
        box('cold_shelf',(x,3.59,z),(.87,.55,.048),'picketWhite',.01)
        for k in range(3):
            if (i+row)%2:
                px=x+(k-1)*.25
                cyl('juice_bottle',(px,3.52,z+.20),.094,.31,products[(i+k+row)%6],vertices=10)
                cyl('bottle_cap',(px,3.52,z+.373),.058,.035,'picketWhite',vertices=10)
                box('bottle_label',(px,3.419,z+.2),(.11,.012,.12),'picketWhite',.004)
            else:
                package(x+(k-1)*.25,3.52,z+.21,products[(i+k+row)%6],face='y',size=(.22,.20,.35))
    box('cold_light',(x,3.59,3.00),(.84,.06,.04),'light_fluorescent',.008)
    door=pivot('door_fridge_%02d'%i,(x-.48,3.28,.4))
    box('door_glass',(.48,.025,1.36),(.90,.018,2.61),'tealLight',0,door)
    for dx in [0,.96]: box('door_frame',(dx,0,1.36),(.045,.075,2.72),'asphalt',.01,door)
    for zz in [.025,2.69]: box('door_frame',(.48,0,zz),(.99,.075,.05),'asphalt',.01,door)
    rod('door_handle',(.84,-.11,1.08),(.84,-.11,1.62),.025,'sidewalk',door)
    for zz in [1.08,1.62]: rod('handle_mount',(.84,0,zz),(.84,-.11,zz),.018,'sidewalk',door)
    anchor('cold_%02d'%i,(x,3.4,2.8),['static_emi_picketWhite'])
# Chest freezer: recessed bins, raised rim and hinged sliding lid frames.
box('freezer_plinth',(1.02,-2.78,.48),(3.4,1.53,.25),'asphalt',.05)
box('freezer_body',(1.02,-2.78,.98),(3.4,1.53,.88),'sidewalk',.06)
box('freezer_sign',(1.02,-3.565,1.03),(3.18,.04,.71),'policeBlue',.018)
text('frozen','FROZEN',(1.12,-3.592,1.04),.37,'light_fluorescent','y')
text('snowflake','*',(-.22,-3.592,1.02),.64,'light_fluorescent','y')
box('freezer_well',(1.02,-2.78,1.43),(3.2,1.32,.09),'backpackTeal',.02)
for i in range(10):
    for j in range(3): package(-.4+i*.31,-3.2+j*.37,1.50,products[(i+j)%6],face='y',size=(.27,.31,.10))
for i in range(2):
    lid=pivot('door_freezer_%02d'%i,(-.65+i*1.69,-2.02,1.60))
    for yy in [0,-1.48]: box('lid_rim',(.84,yy,0),(1.7,.065,.08),'asphalt',.014,lid)
    for xx in [0,1.67]: box('lid_rim',(xx,-.74,0),(.065,1.48,.08),'asphalt',.014,lid)
    box('lid_handle',(.84,-1.38,.07),(.30,.05,.06),'asphalt',.015,lid)
box('freezer_led',(1.02,-2.76,1.57),(3.1,.035,.03),'light_fluorescent',.006)
anchor('frozen',(1,-3.7,1.1),['static_emi_picketWhite'])
# Produce endcap with divided crates, loose fruit, bananas and bags.
box('produce_base',(-2.85,-3.35,.81),(1.85,.82,.86),'woodWarm',.035)
for row in range(2):
    for k in range(6): package(-3.59+k*.29,-3.71,.55+row*.32,products[(k+row)%6],face='y',size=(.25,.16,.26))
for k in range(4):
    x=-3.53+k*.44
    box('crate_floor',(x,-3.35,1.29),(.42,.73,.07),'woodWarm')
    for yy in [-3.7,-3.0]: box('crate_rail',(x,yy,1.4),(.43,.035,.20),'woodWarm',.009)
    for xx in [x-.21,x+.21]: box('crate_divider',(xx,-3.35,1.4),(.035,.73,.20),'woodWarm',.009)
    for j in range(6):
        px=x+((j%2)-.5)*.16; py=-3.55+(j//2)*.20
        if k==1:
            bpy.ops.mesh.primitive_uv_sphere_add(segments=10,ring_count=6,radius=.115,location=(px,py,1.52))
            finish(bpy.context.object,'apple','survivorRed'); rod('stem',(px,py,1.62),(px,py,1.67),.012,'woodWarm')
        else: package(px,py,1.51, ['foliage','survivorRed','schoolBusYellow','backpackTeal'][k],size=(.13,.15,.23),detail=False)
# Compact checkout in the rear aisle, with conveyor, register, scanner and bagging tray.
box('checkout_pedestal',(.03,2.28,.90),(.88,1.55,1.05),'backpackTeal',.04)
box('checkout_counter',(.03,2.28,1.47),(1.0,1.75,.12),'sidewalk',.04)
box('conveyor',(.03,2.6,1.546),(.70,.86,.025),'uiDark',.015)
for i in range(6): box('belt_seam',(.03,2.26+i*.13,1.563),(.65,.009,.008),'asphalt',0)
box('scanner',(.03,1.95,1.58),(.42,.24,.06),'uiDark')
box('scanner_window',(.03,1.95,1.615),(.24,.15,.012),'survivorRed',.005)
rod('register_post',(.34,1.7,1.51),(.34,1.7,1.86),.035,'asphalt')
box('register',(.34,1.7,1.94),(.36,.13,.27),'asphalt',.025)
box('register_display',(.34,1.625,1.94),(.29,.018,.19),'backpackTeal',.008)
text('register_price','8.99',(.34,1.61,1.94),.078,'picketWhite','y')
box('bag',(-.27,1.65,1.74),(.26,.3,.4),'schoolBusYellow',.025)
rod('lane_post',(.46,2.9,1.5),(.46,2.9,3.39),.023,'asphalt')
box('lane_sign',(.46,2.9,2.91),(.13,.62,.63),'uiDark',.025)
text('lane_number','2',(.536,2.9,2.91),.5,'picketWhite')
# Wire shopping cart in the foreground: open basket, undercarriage, separate rolling wheels.
cx,cy=-1.5,-3.45
for z in [.70,1.38]:
    for x in [cx-.38,cx+.38]: rod('cart_rim',(x,cy-.52,z),(x,cy+.52,z),.025,'asphalt')
    for y in [cy-.52,cy+.52]: rod('cart_rim',(cx-.38,y,z),(cx+.38,y,z),.025,'asphalt')
for i in range(9):
    y=cy-.5+i*.125
    for x in [cx-.38,cx+.38]: rod('cart_wire',(x,y,.70),(x,y,1.38),.009,'sidewalk')
    rod('basket_floor',(cx-.38,y,.71),(cx+.38,y,.71),.010,'sidewalk')
for i in range(7):
    x=cx-.36+i*.12
    for y in [cy-.52,cy+.52]: rod('cart_wire',(x,y,.70),(x,y,1.38),.009,'sidewalk')
for z in [.9,1.13]:
    for x in [cx-.38,cx+.38]: rod('cart_crosswire',(x,cy-.52,z),(x,cy+.52,z),.009,'sidewalk')
    for y in [cy-.52,cy+.52]: rod('cart_crosswire',(cx-.38,y,z),(cx+.38,y,z),.009,'sidewalk')
for x in [cx-.33,cx+.33]:
    rod('cart_leg',(x,cy+.48,.46),(x,cy+.52,1.39),.028,'asphalt')
    rod('cart_chassis',(x,cy-.5,.51),(x,cy+.57,.51),.028,'asphalt')
rod('cart_handle',(cx-.4,cy+.66,1.40),(cx+.4,cy+.66,1.40),.045,'survivorRed')
for ix in [-1,1]:
    for iy in [-1,1]:
        p=pivot('wheel_cart_%s_%s'%(ix,iy),(cx+ix*.33,cy+iy*.45,.47))
        cyl('wheel',(0,0,0),.12,.09,'uiDark',(0,math.pi/2,0),16,p)
        cyl('wheel_hub',(.049,0,0),.047,.008,'uiDark',(0,math.pi/2,0),12,p)
# Wet-floor A frame with raised hazard graphics.
for angle,y in [(-.20,-3.75),(.20,-3.43)]:
    o=box('caution_board',(3.03,y,.83),(.6,.06,.92),'schoolBusYellow',.018); o.rotation_euler.x=angle
o=text('hazard','!',(3.03,-3.801,.84),.40,'uiDark','y'); o.rotation_euler.x-=.2
o=text('wet_floor','CAUTION',(3.03,-3.850,.58),.083,'uiDark','y'); o.rotation_euler.x-=.2
rod('sign_hinge',(2.75,-3.58,1.28),(3.31,-3.58,1.28),.035,'woodWarm')
# Abandoned products and deterministic raised blood pools; no coplanar decals.
for x,y in [(-.4,-1.4),(.2,-1.8),(2.9,-4.0),(-.2,-4.0)]:
    o=box('fallen_goods',(x,y,.49),(.34,.28,.26),products[rng.randrange(6)],.035); o.rotation_euler.z=rng.uniform(-1,1)
for cx,cy,scale in [(1,-3.88,1.25),(-2,-2.35,.48),(-.3,-1.1,.28)]:
    # One contiguous raised pool avoids overlapping, almost-coplanar decal faces.
    outline=[]
    for j in range(32):
        angle=j*math.tau/32; radius=scale*rng.uniform(.65,1)
        outline.append((cx+math.cos(angle)*radius,cy+math.sin(angle)*radius*.32))
    vertices=[(x,y,z) for z in [.367,.377] for x,y in outline]
    faces=[tuple(range(31,-1,-1)),tuple(range(32,64))]
    faces += [(j,(j+1)%32,(j+1)%32+32,j+32) for j in range(32)]
    data=bpy.data.meshes.new('wet_pool'); data.from_pydata(vertices,[],faces); data.update()
    o=bpy.data.objects.new('blood_pool',data); scene.collection.objects.link(o); finish(o,'blood_pool','blood')
    for j in range(18):
        angle=j*math.tau/18; radius=scale*rng.uniform(1.12,1.34)
        x=cx+math.cos(angle)*radius; y=max(-4.39,cy+math.sin(angle)*radius*.32)
        o=cyl('blood_droplet',(x,y,.371),rng.uniform(.02,.045)*scale,.010,'blood',vertices=8)
        o.scale.y=.65
# Collider extras are empties, never visible meshes.
for name,loc,size in [('floor',(0,0,.16),(8.4,9,.32)),('wall_left',(-4.08,0,1.8),(.2,9,3.2)),('wall_back',(0,4.38,1.8),(8.4,.2,3.2)),('shelf_one',(-1.6,.38,1.4),(.7,4.25,2.1)),('shelf_two',(1.7,1.05,1.4),(.7,3.55,2.1)),('freezer',(1.02,-2.78,.95),(3.4,1.53,1.2))]:
    o=empty('col:'+name,loc,root); o['collider']='cuboid'; o['size']=list(size)
# Make cached instances independent before join/origin operators mutate mesh data.
for o in list(scene.objects):
    if o.type=='MESH': o.data=o.data.copy()
bpy.context.view_layer.update()
# Static geometry is joined by palette; motion groups retain their hinge/wheel origins.
def join(objects,name,parent):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join()
    o=bpy.context.object; o.name=name; o.parent=parent
    scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR'); return o
groups={}
for o in static: groups.setdefault(o.data.materials[0].name,[]).append(o)
for mat,objects in sorted(groups.items()): join(objects,'static_'+mat,interior)
for p in list(interior.children):
    if p.type=='EMPTY' and p.get('animatable'):
        children=[o for o in p.children if o.type=='MESH']
        if children:
            bpy.ops.object.select_all(action='DESELECT')
            for o in children: o.select_set(True)
            bpy.context.view_layer.objects.active=children[0]; bpy.ops.object.join()
            o=bpy.context.object; o.name=p.name+'_mesh'
            scene.cursor.location=p.matrix_world.translation; bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
for m in bpy.data.materials:
    bs=m.node_tree.nodes.get('Principled BSDF')
    if bs: bs.inputs['Roughness'].default_value=.28 if m.name in ['pal_picketWhite','pal_blood','pal_policeBlue'] else .55
glass=palette.mat('tealLight')
bs=glass.node_tree.nodes['Principled BSDF']; bs.inputs['Alpha'].default_value=.13; bs.inputs['Roughness'].default_value=.16
glass.diffuse_color=(*glass.diffuse_color[:3],.13); glass.surface_render_method='DITHERED'
meshes=[o for o in scene.objects if o.type=='MESH']
def stats(objects=None):
    tris=0; draws=0
    for o in (meshes if objects is None else objects):
        o.data.calc_loop_triangles(); tris+=len(o.data.loop_triangles)
        draws+=len({p.material_index for p in o.data.polygons})
    return {'triangles':tris,'draw_calls':draws}
# Reserve a small safety margin while retaining all purposeful components.
count=stats()['triangles']
if count>96000:
    for o in meshes:
        bpy.context.view_layer.objects.active=o
        m=o.modifiers.new('Hero budget','DECIMATE'); m.ratio=95000/count
        bpy.ops.object.modifier_apply(modifier=m.name)
materials=sorted({m.name for o in meshes for m in o.data.materials})
report={'id':ASSET['id'],'tier':'Hero',**stats(),'materials':materials,'nodes_ok':all(bpy.data.objects.get(n) for n in ['root','interior']),'within_budget':stats()['triangles']<=100000 and stats()['draw_calls']<=40,'rounds':5,'webgpu_ok':False,'webgl2_ok':False,'gaps':['Rectangular base replaces the reference chamfered/notched footprint.','Stock packaging and chest-freezer glass are simplified.']}
if arg('--glb'):
    ao.bake_all(meshes,samples=32)
    asset_objects=list(scene.objects)
    def export(path, objects=None):
        bpy.ops.object.select_all(action='DESELECT')
        for o in (asset_objects if objects is None else objects): o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(Path(path).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    export(arg('--glb'))
    originals={o:o.data.copy() for o in meshes}
    lod_stats={}
    for level,ratio in [(1,.12),(2,.04)]:
        for o in meshes:
            o.data=originals[o].copy()
            bpy.context.view_layer.objects.active=o
            m=o.modifiers.new('LOD reduction','DECIMATE'); m.ratio=ratio
            bpy.ops.object.modifier_apply(modifier=m.name)
        selected=asset_objects
        temporary=[]
        if level==2:
            # Distant static draw-call cap: collapse five similar palette pairs.
            remap={'pal_grass':'foliage','pal_skinWarm':'skinBlush','pal_picketWhite':'sidewalk','pal_uiDark':'asphalt','pal_woodWarm':'schoolBusYellow'}
            originals_static=[o for o in meshes if o.name.startswith('static_') and not o.name.startswith('static_emi_')]
            groups={}
            for o in originals_static:
                clone=o.copy(); clone.data=o.data.copy(); scene.collection.objects.link(clone)
                token=remap.get(clone.data.materials[0].name)
                if token: clone.data.materials[0]=palette.mat(token)
                groups.setdefault(clone.data.materials[0].name,[]).append(clone)
            for mat,objects in groups.items(): temporary.append(join(objects,'lod2_static_'+mat,interior))
            selected=[o for o in asset_objects if o not in originals_static]+temporary
        export(ROOT/f'model.lod{level}.glb',selected)
        lod_stats[str(level)]=stats([o for o in selected if o.type=='MESH'])
        for o in temporary: bpy.data.objects.remove(o,do_unlink=True)
    (ROOT/'lod-stats.json').write_text(json.dumps(lod_stats,indent=2))
    for o in meshes: o.data=originals[o]
    (ROOT/'report.json').write_text(json.dumps(report,indent=2))
print('BUILD OK',json.dumps(report))
if arg('--render'):
    world=bpy.data.worlds.new('Studio'); scene.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.085,.073,.10,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.6
    for name,loc,energy,size,color in [('key',(3,-5,10),1800,8,(1,.75,.55)),('fill',(7,1,7),1400,7,(.66,.80,1)),('rim',(-2,5,8),1800,6,(1,.52,.32))]:
        d=bpy.data.lights.new(name,'AREA'); d.energy=energy; d.shape='DISK'; d.size=size; d.color=color
        o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=loc; o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    camera=bpy.data.objects.new('camera',bpy.data.cameras.new('camera')); scene.collection.objects.link(camera); scene.camera=camera
    view=arg('--view','ref'); loc={'ref':(13,-17,13),'game':(14,-17,19),'front':(18,0,9),'side':(0,-20,10),'rear':(-14,16,12)}[view]
    camera.location=loc; camera.rotation_euler=(Vector((0,0,1.2))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'; camera.data.ortho_scale=17.8
    scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=int(arg('--samples',24)); scene.cycles.use_denoising=True; scene.cycles.seed=74
    scene.view_settings.view_transform='AgX'
    scene.render.resolution_x=int(arg('--width',960)); scene.render.resolution_y=int(arg('--height',540)); scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(Path(arg('--render')).resolve()); Path(scene.render.filepath).parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True); print('RENDER OK',arg('--render'))

    if arg('--render-game'):
        camera.location=(14,-17,19); camera.rotation_euler=(Vector((0,0,1.2))-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.cycles.samples=24; scene.render.resolution_x=960; scene.render.resolution_y=540
        scene.render.filepath=str(Path(arg('--render-game')).resolve()); bpy.ops.render.render(write_still=True)
        print('RENDER OK',arg('--render-game'))
