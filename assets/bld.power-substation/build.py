"""Sunset Grove electrical yard. Metres, +X entry, Z up; deterministic palette geometry."""
import argparse, json, math, random, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / 'tools/blender'))
from sslib import palette, ao

ASSET = {'id': 'bld.power-substation', 'category': 'building', 'tier': 'Hero'}
RNG = random.Random(241)
MATS = {}
GROUP = None

def material(token):
    if token not in MATS:
        m = palette.mat(token)
        m.use_backface_culling = True
        bs = m.node_tree.nodes.get('Principled BSDF')
        bs.inputs['Roughness'].default_value = 0.65
        bs.inputs['Metallic'].default_value = 0.0
        MATS[token] = m
    return MATS[token]

def mesh(name, verts, faces, token):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material(token))
    if GROUP:
        obj.parent = GROUP
        obj.matrix_parent_inverse = GROUP.matrix_world.inverted()
    return obj

def box(name, loc, size, token, bevel=0.025):
    x,y,z = [s/2 for s in size]
    o = mesh(name, [(-x,-y,-z),(-x,-y,z),(-x,y,-z),(-x,y,z),(x,-y,-z),(x,-y,z),(x,y,-z),(x,y,z)],
             [(2,6,4,0),(5,7,3,1),(4,5,1,0),(3,7,6,2),(1,3,2,0),(6,7,5,4)],token)
    o.location = loc
    if bevel:
        bpy.context.view_layer.objects.active = o
        b = o.modifiers.new('Soft corners','BEVEL'); b.width=bevel; b.segments=2 if min(size) > .15 and name not in ('Curb stone','Yard base') else 1
        bpy.ops.object.modifier_apply(modifier=b.name)
        n = o.modifiers.new('Face normals','WEIGHTED_NORMAL'); n.keep_sharp=True; n.weight=30
        bpy.ops.object.modifier_apply(modifier=n.name)
    return o

def rod(name, a, b, radius, token, sides=8):
    a,b=Vector(a),Vector(b); d=b-a
    q=d.to_track_quat('Z','Y')
    verts=[tuple(a+q@Vector((radius*math.cos(i*2*math.pi/sides),radius*math.sin(i*2*math.pi/sides),z))) for z in (0,d.length) for i in range(sides)]
    return mesh(name,verts,[tuple(range(sides-1,-1,-1)),tuple(range(sides,2*sides))]+[(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)],token)

def lathe(name, loc, profile, token, n=12):
    verts=[(loc[0]+r*math.cos(i*2*math.pi/n),loc[1]+r*math.sin(i*2*math.pi/n),loc[2]+z) for z,r in profile for i in range(n)]
    faces=[tuple(range(n-1,-1,-1)),tuple(range((len(profile)-1)*n,len(profile)*n))]
    for j in range(len(profile)-1):
        for i in range(n):
            faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    o=mesh(name,verts,faces,token)
    for p in o.data.polygons: p.use_smooth=True
    return o

def ball(name, loc, r, token):
    return lathe(name,loc,[(-r,0.02*r),(-r*.7,r*.7),(0,r),(r*.7,r*.7),(r,.02*r)],token,12)

def cable(name, pts, radius, token, steps=12):
    # Quadratic sag is sampled into a single low-sided tube mesh.
    verts=[]; faces=[]; points=[]
    for j in range(len(pts)-1):
        a,b=Vector(pts[j]),Vector(pts[j+1])
        for i in range(steps):
            t=i/steps; p=a.lerp(b,t); p.z-=0.18*4*t*(1-t); points.append(p)
    points.append(Vector(pts[-1]))
    for j,p in enumerate(points):
        d=points[min(j+1,len(points)-1)]-points[max(j-1,0)]
        q=d.to_track_quat('Z','Y')
        verts.extend(tuple(p+q@Vector((radius*math.cos(i*math.tau/6),radius*math.sin(i*math.tau/6),0))) for i in range(6))
    for j in range(len(points)-1):
        for i in range(6): faces.append((j*6+i,j*6+(i+1)%6,(j+1)*6+(i+1)%6,(j+1)*6+i))
    return mesh(name,verts,faces,token)

