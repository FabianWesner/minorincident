"""Sunset Grove park restroom: reproducible palette-only Hero model.
Metres, +X façade, Z up; doors hinge independently and roof is removable.
"""
import argparse, json, math, random, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib import palette, ao
ASSET = {'id': 'bld.restroom-block', 'category': 'building'}
p = argparse.ArgumentParser()
p.add_argument('--render'); p.add_argument('--glb'); p.add_argument('--view', default='ref')
p.add_argument('--samples', type=int, default=24); p.add_argument('--width', type=int, default=960); p.add_argument('--height', type=int, default=540)
args = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
rng = random.Random(240)
parts = {}; groups = {}

def empty(name, pos=(0,0,0), parent=None):
    ob = bpy.data.objects.new(name, None); scene.collection.objects.link(ob)
    ob.location = pos
    if parent: ob.parent = parent
    groups[name] = ob
    return ob
root = empty('root'); root['asset_id'] = ASSET['id']; root['forward'] = '+X'
roof = empty('roof', parent=root); interior = empty('interior', parent=root)

def finish(ob, token, group='root', bevel=0):
    ob.data.materials.append(palette.mat(token, emissive=token=='windowGlow'))
    if bevel:
        mod=ob.modifiers.new('Soft edges','BEVEL'); mod.width=bevel; mod.segments=1
        bpy.context.view_layer.objects.active=ob; bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=ob.modifiers.new('Corner normals','WEIGHTED_NORMAL'); mod.keep_sharp=True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    parts.setdefault((group, token), []).append(ob)
    return ob

def box(name, pos, size, token, group='root', bevel=.025):
    bm=bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    me=bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob=bpy.data.objects.new(name,me); scene.collection.objects.link(ob); ob.location=pos
    return finish(ob,token,group,min(bevel,min(size)*.22))

def cyl(name,pos,r,depth,token,group='root',axis='z',r2=None,vertices=12):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r, radius2=r if r2 is None else r2, depth=depth, location=pos)
    ob=bpy.context.object; ob.name=name
    if axis=='x': ob.rotation_euler[1]=math.pi/2
    if axis=='y': ob.rotation_euler[0]=math.pi/2
    return finish(ob,token,group)

def leaf(pos,scale,token='foliage',group='root'):
    me=bpy.data.meshes.new('Leaf')
    me.from_pydata([(1,0,0),(0,1,0),(-1,0,0),(0,-1,0),(0,0,1),(0,0,-1)],[],[(i,(i+1)%4,4) for i in range(4)]+[((i+1)%4,i,5) for i in range(4)])
    me.update(); ob=bpy.data.objects.new('Leaf',me); scene.collection.objects.link(ob); ob.location=pos; ob.scale=scale
    ob.rotation_euler=(rng.random()*2,rng.random()*2,rng.random()*6)
    return finish(ob,token,group)

def plaque_polygon(name, yz, x, depth, token, group='root'):
    verts=[(xx,y,z) for xx in (x,x+depth) for y,z in yz]; n=len(yz)
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
    ob=bpy.data.objects.new(name,me); scene.collection.objects.link(ob)
    return finish(ob,token,group)

def text(body,y,z,size,token='bandage'):
    curve=bpy.data.curves.new('Notice text','FONT'); curve.body=body; curve.align_x='CENTER'; curve.size=size; curve.extrude=.004; curve.bevel_depth=0; curve.resolution_u=2; curve.bevel_resolution=0
    ob=bpy.data.objects.new(body,curve); scene.collection.objects.link(ob)
    ob.location=(1.622,y,z); ob.rotation_euler=(math.pi/2,0,math.pi/2)
    bpy.context.view_layer.objects.active=ob; ob.select_set(True); bpy.ops.object.convert(target='MESH'); ob.select_set(False)
    finish(ob,token)

# Grounded paver plinth, fine open mortar joints.
for i in range(5):
    for j in range(7):
        box('Concrete paving',(-1.58+i*.86,-2.88+j*.96,.13),(.845,.943,.26),rng.choice(['sidewalk','sidewalk','bandage']))
