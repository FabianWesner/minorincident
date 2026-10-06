"""Sunset Grove elevated S-ramp. Reproducible, texture-free production GLBs."""
import argparse, json, math, random, sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools' / 'blender'))
from sslib import palette, ao
ASSET = {'id': 'kit.highway-onramp', 'category': 'building'}
RNG = random.Random(26)
M = {}
ROOT = None


def mesh(name, verts, faces, material):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    bm = bmesh.new(); bm.from_mesh(data)
    if all(edge.is_manifold for edge in bm.edges):
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(M[material])
    obj.parent = ROOT
    return obj


def bevel(obj, width=.04, segments=2):
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new('Soft cast edges', 'BEVEL')
    mod.width, mod.segments = width, segments
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    mod.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def box(name, loc, size, material, edge=.04, angle=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler.z = angle
    obj.data.materials.append(M[material])
    obj.parent = ROOT
    if edge:
        bevel(obj, edge)
    return obj


def cylinder(name, a, b, radius, material, vertices=12):
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=(b-a).length, location=(a+b)/2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    obj.data.materials.append(M[material])
    obj.parent = ROOT
    if radius >= .075:
        bevel(obj, min(.025, radius*.16), 1)
    return obj


def point(t, offset=0, dz=0):
    x = -12 + 24*t
    y = -4.3*math.sin(2*math.pi*t)
    slope = -4.3*2*math.pi/24*math.cos(2*math.pi*t)
    norm = Vector((-slope, 1, 0)).normalized()
    # The main viaduct stays high before descending into the low entry.
    z = .70 + 5.0*(1-t*t)
    return Vector((x,y,z)) + norm*offset + Vector((0,0,dz))


def roadway():
    """Disjoint road bands: paint has no hidden asphalt/deck face below it."""
    dash=[(i/23+.012,min(i/23+.033,1)) for i in range(23)]
    joints=[(.08,.081),(.21,.211),(.39,.391),(.51,.511),(.69,.691),(.85,.851),(.95,.951)]
    ts=sorted({i/180 for i in range(181)}|{t for pair in dash+joints for t in pair if 0<=t<=1})
    widths=(-2.31,-2.025,-1.895,-.025,.025,1.895,2.025,2.31)
    groups={token:[[],[],{}] for token in ('asphalt','picketWhite','schoolBusYellow')}
    def vertex(group,t,w,z):
        key=(t,w,z)
        if key not in group[2]:
            group[2][key]=len(group[0]); group[0].append(point(t,w,z))
        return group[2][key]
    for ta,tb in zip(ts,ts[1:]):
        mid=(ta+tb)/2
        if any(a<mid<b for a,b in joints): continue
        for j,(wa,wb) in enumerate(zip(widths,widths[1:])):
            token='schoolBusYellow' if j in (1,5) else 'picketWhite' if j==3 and any(a<mid<b for a,b in dash) else 'asphalt'
            z=0 if token=='asphalt' else .019
            group=groups[token]
            group[1].append(tuple(vertex(group,t,w,z) for t,w in ((ta,wa),(tb,wa),(tb,wb),(ta,wb))))
            if z:
                for w in (wa,wb):
                    group[1].append(tuple(vertex(group,t,ww,h) for t,ww,h in ((ta,w,0),(tb,w,0),(tb,w,z),(ta,w,z))))
    for token,(verts,faces,_) in groups.items():
        obj=mesh('Road band '+token,verts,faces,token)
        for polygon in obj.data.polygons: polygon.use_smooth=True


def barrier(t0,t1,side, index):
    # Jersey profile: wide curb, sloping shoulder, narrow upright wall.
    profile=[(-.29,.01),(.29,.01),(.29,.22),(.13,.42),(.13,.95),(-.13,.95),(-.13,.42),(-.29,.22)]
    verts=[]
    for t in (t0,t1):
        for w,z in profile:
            verts.append(point(t, side*2.58+w, z))
    faces=[tuple(range(7,-1,-1)),tuple(range(8,16))]
    faces.extend([(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)])
    obj=mesh('Jersey barrier',verts,faces,'sidewalk')
    bevel(obj,.035,1)
    if index%5==0:
        p=(point(t0,side*2.58,.62)+point(t1,side*2.58,.62))/2
        tangent=point(t1)-point(t0)
        box('Barrier reinforcement cap',p,(.30,.40,.93),'sidewalk',.04,math.atan2(tangent.y,tangent.x))
    # Small outward joint bolts, inset crack details and narrow moss stains.
    if index%3==0:
        p=point((t0+t1)/2,side*2.735,.43)
        q=p+Vector((0,side*.015,0))
        cylinder('Barrier tie bolt',p,q,.035,'woodWarm',8)


def text(label, x, y, z, size, max_width):
    bpy.ops.object.text_add(location=(x,y,z),rotation=(math.pi/2,0,0))
    obj=bpy.context.object
    obj.name='Raised lettering '+label
    obj.data.body=label
    obj.data.align_x='CENTER'
    obj.data.align_y='CENTER'
    obj.data.size=size
    obj.data.extrude=.10
    obj.data.bevel_depth=.002
    obj.data.bevel_resolution=1
    obj.data.resolution_u=5
    obj.data.materials.append(M['picketWhite'])
    obj.parent=ROOT
    bpy.context.view_layer.update()
    if obj.dimensions.x>max_width:
        obj.scale.x=max_width/obj.dimensions.x
    bpy.ops.object.convert(target='MESH')


def lamp(t, side, index):
    p=point(t,side*2.58,.96)
    box('Lamp base',p+Vector((0,0,.05)),(.40,.40,.18),'uiDark',.04)
    top=p+Vector((0,0,2.7))
    cylinder('Lantern post',p,top,.075,'woodWarm')
    tip=top+Vector((0,-.45,.06))
    cylinder('Lantern swan neck',top,tip,.06,'woodWarm')
    box('Lantern collar',tip,(.16,.16,.15),'woodWarm',.025)
    center=tip+Vector((0,0,-.43))
    head=box('lampHead'+str(index),center,(.34,.34,.43),'glow',.04)
    head['preserve_node']=True
    head['pivot']='lamp center' 
    box('Lantern foot',center+Vector((0,0,-.25)),(.38,.38,.06),'woodWarm',.018)
    bpy.ops.mesh.primitive_cone_add(vertices=4,radius1=.36,radius2=.10,depth=.18,location=center+Vector((0,0,.31)),rotation=(0,0,math.pi/4))
    obj=bpy.context.object
    obj.name='Pyramidal lantern hood'
    obj.data.materials.append(M['woodWarm']); obj.parent=ROOT
    bevel(obj,.02)
    for dx in (-.15,.15):
        for dy in (-.15,.15):
            cylinder('Lantern corner frame',center+Vector((dx,dy,-.22)),center+Vector((dx,dy,.22)),.018,'woodWarm',6)
    anchor=bpy.data.objects.new('light:lantern'+str(index),None)
    bpy.context.collection.objects.link(anchor); anchor.parent=ROOT; anchor.location=center
    anchor['ss_light']=json.dumps({'type':'point','color':'light_sodium','intensity':7,'range':4,'pool':True,'flare':True,'reflect':True,'shadow':'none','flicker':'none','powerGroup':'self','breakable':True,'emissiveNodes':['lampHead'+str(index)],'tiers':'all'})


def sign():
    x,y=1.0,7.6
    before=set(bpy.context.scene.objects)
    for dx in (-4.35,4.35):
        box('Gantry footing',(x+dx,y,.23),(.85,.85,.46),'sidewalk',.09)
        box('Gantry base shoe',(x+dx,y,.56),(.53,.53,.23),'woodWarm',.04)
        cylinder('Gantry upright',(x+dx,y,.6),(x+dx,y,8.6),.17,'sidewalk',16)
        for z in (6.35,8.25):
            box('Gantry clamp',(x+dx,y,z),(.45,.42,.27),'woodWarm',.04)
            cylinder('Clamp bolt',(x+dx,y-.23,z),(x+dx,y-.28,z),.07,'picketWhite')
    for z in (6.35,8.25):
        cylinder('Gantry cross rail',(x-4.35,y+.07,z),(x+4.35,y+.07,z),.11,'sidewalk')
    for a,b in ((-4.15,-2.9),(2.9,4.15)):
        cylinder('Diagonal truss',(x+a,y+.08,6.4),(x+b,y+.08,8.2),.065,'woodWarm')
        cylinder('Diagonal truss',(x+b,y+.09,6.4),(x+a,y+.09,8.2),.065,'woodWarm')
    box('Exit sign pale rounded rim',(x,y-.16,7.3),(6.85,.22,2.75),'picketWhite',.13)
    box('Exit sign green face',(x,y-.48,7.3),(6.66,.20,2.56),'backpackTeal',.09)
    text('SUNSET GROVE',x,y-.71,7.87,.67,6.05)
    text('EXIT',x-.75,y-.71,6.82,.87,3.4)
    # Deep raised letter and arrow relief remains stable in the far game camera.
    coords=[(1.08,-.86),(1.78,-.13),(1.40,.20),(2.53,.26),(2.47,-.87),(2.11,-.51),(1.40,-1.19)]
    verts=[(x+u,y-.805,7.25+v) for u,v in coords]
    arrow=mesh('Raised exit arrow',verts,[tuple(range(len(verts)-1,-1,-1))],'picketWhite')
    mod=arrow.modifiers.new('Arrow thickness','SOLIDIFY'); mod.thickness=.205
    bpy.context.view_layer.objects.active=arrow; bpy.ops.object.modifier_apply(modifier=mod.name)
    for dx in (-3.18,3.18):
        for dz in (-1.17,1.17):
            cylinder('Sign corner rivet',(x+dx,y-.265,7.3+dz),(x+dx,y-.625,7.3+dz),.045,'woodWarm')
    for dx in (-2.9,-1.75,-.7,.4,1.6,2.8):
        box('Rim weathering',(x+dx,y-.285,8.657),(.10,.015,.025),'woodWarm',.005)

    pivot=Matrix.Translation(Vector((x,y,0)))
    transform=pivot @ Matrix.Rotation(math.radians(20),4,'Z') @ pivot.inverted()
    for obj in set(bpy.context.scene.objects)-before:
        obj.matrix_world=transform @ obj.matrix_world


def weather():
    for side in (-1,1):
        for i in range(18):
            t=RNG.uniform(.02,.98)
            # Thin triangular rain stains on the outer fascia.
            p=point(t,side*2.87,-.08)
            tangent=(point(t+.002)-point(t)).normalized()
            verts=[p-tangent*.055,p+tangent*.055,p+Vector((0,0,-RNG.uniform(.12,.4)))]
            mesh('Moss rain stain',verts,[(0,1,2) if side==1 else (2,1,0)],'grass')
    for t,side in ((.09,-1),(.27,1),(.61,-1),(.90,1),(.99,-1)):
        p=point(t,side*2.76,.02)
        for j in range(5):
            angle=j*2.4
            tip=p+Vector((math.cos(angle)*.15,math.sin(angle)*.15,.12+(.07*j)))
            mesh('Crevice grass',[p+Vector((-.035,0,0)),p+Vector((.035,0,0)),tip],[(0,1,2)],'foliage')


def build(ctx=None):
    global ROOT
    RNG.seed(26)
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    ROOT=bpy.data.objects.new('root',None); bpy.context.collection.objects.link(ROOT)
    ROOT['asset_id']=ASSET['id']; ROOT['category']='building'; ROOT['forward']='+X'
    for token in ('asphalt','sidewalk','picketWhite','backpackTeal','schoolBusYellow','woodWarm','uiDark','grass','foliage','navySeam'):
        M[token]=palette.mat(token)
        M[token].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.8
    M['glow']=palette.mat('windowGlow',emissive=True)
    deck_verts=[]; deck_faces=[]; n=180
    for i in range(n+1):
        t=i/n
        deck_verts.extend([point(t,w,-.08) for w in (-2.88,-2.31,2.31,2.88)])
        deck_verts.extend([point(t,-2.88,-.50),point(t,2.88,-.50)])
    deck_faces.extend([(0,4,5,3,2,1),(6*n,6*n+1,6*n+2,6*n+3,6*n+5,6*n+4)])
    for i in range(n):
        k=6*i
        for j in (0,2): deck_faces.append((k+j,k+j+6,k+j+7,k+j+1))
        deck_faces.extend([(k,k+4,k+10,k+6),(k+3,k+9,k+11,k+5),(k+4,k+5,k+11,k+10)])
    bevel(mesh('Continuous concrete deck',deck_verts,deck_faces,'sidewalk'),.025,1)
    roadway()
    for side in (-1,1):
        for i in range(48):
            barrier(i/48+.00065,(i+1)/48-.00065,side,i)
        # Actual segmented fascia with shadow gaps.
        for i in range(36):
            verts=[]
            for t in (i/36+.00045,(i+1)/36-.00045):
                verts.extend([point(t,side*2.86,-.02),point(t,side*2.86,-.70),point(t,side*2.45,-.70),point(t,side*2.45,-.02)])
            obj=mesh('Concrete fascia panel',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'sidewalk'); bevel(obj,.027,1)
    for t in (.13,.39,.62):
        p=point(t,-2.05)
        height=p.z-.70
        box('Pier ground footing',(p.x,p.y,.23),(1.85,1.68,.46),'sidewalk',.09)
        box('Concrete pier shaft',(p.x,p.y,(.46+height)/2),(1.14,1.10,height-.46),'sidewalk',.07)
        cap=point(t,-.95)
        box('Pier capital',(cap.x,cap.y,height-.06),(1.95,3.70,.57),'sidewalk',.09,math.atan2((point(t+.01)-p).y,(point(t+.01)-p).x))
        for dz in (.70,1.10):
            if dz<height:
                box('Pier cast seam',(p.x,p.y-.555,dz),(.94,.012,.012),'woodWarm',0)
        col=bpy.data.objects.new('col:pier'+str(t),None); bpy.context.collection.objects.link(col); col.parent=ROOT
        col.location=(p.x,p.y,height/2); col['collider']='cuboid'; col['size']=[1.85,1.68,height]
    for i in range(16):
        t=(i+.5)/16; p=point(t,0,-.35); tangent=point(t+.001)-point(t-.001)
        col=bpy.data.objects.new('col:deck'+str(i),None); bpy.context.collection.objects.link(col); col.parent=ROOT; col.location=p
        col.rotation_euler=(0,-math.atan2(tangent.z,math.hypot(tangent.x,tangent.y)),math.atan2(tangent.y,tangent.x))
        col['collider']='cuboid'; col['size']=[tangent.length/.002/16,5.76,.70]
    for t,side,index in ((.06,-1,1),(.34,1,2),(.78,1,3)):
        lamp(t,side,index)
    sign(); weather()
    for t in (.13,.39,.62):
        p=point(t,-2.05); height=p.z-.70
        for i in range(7):
            z=.6+(height-1.1)*i/7
            x=p.x+RNG.uniform(-.45,.35); y=p.y-.558
            mesh('Pier concrete chip',[(x,y,z),(x+.08,y,z+.05),(x+.03,y,z+.18)],[(0,1,2)],'navySeam')
        for i in range(4):
            x=p.x-.35+i*.23; y=p.y-.86-.004
            mesh('Footing moss',[(x,y,.38),(x+.07,y,.42),(x+.10,y,.03)],[(0,1,2)],'grass')
    parts={}
    for obj in ROOT.children:
        if obj.type=='MESH':
            obj.data.calc_loop_triangles()
            family=obj.name.split('.')[0]
            parts[family]=parts.get(family,0)+len(obj.data.loop_triangles)
    (HERE/'part-stats.json').write_text(json.dumps(parts,indent=2))
    # Join all fixed geometry by material: exactly one primitive per palette token.
    for material in set(M.values()):
        objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==material and not o.get('preserve_node')]
        if not objects: continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects: obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join()
        obj=bpy.context.object; obj.name='static_'+material.name
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        clean_mesh(obj)
    for obj in ROOT.children:
        if obj.type=='MESH' and obj.get('preserve_node'): clean_mesh(obj)
    return ROOT


