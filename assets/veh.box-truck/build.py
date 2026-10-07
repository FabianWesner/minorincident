"""Deterministic Hometown Movers truck; metres, +X forward, Z up.
Static parts merge by material; moving assemblies retain joint origins.
All lettering/stripes are raised geometry, with >= 3 mm face clearance.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.lod import hard_normals, refresh_normals

HERE = Path(__file__).resolve().parent
if '--normals-only' in sys.argv:
    refresh_normals(HERE, Path(sys.argv[sys.argv.index('--lod-input-directory') + 1]))
    sys.exit(0)

p = argparse.ArgumentParser()
p.add_argument('--lod',type=int,choices=(0,1,2),default=0)
p.add_argument('--render'); p.add_argument('--glb'); p.add_argument('--view', default='ref')
p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960); p.add_argument('--height', type=int, default=540)
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
def build_scene(lod=0, bake=False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    colors = json.loads((HERE.parents[1]/'src/assets/palette.json').read_text())
    FONT=bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Arial Bold.ttf')
    M = {}
    for token, rough, metal, emission in [('picketWhite',.36,0,0),('uiDark',.73,0,0),('asphalt',.43,.2,0),('silver',.3,.65,0),('backpackTeal',.39,0,0),('blueTrim',.22,.2,0),('survivorRed',.4,0,0),('windowGlow',.3,0,3),('schoolBusYellow',.32,0,1.3),('sirenRed',.32,0,.65)]:
        name=('emi_' if emission else 'pal_')+token
        m=bpy.data.materials.new(name); m.use_nodes=True
        rgb=[int(colors[token][i:i+2],16)/255 for i in (1,3,5)]
        c=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)+(1,)
        bs=m.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value=c
        bs.inputs['Roughness'].default_value=rough; bs.inputs['Metallic'].default_value=metal
        if emission:
            bs.inputs['Emission Color'].default_value=c; bs.inputs['Emission Strength'].default_value=emission
        m.diffuse_color=c; M[token]=m

    def empty(name, loc=(0,0,0), parent=None):
        o=bpy.data.objects.new(name,None); scene.collection.objects.link(o); o.location=loc; o.parent=parent
        return o
    root=empty('veh.box-truck')
    root['ss_physics']=json.dumps({'class':'heavy',**dict(mass=4200,friction=.8,restitution=.03,centerOfMass=[-.4,1.1,0],pushable=False,kickable=False,flammable=True)})
    body=empty('body',parent=root)

    def finish(o,name,token,parent=body,bevel=.02):
        o.name=name
        omit=('rivet','tread','lug','rim vent','roof seam','step grip','fleet marking')
        if lod and any(key in name for key in omit):
            bpy.data.objects.remove(o,do_unlink=True); return None
        if lod==2 and any(key in name for key in ('house window','attic window','rim bead','sidewall ring','hub cap','lock bracket','hinge pin','tank strap','marker base','reflective tape','box marker','wheel arch')):
            bpy.data.objects.remove(o,do_unlink=True); return None
        o.data.materials.append(M[token])
        if lod and name not in ('cargo box','cab','door panel','mirror housing','fuel tank','front bumper','grille frame','rear door'):
            bevel=0
        if bevel and lod<2:
            mod=o.modifiers.new('soft edges','BEVEL'); mod.width=bevel; mod.segments=3 if lod==0 else 1
            mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); mod.keep_sharp=True
        bpy.context.view_layer.update(); world=o.matrix_world.copy(); o.parent=parent; o.matrix_world=world
        return o

    def box(name,loc,size,token,parent=body,bevel=.02,rot=None):
        bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.scale=size
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        if rot: o.rotation_euler=rot
        return finish(o,name,token,parent,min(bevel,min(size)*.4))

    def prism(name,points,y0,y1,token,parent=body,bevel=.02):
        n=len(points); verts=[(x,y,z) for y in (y0,y1) for x,z in points]
        faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.update()
        bm=bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(me); bm.free()
        o=bpy.data.objects.new(name,me); scene.collection.objects.link(o)
        return finish(o,name,token,parent,bevel)

    def cylinder(name,loc,radius,depth,token,parent=body,axis='Y',vertices=32):
        bpy.ops.mesh.primitive_cylinder_add(vertices=min(vertices,16 if lod==1 else 6) if lod else vertices,radius=radius,depth=depth,location=loc)
        o=bpy.context.object
        o.rotation_euler=(math.pi/2,0,0) if axis=='Y' else (0,math.pi/2,0) if axis=='X' else (0,0,0)
        for f in o.data.polygons: f.use_smooth=True
        return finish(o,name,token,parent,.012)

    def rod(name,start,end,radius,token,parent=body):
        start,end=Vector(start),Vector(end)
        o=cylinder(name,(start+end)/2,radius,(end-start).length,token,parent,axis='Z',vertices=12)
        o.rotation_euler=(end-start).to_track_quat('Z','Y').to_euler()
        return o

    def torus(name,loc,major,minor,token,parent=body):
        bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=64 if lod==0 else 24 if lod==1 else 12,minor_segments=16 if lod==0 else 6 if lod==1 else 4,location=loc,rotation=(math.pi/2,0,0))
        o=bpy.context.object
        for f in o.data.polygons: f.use_smooth=True
        return finish(o,name,token,parent,0)

    def text(name,label,loc,size,token,side=-1,parent=body,width=None):
        if lod==2: return None
        cu=bpy.data.curves.new(name,'FONT'); cu.body=label; cu.size=size; cu.extrude=.004 if lod==0 else 0; cu.bevel_depth=.001 if lod==0 else 0; cu.bevel_resolution=1
        cu.font=FONT
        cu.align_x='CENTER'; cu.align_y='CENTER'; cu.resolution_u=5 if lod==0 else 2
        o=bpy.data.objects.new(name,cu); scene.collection.objects.link(o); o.location=loc
        o.rotation_euler=(math.pi/2,0,math.pi if side==1 else 0)
        bpy.context.view_layer.update()
        if width: o.scale.x=width/max(o.dimensions.x,.01)
        bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
        return finish(o,name,token,parent,0)

    # Box body 4.5m long, sits above the rear running gear.
    box('cargo box',(-.95,0,2.6),(4.5,2.3,2.6),'picketWhite',bevel=.055)
    box('chassis',(-.15,0,.78),(6.3,1.65,.3),'uiDark',bevel=.05)
    for y in (-.69,.69):
        box('frame rail',(-.3,y,.7),(6,.13,.25),'asphalt')
    for x in (-2.15,2.2): cylinder('axle',(x,0,.57),.1,2.13,'uiDark')
    for side in (-1,1):
        y=side*1.166
        box('lower extrusion',(-.95,y,1.34),(4.6,.08,.14),'silver')
        box('upper extrusion',(-.95,y,3.91),(4.58,.08,.12),'silver')
        box('moving stripe',(-.95,side*1.159,1.76),(4.43,.014,.39),'backpackTeal',bevel=.004)
        text('stripe slogan','PACK  •  MOVE  •  START AGAIN',(-.95,side*1.174,1.76),.24,'picketWhite',side,width=3.97)
        text('company name','HOMETOWN',(-.3 if side==-1 else -1.5,side*1.165,2.95),.56,'backpackTeal',side,width=2.56)
        text('company service','MOVERS',(-.3 if side==-1 else -1.5,side*1.165,2.48),.6,'backpackTeal',side,width=2.52)
        # Raised house mark, roof chevron and contrasting negative-space windows.
        cx=-2.65 if side==-1 else .65
        box('house badge',(cx,side*1.162,2.69),(.7,.018,.75),'backpackTeal',bevel=.025)
        for dx in (-.16,.16): box('house window',(cx+dx,side*1.177,2.57),(.15,.012,.2),'picketWhite',bevel=.003)
        for sign in (-1,1): rod('house roof',(cx+sign*.49,side*1.174,3.03),(cx,side*1.174,3.49),.057,'backpackTeal')
        box('attic window',(cx,side*1.182,2.99),(.17,.01,.18),'picketWhite',bevel=.007)
        for x in (-3.19,1.29):
            box('corner post',(x,y,2.6),(.09,.1,2.61),'silver')
            box('corner cap',(x,y,3.88),(.22,.15,.22),'silver',bevel=.05)
        for i in range(11):
            x=-3.13+i*.433
            cylinder('rail rivet',(x,side*1.211,1.34),.015,.008,'silver',vertices=12)
            cylinder('top rivet',(x,side*1.211,3.91),.013,.008,'silver',vertices=12)
            if i%2==0: box('reflective tape',(x,side*1.212,1.34),(.32,.008,.07),'survivorRed',bevel=.002)
        for x in (-2.15,2.2):
            # Arch follows tyre, open below rather than burying it in a rectangular fender.
            segments=12 if lod==0 else 8 if lod==1 else 6
            for i in range(segments):
                angle=math.pi*i/(segments-1)
                xx=x+.7*math.cos(angle); zz=.57+.7*math.sin(angle)
                box('wheel arch',(xx,side*1.015,zz),(.21 if lod==0 else .3 if lod==1 else .44,.16,.09),'asphalt',rot=(0,math.pi/2-angle,0))
            box('mud flap',(x-.73,side*.96,.48),(.06,.39,.62),'uiDark')
        box('fuel tank',(.63,side*.84,.68),(.82,.43,.49),'asphalt',bevel=.07)
        for xx in (.3,.91): box('tank strap',(xx,side*1.064,.68),(.05,.025,.46),'silver')
        box('entry step',(1.51,side*1.06,.64),(.45,.3,.12),'asphalt')
        for j in range(4): box('step grip',(1.35+j*.1,side*1.13,.705),(.05,.2,.014),'silver',bevel=.002)
    # Roof seams and box bulkhead.
    for x in (-2.3,-.9,.5): box('roof seam',(x,0,3.906),(.012,2.16,.014),'silver',bevel=.002)
    box('front box trim',(1.316,0,3.9),(.06,2.32,.12),'silver')
    for y in (-.6,0,.6): box('bulkhead rib',(1.316,y,2.69),(.021,.018,2.2),'silver',bevel=.003)

    # Cab-over shell: slanted glazing and a broad nearly vertical front.
    profile=[(1.38,.94),(3.08,.94),(3.08,1.96),(2.77,2.99),(1.46,3.05),(1.32,2.68)]
    prism('cab',profile,-.99,.99,'picketWhite',bevel=.075)
    # Broad dark windscreen proud of the tilted front plane.
    box('windshield seal',(2.932,0,2.48),(.045,1.91,.94),'uiDark',rot=(0,-.287,0),bevel=.04)
    box('windshield',(2.958,0,2.48),(.027,1.78,.81),'blueTrim',rot=(0,-.287,0),bevel=.04)
    box('windshield center',(2.976,0,2.48),(.025,.024,.82),'asphalt',rot=(0,-.287,0),bevel=.006)
    for side in (-1,1):
        door=empty('doorL' if side==-1 else 'doorR',(2.73,side*.99,1.55),root)
        prism('door panel',[(1.46,1.16),(2.75,1.16),(2.75,2.28),(2.54,2.89),(1.5,2.91)],side*1.002,side*1.024,'picketWhite',door,.025)
        prism('side window seal',[(1.53,2.05),(2.69,2.05),(2.49,2.83),(1.55,2.85)],side*1.033,side*1.057,'uiDark',door,.035)
        prism('side window',[(1.6,2.12),(2.61,2.12),(2.43,2.77),(1.62,2.78)],side*1.063,side*1.078,'blueTrim',door,.02)
        box('door latch',(1.63,side*1.055,1.62),(.09,.043,.24),'uiDark',door)
        box('door latch inset',(1.63,side*1.08,1.64),(.034,.018,.13),'uiDark',door,bevel=.005)
        text('fleet marking','SUNSET GROVE',(2.18,side*1.042,1.61),.08,'backpackTeal',side,door,width=.61)
        for z in (2.11,2.73):
            rod('mirror support',(2.68,side*1.04,z),(2.76,side*1.31,z),.023,'uiDark',door)
        box('mirror housing',(2.76,side*1.32,2.39),(.17,.15,.5),'uiDark',door,bevel=.04)
        box('mirror glass',(2.663,side*1.32,2.39),(.015,.125,.43),'blueTrim',door)
        box('lower mirror',(2.76,side*1.32,2.04),(.18,.15,.19),'uiDark',door,bevel=.035)
        rod('wiper',(3.099,side*.79,2.1),(3.108,side*.1,2.16),.017,'uiDark')
        rod('wiper arm',(3.117,side*.13,2.04),(3.113,side*.35,2.13),.014,'asphalt')
    box('grille frame',(3.104,0,1.56),(.11,1.11,.57),'silver',bevel=.04)
    box('grille recess',(3.166,0,1.56),(.024,1.01,.47),'uiDark')
    for z in (1.39,1.55,1.71): box('grille bar',(3.189,0,z),(.035,.99,.035),'silver')
    box('front bumper',(3.19,0,.94),(.27,2.15,.32),'silver',bevel=.055)
    box('license recess',(3.337,0,.94),(.026,.62,.19),'uiDark')
    box('license plate',(3.356,0,.94),(.014,.38,.15),'picketWhite')
    # Wheel assemblies: tread blocks, inset rims, ring, holes, hubs and lug nuts.
    for x,tag in [(2.2,'F'),(-2.15,'R')]:
        for side,lr in [(-1,'L'),(1,'R')]:
            wheel=empty('wheel'+tag+lr,(x,side*.96,.57),root)
            torus('tyre',(x,side*.96,.57),.43,.14,'uiDark',wheel)
            torus('sidewall ring',(x,side*1.091,.57),.424,.012,'asphalt',wheel)
            cylinder('rim',(x,side*1.081,.57),.335,.065,'silver',wheel)
            cylinder('dish',(x,side*1.119,.57),.272,.022,'asphalt',wheel)
            torus('rim bead',(x,side*1.127,.57),.31,.019,'silver',wheel)
            cylinder('hub',(x,side*1.149,.57),.13,.072,'silver',wheel)
            cylinder('hub cap',(x,side*1.194,.57),.078,.027,'asphalt',wheel)
            for i in range(10):
                angle=math.tau*i/10
                cylinder('rim vent',(x+.223*math.cos(angle),side*1.136,.57+.223*math.sin(angle)),.033,.014,'uiDark',wheel,vertices=16)
                cylinder('lug',(x+.151*math.cos(angle),side*1.148,.57+.151*math.sin(angle)),.019,.022,'silver',wheel,vertices=8)
            for i in range(44):
                angle=math.tau*i/44
                for offset in (-.075,.075):
                    box('tread',(x+.557*math.cos(angle),side*.96+offset,.57+.557*math.sin(angle)),(.068,.105,.016),'uiDark',wheel,bevel=.003,rot=(0,math.pi/2-angle,0))
    # Rear doors hinge at the outer edge; all lock hardware follows the doors.
    for side in (-1,1):
        rear=empty('cargoDoorL' if side==-1 else 'cargoDoorR',(-3.22,side*1.09,2.61),root)
        box('rear door',(-3.225,side*.555,2.6),(.045,1.06,2.43),'picketWhite',rear)
        for yy in (side*.1,side*1.07): box('rear stile',(-3.259,yy,2.6),(.023,.025,2.4),'silver',rear)
        rod('lock bar',(-3.291,side*.15,1.46),(-3.291,side*.15,3.73),.023,'silver',rear)
        for z in (1.56,2.3,3.53):
            box('hinge',(-3.28,side*1.01,z),(.045,.18,.084),'silver',rear)
            cylinder('hinge pin',(-3.309,side*1.08,z),.027,.12,'silver',rear,axis='Z',vertices=16)
            box('lock bracket',(-3.32,side*.15,z),(.027,.1,.08),'silver',rear)
        box('lock handle',(-3.345,side*.3,1.78),(.028,.31,.038),'silver',rear)
    box('rear sill',(-3.29,0,1.32),(.17,2.35,.13),'silver')
    box('rear underrun bar',(-3.4,0,.52),(.13,2.18,.13),'asphalt')
    for y in (-.85,.85): box('rear support',(-3.22,y,.84),(.12,.1,.6),'uiDark')
    for i in range(7): box('rear reflective tape',(-3.388,-1.02+i*.34,1.32),(.012,.21,.07),'survivorRed',bevel=.002)

    # Separate lamp assemblies and semantic light anchors.
    front=empty('lightsFront',(3.1,0,1.32),root)
    brake=empty('lightsBrake',(-3.3,0,1),root)
    for side in (-1,1):
        lamp=empty('lampHeadL' if side==-1 else 'lampHeadR',(.04,side*.82,.02),front)
        box('headlight surround',(3.135,side*.81,1.34),(.085,.4,.36),'silver')
        box('headlight',(3.184,side*.85,1.34),(.032,.24,.24),'windowGlow',lamp)
        box('turn lens',(3.184,side*.66,1.34),(.035,.105,.29),'schoolBusYellow',lamp)
        box('bumper lamp',(3.34,side*.83,.94),(.025,.2,.13),'windowGlow',lamp)
        tail=empty('lampBrakeL' if side==-1 else 'lampBrakeR',(-.05,side*.88,.05),brake)
        box('tail housing',(-3.33,side*.88,1.07),(.13,.3,.19),'uiDark')
        box('brake lens',(-3.407,side*.94,1.07),(.021,.14,.13),'sirenRed',tail)
        box('rear indicator',(-3.407,side*.81,1.07),(.021,.085,.13),'schoolBusYellow',tail)
        for node,pos,typ,color,emissive in [('headlight', (3.21,side*.85,1.34),'spot','light_led_white',lamp),('brake',(-3.43,side*.94,1.07),'point','light_siren_red',tail)]:
            anchor=empty('light:'+node+('L' if side==-1 else 'R'),pos,root)
            if typ=='spot': anchor.rotation_euler=(0,-math.pi/2+.12,0)
            anchor['ss_light']=json.dumps(dict(type=typ,color=color,intensity=4 if typ=='spot' else 1,range=18 if typ=='spot' else 2,angle=48,penumbra=.35,pool=True,beam='soft' if typ=='spot' else 'none',flare=True,reflect=True,shadow='hero' if typ=='spot' else 'none',heroPriority=2,flicker='none',animation=None,powerGroup='self',breakable=True,emissiveNodes=[emissive.name],tiers='all'))
    markers=empty('clearanceLamps',parent=root)
    for y in (-.78,-.27,0,.27,.78):
        box('marker base',(2.55,y,3.037),(.16,.12,.065),'silver')
        box('roof marker',(2.55,y,3.08),(.12,.085,.07),'schoolBusYellow',markers,bevel=.025)
    for side in (-1,1):
        for x in (-3.18,1.28):
            for z in (1.47,3.78): box('box marker',(x,side*1.23,z),(.12,.025,.09),'schoolBusYellow',markers)
    markers['decorativeEmissive']=True
    for name,loc in [('driverSeat',(1.98,-.48,1.64)),('exitL',(2,-1.52,0)),('exitR',(2,1.52,0))]: empty(name,loc,root)
    for name,loc,size in [('cargo',(-.95,0,2.59),(4.5,2.3,2.61)),('cab',(2.24,0,1.99),(1.88,2.04,2.14)),('chassis',(-.1,0,.63),(6.4,2.18,1.13))]:
        o=empty('col:'+name,loc,root); o['collider']='cuboid'; o['shape']='cuboid'; o['size']=list(size)

    # Apply modeling modifiers, then merge only within each joint/material group.
    meshes=[o for o in scene.objects if o.type=='MESH']
    for o in meshes:
        bpy.context.view_layer.objects.active=o; o.select_set(True)
        for mod in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
        o.select_set(False)
    groups={}
    for o in meshes: groups.setdefault((o.parent.name,o.data.materials[0].name),[]).append(o)
    for (parent,mat),objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects: o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join(); o=bpy.context.object
        o.name=parent+'_'+mat
        if parent=='clearanceLamps': o['decorativeEmissive']=True
        # Mesh origins at their owning joint, for stable runtime pivots.
        world=o.matrix_world.copy(); joint=bpy.data.objects[parent].matrix_world.copy()
        o.data.transform(joint.inverted()@world); o.matrix_world=joint
        o.data.calc_loop_triangles()
        # Only the hero needs dense bevel optimization. Lower tiers are authored cleanly.
        if lod==0:
            mod=o.modifiers.new('hero optimization','DECIMATE')
            mod.ratio=.8 if parent.startswith('door') or mat.endswith('blueTrim') else .27
            mod.use_collapse_triangulate=True; bpy.ops.object.modifier_apply(modifier=mod.name)
        o.data.calc_loop_triangles()
    if lod:
        for o in scene.objects:
            if o.type=='MESH': hard_normals(o)
    # Resolve lamp anchor references to exported emissive meshes.
    for anchor in scene.objects:
        if 'ss_light' in anchor:
            light=json.loads(anchor['ss_light'])
            prefixes=light['emissiveNodes']
            light['emissiveNodes']=[o.name for o in scene.objects if o.type=='MESH' and any(o.name.startswith(prefix+'_emi_') for prefix in prefixes)]
            anchor['ss_light']=json.dumps(light)
    # Bake real contact AO once across every assembly, including crevices.
    sys.path.insert(0,str(HERE.parents[1]/'tools/blender'))
    from sslib import ao
    if bake:
        ao.bake_all([o for o in scene.objects if o.type=='MESH'],samples=32)
    if lod and not bake:
        for o in scene.objects:
            if o.type=='MESH':
                layer=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='POINT')
                for value in layer.data: value.color=(1,1,1,1)
                o.data.color_attributes.active_color=layer
    bpy.ops.object.select_all(action='DESELECT')
    asset_objects=list(scene.objects)
    triangles=sum(len(o.data.loop_triangles) for o in asset_objects if o.type=='MESH')
    draw_calls=sum(len(o.data.materials) for o in asset_objects if o.type=='MESH')
    metadata=dict(id='veh.box-truck',tier='Hero',triangles=triangles,draw_calls=draw_calls,materials=sorted(m.name for m in M.values()),nodes_ok=True,within_budget=triangles<=80000 and draw_calls<=40,rounds=4,webgpu_ok=False,webgl2_ok=False,gaps=[])
    return M,asset_objects,metadata

M,asset_objects,metadata=build_scene(a.lod,bake=bool(a.glb))
if not a.lod: (HERE/'geometry.json').write_text(json.dumps(metadata,indent=2)+'\n')
def export_scene(path, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(path).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_yup=True)
if a.glb:
    export_scene(a.glb,asset_objects)
    stats_path=HERE/'lod-stats.json'
    lod_stats=json.loads(stats_path.read_text()) if stats_path.exists() else {}
    if a.lod:
        lod_stats[str(a.lod)]={'triangles':metadata['triangles'],'draw_calls':metadata['draw_calls']}
    else:
        for lod in (1,2):
            _,objects,stats=build_scene(lod,bake=True)
            export_scene(Path(a.glb).with_name('model.lod'+str(lod)+'.glb'),objects)
            lod_stats[str(lod)]={'triangles':stats['triangles'],'draw_calls':stats['draw_calls']}
        if a.render: M,asset_objects,_=build_scene()
    stats_path.write_text(json.dumps(lod_stats,indent=2)+'\n')
scene=bpy.context.scene
if a.render:
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015)); ground=bpy.context.object
    ground.name='studio ground'; ground.data.materials.append(M['asphalt'])
    scene.world=bpy.data.worlds.new('studio'); scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.15,.17,.22,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
    def area(name,pos,power,color,size):
        d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.color=color; d.shape='DISK'; d.size=size
        o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=pos; o.rotation_euler=(Vector((0,0,1.7))-o.location).to_track_quat('-Z','Y').to_euler()
    area('warm key',(1,-5,9),1700,(1,.81,.65),7)
    area('cool fill',(2,6,6),1300,(.68,.79,1),6)
    area('rim',(-6,1,7),1800,(1,.71,.45),5)
    d=bpy.data.cameras.new('camera'); cam=bpy.data.objects.new('camera',d); scene.collection.objects.link(cam)
    positions={'ref':(10,-14,8),'game':(12,-12,15),'front':(15,0,4.5),'side':(0,-16,4.5),'rear':(-13,-8,6)}
    cam.location=positions[a.view]; target=Vector((-.1,0,1.95))
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); d.type='ORTHO'; d.ortho_scale=12.8 if a.view=='game' else 10.6
    scene.camera=cam; scene.render.engine='CYCLES'; scene.cycles.samples=a.samples; scene.cycles.use_denoising=True
    scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'; scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(Path(a.render).resolve())
    bpy.ops.render.render(write_still=True)
print('OK',json.dumps(metadata))