# Wall shell has real door openings and two usable rooms.
box('Floor',(0,0,.29),(3,5.2,.1),'sidewalk','interior')
box('Back wall',(-1.39,0,1.72),(.22,5.2,2.85),'sidewalk')
box('Partition',(0,0,1.67),(2.7,.15,2.75),'sidewalk','interior')
for side in (-1,1):
    for row in range(5):
        for i in range(4):
            box('Side concrete block',(-.96+i*.63,side*2.48,.56+row*.535),(.615,.24,.517),rng.choice(['sidewalk','sidewalk','bandage']))
    box('Side header',(0,side*2.48,3.005),(2.51,.24,.077),'sidewalk')
# Front piers and continuous header; offset masonry joints.
for y,w in [(-2.29,.62),(0,1.08),(2.29,.62)]:
    for row in range(5): box('Front masonry',(1.38,y,.56+row*.535),(.24,w,.517),rng.choice(['sidewalk','sidewalk','bandage']))
box('Header',(1.38,0,3.025),(.24,5.2,.11),'sidewalk')
for y in (-1.48,1.48): box('Overdoor block',(1.38,y,2.865),(.24,1.38,.185),'sidewalk')
# Fine raised weathering chips, intentionally 6mm proud, deterministic.
chip_bounds=[]
for i in range(190):
    y=rng.uniform(-2.56,2.56); z=rng.uniform(.34,3.07)
    if .58<abs(y)<1.98 and z<2.7: continue
    r=rng.uniform(.014,.07)
    if any(abs(y-yy)<r+rr+.008 and abs(z-zz)<r+rr+.008 for yy,zz,rr in chip_bounds): continue
    chip_bounds.append((y,z,r))
    plaque_polygon('Concrete chips',[(y-r,z),(y-r*.3,z+r*.7),(y+r*.7,z+r*.5),(y+r,z-r*.4),(y,z-r*.6)],1.506,.007,rng.choice(['khaki','sidewalk','khakiLight']))
for i in range(70):
    x=rng.uniform(-1.45,1.42); z=rng.uniform(.34,3)
    ob=box('Side wear',(x,2.609,z),(rng.uniform(.02,.13),.008,rng.uniform(.02,.09)),'khakiLight',bevel=0)
# Roof deck and segmented parapet, all parented to roof.
box('Roof slab',(0,0,3.12),(3.3,5.55,.19),'sidewalk','roof',.05)
box('Roof membrane',(0,0,3.225),(3.08,5.28,.035),'asphalt','roof',.01)
for x in (-1.6,1.6):
    for j in range(8): box('Roof coping',(x,-2.43+j*.695,3.34),(.26,.68,.27),'sidewalk','roof')
for y in (-2.64,2.64):
    for i in range(4): box('Roof coping',(-1.2+i*.8,y,3.34),(.785,.24,.27),'sidewalk','roof')