def text(name, string, pos, width, height, token):
    cu=bpy.data.curves.new(name,'FONT'); cu.body=string;
    cu.offset=.008  # Weight the built-in font without an external font dependency.
    cu.align_x='CENTER'; cu.align_y='CENTER'; cu.size=1; cu.extrude=.0015; cu.resolution_u=2
    o=bpy.data.objects.new(name,cu); bpy.context.collection.objects.link(o); o.location=pos
    # Text plane's normal is +X; baseline runs +Y.
    o.rotation_euler=(math.pi/2,0,math.pi/2)
    cu.materials.append(material(token))
    bpy.context.view_layer.update()
    scale=min(width/max(o.dimensions.x,.01),height/max(o.dimensions.y,.01)); o.scale=(scale,scale,scale)
    bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
    if GROUP: o.parent=GROUP; o.matrix_parent_inverse=GROUP.matrix_world.inverted()
    return o

def icon(name, x,y,z, scale, token, shape='bolt'):
    coords=[(-.08,.5),(.23,.5),(.02,.08),(.30,.08),(-.26,-.5),(-.08,-.08),(-.32,-.08)] if shape=='bolt' else [(-.47,-.4),(.47,-.4),(0,.45)]
    v=[(x,y+a*scale,z+b*scale) for a,b in coords]
    return mesh(name,v,[tuple(range(len(v)-1,-1,-1)) if shape=='bolt' else tuple(range(len(v)))],token)

def sign(name,y,z,w,h,warning=False):
    box(name+' rim',(2.505,y,z),(.065,w,h),'survivorRed' if warning else 'silver',.045)
    box(name+' porcelain',(2.546,y,z),(.025,w-.055,h-.055),'picketWhite',.026)
    for yy in (-1,1):
        for zz in (-1,1): rod('Sign screw',(2.562,y+yy*(w/2-.08),z+zz*(h/2-.075)),(2.576,y+yy*(w/2-.08),z+zz*(h/2-.075)),.021,'uiDark',6)
    if warning:
        icon('Red warning triangle',2.566,y-.55,z+.23,.47,'survivorRed','triangle')
        text('Exclamation','!',(2.574,y-.55,z+.22),.13,.24,'picketWhite')
        text('DANGER','DANGER',(2.568,y+.16,z+.24),1.08,.30,'uiDark')
        box('Red separator',(2.57,y,z+.005),(.012,w-.18,.035),'survivorRed',0)
        icon('Hazard lightning',2.573,y-.58,z-.26,.39,'uiDark')
        text('High voltage','HIGH VOLTAGE',(2.57,y+.14,z-.25),1.12,.20,'uiDark')
    else:
        icon('Utility lightning',2.57,y,z+.27,.60,'packBlue')
        text('Town name','SUNSET GROVE',(2.57,y,z-.24),w-.14,.19,'blueTrim')
        text('Utility name','POWER',(2.57,y,z-.51),w-.30,.25,'blueTrim')

def fence_panel(a,b):
    a,b=Vector(a),Vector(b); d=b-a; length=d.length; u=d.normalized()
    bottom=.43; top=2.37
    for z in (bottom,top): rod('Fence rail',a+Vector((0,0,z)),b+Vector((0,0,z)),.043,'denimLight')
    # Clip diagonals to the panel boundary; each diamond is actual open geometry.
    spacing=.28
    for slope in (-1,1):
        for k in range(-int((top-bottom)/spacing)-1,int(length/spacing)+2):
            intercept=k*spacing
            lo=max(0,intercept if slope==1 else intercept-(top-bottom))
            hi=min(length,intercept+(top-bottom) if slope==1 else intercept)
            if hi<=lo: continue
            z0=bottom+slope*(lo-intercept); z1=bottom+slope*(hi-intercept)
            rod('Diamond mesh',a+u*lo+Vector((0,0,z0)),a+u*hi+Vector((0,0,z1)),.012,'denimStitch',4)
    for i in range(int(length/.23)+1):
        p=a+u*(i*length/max(int(length/.23),1))
        rod('Fence top ties',p+Vector((0,0,top-.04)),p+Vector((0,0,top+.095)),.012,'silver',5)

def post(x,y):
    box('Post footing',(x,y,.3),(.31,.31,.24),'sidewalk',.035)
    rod('Fence upright',(x,y,.34),(x,y,2.51),.066,'denimLight',10)
    ball('Round fence finial',(x,y,2.58),.12,'silver')
    for z in (.58,1.15,2.31):
        box('Post saddle',(x,y,z),(.17,.17,.115),'silver',.015)
        rod('Clamp bolt',(x+.09,y,z),(x+.106,y,z),.019,'uiDark',6)