def clean_mesh(obj):
    bm=bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm,faces=list(bm.faces))
    bad=[face for face in bm.faces if face.calc_area()<1e-10]
    if bad: bmesh.ops.delete(bm,geom=bad,context='FACES')
    bm.to_mesh(obj.data); bm.free(); obj.data.update()


def stats():
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==ROOT]
    triangles=0
    for o in objects:
        o.data.calc_loop_triangles(); triangles+=len(o.data.loop_triangles)
    return triangles,len(objects)


def export(path):
    bpy.ops.object.select_all(action='DESELECT')
    ROOT.select_set(True)
    for obj in ROOT.children: obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)


def export_lods(path):
    export(path)
    objects=[o for o in ROOT.children if o.type=='MESH']
    original={o:o.data.copy() for o in objects}
    counts={}
    for level,ratio in ((1,.12),(2,.035)):
        for obj in objects:
            obj.data=original[obj].copy()
            bpy.context.view_layer.objects.active=obj
            mod=obj.modifiers.new('LOD simplification','DECIMATE'); mod.ratio=max(ratio,.12) if obj.get('preserve_node') else ratio; mod.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=mod.name)
            clean_mesh(obj)
        target=path.with_name(path.stem+'.lod'+str(level)+'.glb')
        export(target); counts[str(level)]=stats()[0]
    for obj in objects: obj.data=original[obj]
    (HERE/'lod-stats.json').write_text(json.dumps(counts,indent=2))