for y,token,name in [(-1.48,'denimBlue','door_men'),(1.48,'redDark','door_women')]:
    hinge=(1.45,y+.66,.32); empty(name,hinge,root)
    for yy in (y-.68,y+.68): box('Door reveal',(1.36,yy,1.54),(.18,.038,2.46),'uiDark')
    box('Door reveal head',(1.36,y,2.73),(.18,1.35,.05),'uiDark')
    for yy in (y-.695,y+.695): box('Door jamb',(1.51,yy,1.53),(.14,.08,2.46),'blueTrim')
    box('Door lintel',(1.51,y,2.76),(.14,1.46,.1),'blueTrim')
    box('Door leaf',(1.485,y,1.52),(.075,1.3,2.36),token,name,.025)
    box('Door kick plate',(1.533,y,.56),(.018,1.21,.36),'silver',name,.012)
    for yy in (y-.52,y+.52):
        for zz in (.43,.69): cyl('Kick screw',(1.548,yy,zz),.012,.013,'asphalt',name,'x',vertices=12)
    for zz in (.64,1.5,2.36): cyl('Door hinge',(1.53,y+.65,zz),.027,.12,'silver',name)
    box('Lock escutcheon',(1.546,y+.47,1.23),(.025,.095,.23),'silver',name,.012)
    cyl('Lever stem',(1.58,y+.47,1.27),.025,.06,'silver',name,'x')
    box('Lever',(1.611,y+.39,1.27),(.045,.22,.043),'silver',name,.012)
    # Raised international symbols, fully attached to moving door.
    cyl('Pictogram head',(1.537,y,2.29),.085,.014,'bandage',name,'x',vertices=32)
    if name=='door_men':
        box('Pictogram torso',(1.54,y,2.075),(.014,.18,.23),'bandage',name,.014)
        for s in (-1,1):
            box('Pictogram arm',(1.54,y+s*.145,2.04),(.014,.055,.32),'bandage',name,.014)
            box('Pictogram leg',(1.54,y+s*.055,1.77),(.014,.063,.35),'bandage',name,.014)
    else:
        plaque_polygon('Pictogram dress',[(y-.065,2.15),(y+.065,2.15),(y+.22,1.83),(y-.22,1.83)],1.538,.014,'bandage',name)
        for s in (-1,1):
            ob=box('Pictogram arm',(1.547,y+s*.185,2.035),(.014,.05,.29),'bandage',name,.01); ob.rotation_euler[0]=s*.35
            box('Pictogram leg',(1.544,y+s*.064,1.69),(.014,.052,.27),'bandage',name,.012)
    # Wall lantern on bracket, glowing tapered diffuser and overhanging cap.
    lamp='lamp_'+name[5:]; empty(lamp,(1.73,y,2.98),root)
    cyl('Lantern wall mount',(1.55,y,2.92),.105,.06,'blueTrim',lamp,axis='x')
    box('Lantern bracket',(1.73,y,2.98),(.34,.045,.055),'blueTrim',lamp)
    cyl('Lantern diffuser',(1.83,y,2.86),.10,.23,'windowGlow',lamp,r2=.15,vertices=6)
    cyl('Lantern hood',(1.83,y,3.03),.21,.13,'blueTrim',lamp,r2=.045,vertices=6)
    cyl('Lantern base',(1.83,y,2.73),.11,.035,'brass',lamp,vertices=6)
    anchor=empty('light:'+name,(1.83,y,2.86),root)
    anchor['ss_light']={'type':'point','color':'light_window_warm','intensity':2.5,'range':3,'pool':True,'beam':'none','flare':True,'reflect':True,'shadow':'none','heroPriority':1,'flicker':'none','powerGroup':'park-restrooms','breakable':True,'emissiveNodes':[lamp+'_windowGlow'],'tiers':'all'}
# Park notice, raised lettering and leaf emblem.
box('Notice frame',(1.548,0,1.99),(.065,.94,1.39),'brass')
box('Notice enamel',(1.588,0,1.99),(.018,.87,1.31),'blueTrim')
for y in (-.40,.40):
    for z in (1.39,2.59): cyl('Notice fastener',(1.609,y,z),.021,.015,'silver',axis='x',vertices=12)
for body,z,size in [('CLEAN',2.13,.18),('PARKS',1.90,.18),('STRONGER',1.67,.113),('COMMUNITIES',1.49,.103)]: text(body,0,z,size)
for y,z in [(0,2.49),(-.13,2.37),(.13,2.37)]:
    plaque_polygon('Park leaf',[(y,z-.12),(y-.065,z),(y,z+.13),(y+.065,z)],1.62,.012,'bandage')
# Central slatted trash can, recessed open top.
cyl('Bin inner',(1.97,0,.72),.29,.87,'uiDark')
for i in range(16):
    t=2*math.pi*i/16
    ob=box('Bin slat',(1.97+.302*math.cos(t),.302*math.sin(t),.73),(.048,.04,.74),'denim',bevel=.009); ob.rotation_euler[2]=t
for z in (.34,.43,1.06,1.14):
    bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=4,location=(1.97,0,z),major_radius=.303,minor_radius=.031)
    finish(bpy.context.object,'brass' if z==1.14 else 'navy')
# High side louver and rooftop ventilation box.
box('Side vent frame',(.66,2.625,2.64),(.77,.035,.56),'brass')
box('Side vent cavity',(.66,2.65,2.64),(.67,.022,.47),'uiDark')
for z in range(5): box('Vent louver',(.66,2.68,2.45+z*.085),(.64,.075,.03),'silver',bevel=.008)
for y in (-.60,.12): box('HVAC foot',(-.33,y,3.32),(.68,.10,.15),'uiDark','roof')
box('HVAC cabinet',(-.33,-.24,3.78),(.72,.79,.82),'khakiLight','roof',.05)
cyl('Fan grille',(.045,-.24,3.81),.30,.03,'uiDark','roof','x',vertices=48)
for i in range(7):
    z=3.56+i*.08; dz=z-3.81; w=2*math.sqrt(max(.01,.29**2-dz**2))
    box('Fan bars',(.07,-.24,z),(.025,w,.025),'silver','roof',.005)