def insulator(x,y,z,small=False):
    s=.65 if small else 1
    profile=[(0,.115),(.12,.115)]
    for j in range(4):
        z0=.12+j*.12
        profile += [(z0,.13),(z0+.03,.205),(z0+.066,.19),(z0+.095,.095)]
    profile += [(.67,.085),(.72,.12),(.755,.10),(.81,.065)]
    lathe('Porcelain bushing',(x,y,z),[(a*s,b*s) for a,b in profile],'picketWhite')
    lathe('Bushing brass mount',(x,y,z-.10),[(0,.12*s),(.12,.12*s)],'brass')
    ball('Bushing terminal',(x,y,z+.85*s),.09*s,'silver')

def plant(x,y,s):
    # Six broad leaves, 24 triangles per rosette, no per-leaf objects.
    verts=[]; faces=[]
    for j in range(6):
        a=j*math.tau/6+RNG.random()*.25; d=Vector((math.cos(a),math.sin(a),0)); t=Vector((-d.y,d.x,0)); origin=Vector((x,y,.42)); idx=len(verts)
        verts += [tuple(origin),tuple(origin+d*s*.48+t*s*.11+Vector((0,0,s*.27))),tuple(origin+d*s+Vector((0,0,s*.12))),tuple(origin+d*s*.48-t*s*.11+Vector((0,0,s*.27))),tuple(origin+d*s*.44+Vector((0,0,s*.40)))]
        faces += [(idx,idx+1,idx+4),(idx+1,idx+2,idx+4),(idx+2,idx+3,idx+4),(idx+3,idx,idx+4)]
    mesh('Ground rosette',verts,[tuple(reversed(f)) for f in faces],RNG.choice(('grass','foliage','schoolBusYellow')))