def studio(args):
    scene=bpy.context.scene
    scene.render.engine='CYCLES'; scene.cycles.samples=args.samples; scene.cycles.use_denoising=True
    scene.cycles.seed=26
    scene.world.color=(.14,.14,.14)
    world=bpy.data.worlds.new('Neutral violet studio'); scene.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.10,.085,.13,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.65
    # Floor is presentation-only and never included in the GLBs.
    box('Studio floor',(0,0,-.14),(200,200,.25),'uiDark',0).parent=None
    def area(name,loc,power,color,size):
        data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.color=color; data.shape='DISK'; data.size=size
        obj=bpy.data.objects.new(name,data); scene.collection.objects.link(obj); obj.location=loc; obj.rotation_euler=(Vector((0,0,2))-obj.location).to_track_quat('-Z','Y').to_euler()
    area('Warm softbox',(3,-10,19),5000,(1,.72,.45),10)
    area('Lavender fill',(-12,-2,12),1800,(.58,.65,1),12)
    area('Golden rim',(4,12,15),5500,(1,.72,.38),9)
    for obj in ROOT.children:
        if obj.name.startswith('light:'):
            data=bpy.data.lights.new(obj.name,'POINT'); data.energy=22; data.color=(1,.48,.12); data.shadow_soft_size=.30
            light=bpy.data.objects.new(obj.name+' preview',data); scene.collection.objects.link(light); light.location=obj.location
    data=bpy.data.cameras.new('Camera'); camera=bpy.data.objects.new('Camera',data); scene.collection.objects.link(camera); scene.camera=camera
    views={'ref':(35,-35,24),'game':(30,-30,40),'front':(35,0,18),'side':(0,-40,19),'rear':(-30,30,25)}
    target=Vector((0,1.1,3.3)); camera.location=target+Vector(views[args.view]); camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    data.type='ORTHO'; data.ortho_scale=35.0 if args.view=='game' else 32.5
    scene.render.resolution_x=args.width; scene.render.resolution_y=args.height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(Path(args.render).resolve())
    bpy.ops.render.render(write_still=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--render'); parser.add_argument('--view',default='ref',choices=['ref','game','front','side','rear'])
    parser.add_argument('--samples',type=int,default=24); parser.add_argument('--width',type=int,default=960); parser.add_argument('--height',type=int,default=540)
    parser.add_argument('--glb'); parser.add_argument('--skip-ao',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    build()
    triangles,draws=stats()
    if args.glb:
        if not args.skip_ao: ao.bake_all([o for o in ROOT.children if o.type=='MESH'],samples=32)
        export_lods(Path(args.glb).resolve())
    print('OK '+json.dumps({'triangles':triangles,'draw_calls':draws,'materials':sorted(m.name for m in set(M.values()))}))
    if args.render: studio(args)