for y in (-.55,.07):
    for z in (3.47,4.08): cyl('HVAC bolt',(.063,y,z),.017,.02,'asphalt','roof','x',vertices=12)
box('HVAC access',(-.33,-.65,3.77),(.55,.025,.59),'bandage','roof')
box('Low junction',(-.58,1.5,3.38),(.52,.47,.23),'khakiLight','roof')
cyl('Vent pipe',(-.91,.8,3.4),.07,.30,'silver','roof')
cyl('Vent cap',(-.91,.8,3.56),.11,.06,'asphalt','roof')
# Compact flowering shrubs, each leaf is purposeful geometry, no textures.
for side in (-1,1):
    for x,z,scale in [(.65,.55,.46),(1.13,.63,.45),(.80,1.05,.43),(1.06,1.4,.34),(.65,1.64,.25)]:
        leaf((x,side*2.73,z),(scale,.30,scale),'apronOlive')
    for i in range(65):
        a=rng.uniform(0,math.tau); rr=rng.random()**.5
        x=.95+.66*math.cos(a)*rr; y=side*(2.73+.36*math.sin(a)*rr)
        z=.4+rng.random()*1.65*(1-rr*.45)
        leaf((x,y,z),(.12,.058,.18),rng.choice(['foliage','foliage','grass','apronOlive']))
    for i in range(9):
        x=rng.uniform(.1,1.32); y=side*rng.uniform(2.61,3.03); z=rng.uniform(.45,1.85)
        for k in range(5):
            t=k*math.tau/5; leaf((x+.065*math.cos(t),y+.065*math.sin(t),z),(.055,.055,.026),'schoolBusYellow' if i<7 else 'corgiPink')
        leaf((x,y,z+.02),(.025,.025,.025),'orange')
for i in range(10):
    x=rng.uniform(1.5,2.1); y=rng.uniform(-3.15,3.15)
    if abs(y)<.44: continue
    for k in range(5):
        leaf((x+rng.uniform(-.08,.08),y+rng.uniform(-.08,.08),.31+rng.uniform(0,.09)),(.045,.045,.18),'grass')
# Merge static parts by material, preserve parent groups and joint origins.
for (group,token), obs in parts.items():
    bpy.ops.object.select_all(action='DESELECT')
    for ob in obs: ob.select_set(True)
    bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join()
    ob=obs[0]; ob.name=group+'_'+token
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    ob.parent=groups[group]; ob.matrix_parent_inverse=groups[group].matrix_world.inverted()
# Joint parents carry geometry; origins of parent nodes are door hinge points.
collider=empty('col:building',(0,0,1.72),root); collider['collider']={'type':'cuboid','size':[3,5.2,2.9]}
meshes=[o for o in scene.objects if o.type=='MESH']
# Remove redundant bevel triangles on static concrete, preserving all signage/joints.
for ob in meshes:
    if ob.name in ('root_sidewalk','root_bandage','root_khakiLight','roof_sidewalk'):
        mod=ob.modifiers.new('Concrete edge economy','DECIMATE'); mod.ratio=.72; mod.use_collapse_triangulate=True
        bpy.context.view_layer.objects.active=ob; bpy.ops.object.modifier_apply(modifier=mod.name)
# Cycles AO bakes to the standard active color attribute used by the game.
ao.bake_all(meshes,samples=16)

def stats():
    return {'triangles':sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in meshes),'draw_calls':len(meshes)}