def build(ctx=None):
    global GROUP
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    root=bpy.data.objects.new('root',None); bpy.context.collection.objects.link(root); root['asset_id']=ASSET['id']; root['forward']='+X'
    for name in ('interior','roof','front'):
        e=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(e); e.parent=root
        if name=='front': e.location=(2.45,0,0)
    box('Yard base',(0,0,.105),(6.10,6.5,.21),'sidewalk',.07)
    box('Gravel bed',(0,0,.227),(5.64,6.04,.045),'asphalt',.02)
    # Chunky outer curb with deliberately separated joints.
    for x in (-2.88,2.88):
        for i in range(10): box('Curb stone',(x,-2.91+i*.647,.205),(.36,.626,.39),'sidewalk',.045)
    for y in (-3.08,3.08):
        for i in range(9): box('Curb stone',(-2.58+i*.645,y,.205),(.625,.35,.39),'sidewalk',.045)
    for i in range(155):
        x=RNG.uniform(-2.62,2.62); y=RNG.uniform(-2.83,2.83)
        if x<.8 and abs(y)<2.05: continue
        s=RNG.uniform(.035,.085)
        mesh('Gravel',[(x-s,y,.25),(x+s,y,.25),(x,y-s,.25),(x,y+s,.25),(x,y,.25+s*.6),(x,y,.245)],[(0,2,4),(2,1,4),(1,3,4),(3,0,4),(2,0,5),(1,2,5),(3,1,5),(0,3,5)],'silver' if i%3 else 'picketWhite')
    # Two equipment plinths and transformer tanks.
    for y in (-1.25,1.25):
        box('Equipment concrete pad',(-.38,y,.32),(1.95,1.72,.18),'sidewalk',.05)
        for yy in (-.57,.57): box('Transformer skid',(-.38,y+yy,.46),(1.66,.11,.14),'uiDark',.02)
        box('Transformer tank',(-.38,y,1.37),(1.50,1.46,1.76),'silver',.065)
        box('Top flange',(-.38,y,2.29),(1.65,1.59,.16),'picketWhite',.04)
        box('Tank lower flange',(-.38,y,.57),(1.58,1.53,.1),'silver',.02)
        # Proud front access covers and inset dark meter apertures.
        box('Access door',( .395,y,1.43),(.045,1.28,1.54),'silver',.03)
        box('Meter border',(.435,y,1.02),(.07,.45,.52),'brass',.045)
        box('Meter black inset',(.478,y,1.02),(.023,.37,.43),'uiDark',.035)
        box('Meter face',(.495,y,1.05),(.014,.23,.20),'denimLight',.01)
        box('Access handle',(.48,y-.38,1.68),(.08,.04,.22),'brass',.015)
        for yy in (-.64,.64):
            for zz in (.70,2.13): rod('Tank fastener',(.414,y+yy,zz),(.445,y+yy,zz),.026,'uiDark',6)
        for j in range(9): box('Cooling fin',(-.70+j*.105,y-.79,1.40),(.055,.16,1.37),'denimLight',.016)
        rod('Oil pipe',(-1.18,y+.6,.70),(-1.18,y+.6,1.95),.045,'brass')
        for xx in (-.97,.15):
            for yy in (-.65,.65): rod('Lid bolt',(xx,y+yy,2.38),(xx,y+yy,2.425),.022,'uiDark',6)
        insulator(-.40,y,2.39)
        insulator(-.75,y+.48,2.39,True)
        ball('Tank corner terminal',(.08,y-.48,2.48),.10,'silver')
        text('Equipment ID','SG-'+('01' if y<0 else '02'),(.45,y,1.91),.36,.11,'blueTrim')
    box('Control cabinet',(.03,0,1.20),(.88,.70,1.37),'denimLight',.045)
    box('Control face',(.50,0,1.21),(.075,.63,1.25),'silver',.025)
    box('Control handle',(.55,-.23,1.18),(.05,.035,.22),'uiDark',.01)
    for y in (-.18,.18):
        box('Control indicator trim',(.55,y,1.70),(.06,.14,.09),'uiDark',.01)
        box('Amber indicator',(.587,y,1.70),(.015,.085,.055),'schoolBusYellow',.005)
    for i in range(6): box('Control vent',(.552,0,.79+i*.054),(.013,.35,.019),'uiDark',0)
    box('Switch housing',(.03,0,2.02),(.61,.51,.26),'woodWarm',.04)
    for y in (-.19,.19): box('Disconnect terminal',(.03,y,2.19),(.19,.09,.27),'uiDark',.02)
    rod('Disconnect blade',(-.02,-.19,2.32),(.20,.19,2.39),.04,'brass')
    # Four timber gantry poles; asymmetric heights echo the reference.
    for x in (-1.91,-.65):
        for y in (-2.16,2.16):
            h=4.15 if x<-1 else 3.94
            box('Pole shoe',(x,y,.39),(.32,.32,.32),'denimLight',.025)
            box('Timber pole',(x,y,h/2+.26),(.19,.23,h),'woodWarm',.04)
            box('Timber cap',(x,y,h+.31),(.26,.29,.17),'woodWarm',.035)
            for z in (1.5,2.0,3.90): rod('Pole bolt',(x+.102,y,z),(x+.125,y,z),.025,'uiDark',6)
            box('Pole crossarm',(x,y,h-.04),(.21,.93,.18),'woodWarm',.025)
            box('Crossarm bracket',(x+.12,y,h-.04),(.055,.23,.22),'silver',.015)
            rod('Gantry brace',(x,y,h-.62),(x,y+.38,h-.11),.026,'brass')
            for yy in (-.34,.34):
                rod('Line terminal stem',(x,y+yy,h+.02),(x,y+yy,h+.24),.034,'brass')
                ball('Line terminal',(x,y+yy,h+.29),.087,'picketWhite')
    for offset in (-.34,.34):
        for x in (-1.91,-.65): cable('Overhead power line',[(x,-2.16+offset,4.44 if x<-1 else 4.23),(x,2.16+offset,4.44 if x<-1 else 4.23)],.025,'denim',18)
    for y in (-1.25,1.25):
        cable('Transformer feed',[(-1.91,y,4.20),(-.40,y,3.24)],.025,'brass',10)
        cable('Bus jumper',[(-.75,y+.48,2.98),(.03,0,2.37)],.024,'denim',10)
    # Yard perimeter, hinge-origin gate kept separate from static material batches.
    for y in (-2.66,2.66):
        fence_panel((2.45,y,0),(-2.45,y,0))
        post(0,y)
    fence_panel((-2.45,-2.66,0),(-2.45,2.66,0))
    fence_panel((2.45,-2.66,0),(2.45,-.55,0))
    fence_panel((2.45,.55,0),(2.45,2.66,0))
    for x in (-2.45,2.45):
        for y in (-2.66,2.66): post(x,y)
    for y in (-.55,.55): post(2.45,y)
    gate=bpy.data.objects.new('door_gate',None); bpy.context.collection.objects.link(gate); gate.location=(2.45,-.55,.43); gate.parent=root; gate['hinge_axis']='Z'
    bpy.context.view_layer.update(); GROUP=gate
    fence_panel((2.45,-.49,0),(2.45,.49,0))
    for y in (-.49,.49): rod('Gate stile',(2.45,y,.43),(2.45,y,2.37),.035,'denimLight')
    rod('Gate brace',(2.45,-.49,.43),(2.45,.49,2.37),.025,'denimLight')
    box('Gate latch',(2.52,.35,1.25),(.10,.26,.055),'silver',.015)
    box('Padlock',(2.57,.30,1.16),(.09,.09,.13),'brass',.02)
    GROUP=None
    for z in (.72,1.95): rod('Gate hinge',(2.45,-.53,z-.075),(2.45,-.53,z+.075),.057,'silver')
    sign('Danger sign',-1.58,1.54,1.70,1.04,True)
    sign('Utility sign',1.52,1.33,1.55,1.60)
    # Side warning plate is oriented to face the visible -Y fence.
    GROUP=None
    for side in (-1,1):
        box('Side sign',(0,side*2.735,1.62),(.65,.04,.80),'survivorRed',.025)
        box('Side sign face',(0,side*2.764,1.62),(.58,.012,.73),'picketWhite',.01)
        mesh('Side warning triangle',[(-.2,side*2.775,1.65),(.2,side*2.775,1.65),(0,side*2.775,1.94)],[(0,1,2) if side<0 else (2,1,0)],'survivorRed')
        for z in (1.38,1.46,1.54): box('Side warning bars',(0,side*2.778,z),(.39,.012,.035),'survivorRed',0)
    for i in range(36):
        side=i%4; t=RNG.uniform(-2.75,2.75)
        x,y=(2.87,t) if side==0 else (-2.86,t) if side==1 else (t,-3.07) if side==2 else (t,3.07)
        plant(x,y,RNG.uniform(.28,.48))
    for i in range(8):
        x,y=(2.86,-2.65+i*.69) if i<4 else (-2.2+(i-4)*1.15,3.02)
        z=.63
        rod('Flower stem',(x,y,.40),(x,y,z),.011,'foliage',5)
        verts=[]; faces=[]
        for j in range(5):
            a=j*math.tau/5; d=Vector((math.cos(a),math.sin(a),0)); t=Vector((-d.y,d.x,0)); c=Vector((x,y,z)); k=len(verts)
            verts += [tuple(c+d*.025),tuple(c+d*.075+t*.033),tuple(c+d*.13),tuple(c+d*.075-t*.033)]
            faces.extend([(k,k+1,k+2),(k,k+2,k+3)])
        mesh('Daisy petals',verts,[tuple(reversed(f)) for f in faces],'picketWhite')
        rod('Daisy center',(x,y,z-.007),(x,y,z+.013),.027,'schoolBusYellow',8)
    # All remaining meshes are static; one exported primitive per palette material per motion group.
    groups={}
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH': groups.setdefault((o.parent.name if o.parent else 'static',o.data.materials[0].name),[]).append(o)
    for (parent,matname),objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects: o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join()
        o=bpy.context.object; o.name=('gate_' if parent=='door_gate' else 'static_')+matname
        if parent=='static': o.parent=root
    # Compound static colliders leave the service aisle and gate opening accessible.
    colliders=[('back',(-2.45,0,1.40),(.16,5.42,2.0)),('left',(0,-2.66,1.40),(5.0,.16,2.0)),('right',(0,2.66,1.40),(5.0,.16,2.0)),('frontL',(2.45,-1.61,1.40),(.16,2.11,2.0)),('frontR',(2.45,1.61,1.40),(.16,2.11,2.0)),('tankL',(-.38,-1.25,1.40),(1.65,1.62,2.18)),('tankR',(-.38,1.25,1.40),(1.65,1.62,2.18)),('control',(.03,0,1.38),(.90,.72,1.98))]
    for name,loc,size in colliders:
        c=bpy.data.objects.new('col:'+name,None); bpy.context.collection.objects.link(c); c.parent=root; c.location=loc; c['collider']='cuboid'; c['size']=list(size)
    c=bpy.data.objects.new('col:gate',None); bpy.context.collection.objects.link(c); c.parent=gate; c.location=(0,.55,.97); c['collider']='cuboid'; c['size']=[.12,1.0,1.94]
    return root