base=stats(); materials=sorted({m.name for o in meshes for m in o.data.materials})
if args.glb:
    path=Path(args.glb); path.parent.mkdir(parents=True,exist_ok=True)
    def export(path):
        bpy.ops.object.select_all(action='DESELECT')
        for ob in scene.objects: ob.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_apply=True,export_cameras=False,export_lights=False)
    export(path)
    originals=[(o.name,o.data.copy(),o.matrix_world.copy(),o.parent) for o in meshes]
    def restore():
        global meshes
        for ob in meshes: bpy.data.objects.remove(ob,do_unlink=True)
        meshes=[]
        for name,data,matrix,parent in originals:
            ob=bpy.data.objects.new(name,data.copy()); scene.collection.objects.link(ob)
            ob.parent=parent; ob.matrix_world=matrix; meshes.append(ob)
    lods={}
    distant={'bandage':'sidewalk','khaki':'sidewalk','khakiLight':'sidewalk',
             'navy':'uiDark','asphalt':'uiDark','denim':'uiDark','blueTrim':'uiDark',
             'schoolBusYellow':'brass','orange':'brass','grass':'foliage','apronOlive':'foliage','corgiPink':'redDark'}
    for suffix,ratio in [('lod1',.14),('lod2',.026)]:
        restore()
        if suffix=='lod2':
            for ob in list(meshes):
                if ob.name in ('root_khaki','root_khakiLight','root_grass','root_corgiPink','root_orange','root_schoolBusYellow'):
                    meshes.remove(ob); bpy.data.objects.remove(ob,do_unlink=True)
        for ob in meshes:
            mod=ob.modifiers.new('Screen-size LOD','DECIMATE'); mod.ratio=ratio; mod.use_collapse_triangulate=True
            bpy.context.view_layer.objects.active=ob; bpy.ops.object.modifier_apply(modifier=mod.name)
        if suffix=='lod2':
            buckets={}
            for ob in meshes:
                if ob.parent.name in ('root','roof'):
                    token=ob.data.materials[0].name.removeprefix('pal_')
                    if token in distant: ob.data.materials[0]=palette.mat(distant[token])
                    buckets.setdefault((ob.parent.name,ob.data.materials[0].name),[]).append(ob)
            for (parent,material),obs in buckets.items():
                bpy.ops.object.select_all(action='DESELECT')
                for ob in obs: ob.select_set(True)
                bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join()
                obs[0].name=parent+'_'+material
            meshes=[o for o in scene.objects if o.type=='MESH']
        export(path.with_name(path.stem+'.'+suffix+'.glb')); lods[suffix]=stats()
    restore()
    (HERE/'geometry.json').write_text(json.dumps({**base,'materials':materials,'lods':lods},indent=2))
if args.render:
    # Studio objects are created only after exports.
    world=bpy.data.worlds.new('Warm studio'); scene.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.14,.12,.18,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.45
    for name,loc,power,size,color in [('Key',(4,-5,8),1550,5,(1,.73,.49)),('Fill',(3,6,6),1100,6,(.65,.71,1)),('Rim',(-4,-2,7),1400,4,(1,.58,.3))]:
        ld=bpy.data.lights.new(name,'AREA'); ld.energy=power; ld.shape='DISK'; ld.size=size; ld.color=color
        ob=bpy.data.objects.new(name,ld); scene.collection.objects.link(ob); ob.location=loc; ob.rotation_euler=(Vector((0,0,1.4))-ob.location).to_track_quat('-Z','Y').to_euler()
    for y in (-1.48,1.48):
        ld=bpy.data.lights.new('Lantern glow','POINT'); ld.energy=13; ld.color=(1,.52,.18); ld.shadow_soft_size=.22
        ob=bpy.data.objects.new('Lantern glow',ld); scene.collection.objects.link(ob); ob.location=(1.96,y,2.86)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.035))
    floor=palette.mat('uiDark'); bpy.context.object.data.materials.append(floor)
    camdata=bpy.data.cameras.new('Camera'); cam=bpy.data.objects.new('Camera',camdata); scene.collection.objects.link(cam); scene.camera=cam
    positions={'ref':(12,8,8),'game':(10,10,13),'front':(13,0,5),'side':(0,-13,6),'rear':(-10,10,8)}
    cam.location=positions[args.view]; target=Vector((.2,0,1.65)); cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    camdata.type='ORTHO'; camdata.ortho_scale=11.6 if args.view!='game' else 13.6
    scene.render.engine='CYCLES'; scene.cycles.samples=args.samples; scene.cycles.use_denoising=True; scene.cycles.seed=240
    scene.render.resolution_x=args.width; scene.render.resolution_y=args.height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'; scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(Path(args.render).resolve())
    bpy.ops.render.render(write_still=True)
print('OK', json.dumps(base))