def export_models(path):
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    ao.bake_all(meshes,samples=16)
    def write(p):
        bpy.ops.object.select_all(action='DESELECT')
        for obj in bpy.context.scene.objects:
            if not obj.hide_viewport: obj.select_set(True)
        bpy.ops.export_scene.gltf(use_selection=True,filepath=str(p),export_format='GLB',export_apply=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
    write(path)
    def counts():
        tris=0
        for o in meshes:
            o.data.calc_loop_triangles()
            if not o.hide_viewport: tris+=len(o.data.loop_triangles)
        return tris
    base=counts()
    materials=sorted({m.name for o in meshes for m in o.data.materials})
    lodstats=[]
    for suffix,ratio in (('lod1',.125),('lod2',.017)):
        backups={o:o.data for o in meshes}
        distant_omissions=[]
        if suffix=='lod2':
            for o in meshes:
                if o.name in ('static_pal_blueTrim','static_pal_grass','static_pal_foliage'):
                    distant_omissions.append(o); o.hide_render=True; o.hide_viewport=True
        for o in meshes:
            o.data=o.data.copy()
            if suffix=='lod2':
                bm=bmesh.new(); bm.from_mesh(o.data)
                visited=set(); remove=[]
                for v in bm.verts:
                    if v in visited: continue
                    component=[]; todo=[v]; visited.add(v)
                    while todo:
                        u=todo.pop(); component.append(u)
                        for edge in u.link_edges:
                            other=edge.other_vert(u)
                            if other not in visited: visited.add(other); todo.append(other)
                    extent=max(max(v.co[a] for v in component)-min(v.co[a] for v in component) for a in range(3))
                    if extent<.18: remove.extend(component)
                bmesh.ops.delete(bm,geom=remove,context='VERTS'); bm.to_mesh(o.data); bm.free()
            bpy.context.view_layer.objects.active=o
            mod=o.modifiers.new('LOD simplify','DECIMATE'); mod.ratio=ratio; mod.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=mod.name)
        write(path.with_name('model.'+suffix+'.glb')); lodstats.append(counts())
        for o,data in backups.items(): o.data=data
        for o in distant_omissions: o.hide_render=False; o.hide_viewport=False
    report={'id':ASSET['id'],'tier':'Hero','triangles':base,'draw_calls':len(meshes),'materials':materials,'nodes_ok':True,'within_budget':base<=30000 and len(meshes)<=40,'rounds':5,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
    (HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    (HERE/'lod-stats.json').write_text(json.dumps({'lod0':base,'lod1':lodstats[0],'lod2':lodstats[1]},indent=2)+'\n')
    print('OK export',report,'LOD',lodstats)

def render(path,view,samples,width,height):
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=samples; scene.cycles.use_denoising=True; scene.cycles.seed=241
    scene.world.color=(.20,.20,.20)
    scene.world.use_nodes=True; scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.14,.19,1); scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
    # Studio floor is render-only and never present in an export.
    box('Studio floor',(0,0,-.10),(200,200,.16),'uiDark',0)
    def area(name,loc,energy,color,size):
        data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.color=color; data.shape='DISK'; data.size=size
        o=bpy.data.objects.new(name,data); scene.collection.objects.link(o); o.location=loc; o.rotation_euler=(Vector((0,0,1.5))-o.location).to_track_quat('-Z','Y').to_euler()
    area('Warm key',(1,-5,9),1500,(1,.72,.48),7)
    area('Lavender fill',(2,5,7),1000,(.62,.68,1),6)
    area('Gold rim',(-4,-1,7),1600,(1,.54,.22),5)
    camdata=bpy.data.cameras.new('Camera'); cam=bpy.data.objects.new('Camera',camdata); scene.collection.objects.link(cam); scene.camera=cam
    target=Vector((0,0,1.9)); direction=Vector((14,10,10))
    if view=='game': direction=Vector((10,-10,12)); target=Vector((0,0,1.9))
    if view=='front': direction=Vector((16,0,6))
    if view=='side': direction=Vector((0,-16,6))
    if view=='rear': direction=Vector((-12,12,9))
    cam.location=target+direction; cam.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler(); camdata.type='ORTHO'; camdata.ortho_scale=13.8 if view!='game' else 16
    scene.render.resolution_x=width; scene.render.resolution_y=height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'; scene.render.image_settings.file_format='PNG'; scene.render.filepath=str(path); Path(path).parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'model.blend'))
    bpy.ops.render.render(write_still=True); print('OK rendered',path)

if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('--render'); p.add_argument('--view',default='ref'); p.add_argument('--samples',type=int,default=24); p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540); p.add_argument('--glb'); args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    build()
    if args.glb: export_models(Path(args.glb))
    if args.render: render(args.render,args.view,args.samples,args.width,args.height)
