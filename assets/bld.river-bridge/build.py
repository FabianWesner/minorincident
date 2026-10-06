"""Sunset Grove river bridge: deterministic texture-free, metre-scale Hero asset.
Road runs +X, river runs Y; static geometry merges by palette material.
Four lantern heads pivot at their gooseneck joints. LODs rebuild simpler geometry.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--render'); parser.add_argument('--glb')
parser.add_argument('--view', default='ref')
parser.add_argument('--samples', type=int, default=24)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--height', type=int, default=540)
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
PALETTE = {'asphalt':'5b4f5c','sidewalk':'b9a4a0','picketWhite':'f2e6dc',
           'schoolBusYellow':'f2b630','uiDark':'25222c','woodWarm':'b0703f',
           'grass':'6f8f3a','foliage':'7da23c','backpackTeal':'22576f'}


def material(token, color, emission=0):
    rgb=[int(color[i:i+2],16)/255 for i in (0,2,4)]
    rgb=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    m=bpy.data.materials.new(('emi_' if emission else 'pal_')+token)
    m.use_nodes=True; p=m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Roughness'].default_value=.78
    if token=='uiDark':
        p.inputs['Metallic'].default_value=.5; p.inputs['Roughness'].default_value=.36
    if token=='backpackTeal': p.inputs['Roughness'].default_value=.45
    if emission:
        p.inputs['Emission Color'].default_value=(*rgb,1)
        p.inputs['Emission Strength'].default_value=emission
    m.diffuse_color=(*rgb,1)
    return m


def empty(name,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.scene.collection.objects.link(o)
    o.location=loc; o.parent=parent
    return o


def mesh(name,vs,fs,token,parent=None):
    me=bpy.data.meshes.new(name); me.from_pydata(vs,[],fs); me.update()
    o=bpy.data.objects.new(name,me); bpy.context.scene.collection.objects.link(o)
    me.materials.append(M[token]); o.parent=parent or body
    colors=me.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
    for v in colors.data: v.color=(1,1,1,1)
    return o


def finish(o,token,parent,bevel=0):
    o.name=token+' part'; o.data.materials.append(M[token]); o.parent=parent or body
    colors=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
    for v in colors.data: v.color=(1,1,1,1)
    if bevel:
        mod=o.modifiers.new('Soft edges','BEVEL'); mod.width=bevel; mod.segments=SEG
        mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); mod.keep_sharp=True
    return o


def box(name,c,size,token,bevel=.035,parent=None):
    if LOD==2 and name in ('Yellow shoulder marking','Dashed yellow centerline','Bridge expansion joint','White approach bar'):
        x,y,z=c; a,b,h=size
        return mesh(name,[(x-a/2,y-b/2,z+h/2),(x+a/2,y-b/2,z+h/2),
                    (x+a/2,y+b/2,z+h/2),(x-a/2,y+b/2,z+h/2)],[(0,1,2,3)],token,parent)
    bpy.ops.mesh.primitive_cube_add(size=1,location=c)
    o=bpy.context.object; o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    finish(o,token,parent,min(bevel,min(size)*.3) if LOD<2 else 0); o.name=name
    return o


def cylinder(name,c,r,depth,token,parent=None,verts=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts or SIDES,radius=r,depth=depth,location=c)
    o=finish(bpy.context.object,token,parent); o.name=name
    for p in o.data.polygons: p.use_smooth=len(p.vertices)==4
    return o


def rod(name,a,b,r,token,parent=None):
    d=Vector(b)-Vector(a); o=cylinder(name,(Vector(a)+Vector(b))/2,r,d.length,token,parent)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return o


def rock(c,size,token='sidewalk',detail=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=detail if LOD==0 else 1,radius=1,location=c)
    o=bpy.context.object
    for v in o.data.vertices:
        v.co*=rng.uniform(.87,1.1)
    o.scale=size; finish(o,token,None); o.name='Faceted river boulder'
    return o


def ribbon(name,points,width,token):
    vs=[]
    for i,p in enumerate(points):
        a=Vector(points[max(0,i-1)]); b=Vector(points[min(len(points)-1,i+1)])
        d=b-a; n=Vector((-d.y,d.x,0)).normalized()*width/2
        vs.extend([Vector(p)+n,Vector(p)-n])
    return mesh(name,vs,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(points)-1)],token)


def bush(x,y,z,scale):
    # A handful of broad leaf clusters, not individual leaves or wires.
    count=[6,3,1][LOD]
    for i in range(count):
        a=i*2.4; h=scale*(.34+.1*(i%3))
        c=(x+math.cos(a)*scale*.3,y+math.sin(a)*scale*.3,z+h)
        rock(c,(scale*.34,scale*.26,scale*.28),'foliage',detail=1)
        if LOD<2:
            h=scale*(.55+.10*(i%3))
            tip=(c[0],c[1],z+h)
            rod('Flower stalk',(c[0],c[1],z+.10),tip,.013,'grass')
            rock(tip,(scale*.09,scale*.09,scale*.065),'schoolBusYellow',detail=1)


def tuft(x,y,z,scale):
    for i in range([7,3,2][LOD]):
        a=i*2.399; dx=math.cos(a); dy=math.sin(a)
        h=scale*rng.uniform(.65,1.15); w=scale*.1
        mesh('Broad grass blade',[(x-dy*w,y+dx*w,z),(x+dy*w,y-dx*w,z),
             (x+dx*h*.32+dy*w*.4,y+dy*h*.32-dx*w*.4,z+h*.65),
             (x+dx*h*.6,y+dy*h*.6,z+h)],[(0,1,2,3)],'grass')


def hazard(x,y,sign):
    box('Hazard plate',(x+sign*.367,y,3.59),(.032,.49,.76),'schoolBusYellow',.012)
    # Clipped diagonal stripes: faces stand 8 mm clear of the yellow plate.
    def clip(poly,axis,limit,greater):
        out=[]
        for a,b in zip(poly,poly[1:]+poly[:1]):
            ia=a[axis]>=limit if greater else a[axis]<=limit
            ib=b[axis]>=limit if greater else b[axis]<=limit
            if ia: out.append(a)
            if ia!=ib:
                t=(limit-a[axis])/(b[axis]-a[axis]); out.append(tuple(a[k]+t*(b[k]-a[k]) for k in (0,1)))
        return out
    for i in range(-3,4):
        u=i*.29; poly=[(u-.10,0),(u+.03,0),(u+.45,.72),(u+.32,.72)]
        poly=clip(clip(poly,0,-.22,True),0,.22,False)
        if len(poly)>2:
            mesh('Hazard diagonal',[(x+sign*.395,y+a,3.23+b) for a,b in poly],[tuple(range(len(poly)))],'uiDark')


def lamp(x,y,index):
    # Poles are static; lantern body can swing at the top mounting joint.
    cylinder('Lamp base',(x,y,3.04),.20,.32,'uiDark')
    if LOD<2: cylinder('Base collar',(x,y,3.25),.15,.10,'sidewalk')
    cylinder('Tapered cast post',(x,y,4.62),.072,2.76,'uiDark')
    if LOD<2:
        for z in [3.31,5.82,5.99]: cylinder('Post collar',(x,y,z),.094,.06,'sidewalk')
    direction=-1 if y>0 else 1
    pts=[(x,y,5.9),(x,y+direction*.15,6.08),(x,y+direction*.38,6.18),(x,y+direction*.65,6.13)]
    if LOD==2: pts=[pts[0],pts[2],pts[3]]
    for a,b in zip(pts,pts[1:]): rod('Gooseneck arm',a,b,.05,'uiDark')
    px,py,pz=pts[-1]
    g=empty('lamp_%d'%index,(px,py,pz),root); g['pivot_description']='top suspension joint'
    # Local coordinates keep every material mesh origin at its suspension pivot.
    if LOD<2: cylinder('Lantern finial',(0,0,.035),.08,.12,'uiDark',g)
    box('Glowing lantern',(0,0,-.37),(.36,.36,.43),'glow',.022,g)
    if LOD<2:
        box('Lantern lower frame',(0,0,-.59),(.41,.41,.045),'uiDark',.012,g)
        box('Lantern upper rim',(0,0,-.12),(.55,.55,.065),'uiDark',.025,g)
    vs=[(-.29,-.29,-.105),(.29,-.29,-.105),(.29,.29,-.105),(-.29,.29,-.105),(0,0,.055)]
    mesh('Pyramidal lantern cap',vs,[(0,3,2,1),(0,1,4),(1,2,4),(2,3,4),(3,0,4)],'uiDark',g)
    for a in ([-1,1] if LOD<2 else []):
        for b in [-1,1]: rod('Lantern mullion',(a*.18,b*.18,-.14),(a*.18,b*.18,-.60),.018,'uiDark',g)
    anchor=empty('light:bridge_%d'%index,(0,0,-.39),g)
    anchor['ss_light']=json.dumps({'type':'point','color':'light_sodium','intensity':3.5,'range':7,
        'pool':True,'beam':'none','flare':True,'reflect':True,'shadow':'none','heroPriority':1,
        'flicker':'none','animation':None,'powerGroup':'river_bridge','breakable':True,
        'emissiveNodes':['lamp_%d_emi_windowGlow'%index],'tiers':'all'})


def build(lod):
    global M,root,body,rng,LOD,SEG,SIDES
    bpy.ops.wm.read_factory_settings(use_empty=True)
    LOD=lod; SEG=[2,1,0][lod]; SIDES=[12,8,5][lod]; rng=random.Random(226)
    scene=bpy.context.scene; scene.unit_settings.system='METRIC'
    M={t:material(t,c) for t,c in PALETTE.items()}; M['glow']=material('windowGlow','ffc773',4)
    root=empty('root'); root['asset_id']='bld.river-bridge'; root['category']='building'
    root['forward']='+X'; root['tier']='Hero'; body=empty('body',parent=root)
    front=empty('front',(6.5,0,3.18),root); front['front']=True
    # River tile with sculpted ripples and complete earth banks, bottom at z=0.
    for x in [-6.5,6.5]:
        box('Earth bank',(x,0,.28),(3,12,.56),'woodWarm',.12)
        box('Grassy bank cap',(x,0,.57),(2.95,11.96,.12),'grass',.055)
    nx,ny=[(32,40),(10,14),(4,6)][lod]
    vs=[]
    for j in range(ny+1):
        y=-6+12*j/ny
        for i in range(nx+1):
            x=-5+10*i/nx
            z=.35+.045*math.sin(y*3+x*4)+.025*math.cos(y*5-x*2)
            vs.append((x,y,z))
    fs=[]
    for j in range(ny):
        for i in range(nx):
            k=j*(nx+1)+i; fs.extend([(k,k+1,k+nx+2),(k,k+nx+2,k+nx+1)])
    river=mesh('River rippled surface',vs,fs,'backpackTeal')
    for face in river.data.polygons: face.use_smooth=True
    if lod<2:
        for i in range([55,12][lod]):
            x=rng.uniform(-4.9,4.9); y=rng.uniform(-5.9,5.6)
            pts=[]
            for k in range(6 if lod==0 else 3):
                a=x+.10*math.sin(k*.9+i); b=y+k*.13
                h=.35+.045*math.sin(b*3+a*4)+.025*math.cos(b*5-a*2)+.045
                pts.append((a,b,h))
            ribbon('River foam ripple',pts,.016 if i%3 else .028,'picketWhite')
    # One road module, with end abutments and a central pier visible in the reference.
    for x in [-5.25,0,5.25]:
        for row in range(3 if lod==0 else 1):
            h=.79 if lod==0 else 2.39
            z=.61+row*.8+h/2
            box('Concrete pier course',(x,0,z),(1.05,6.3,h),'sidewalk',.055)
        box('Pier bearing cap',(x,0,2.73),(1.34,6.63,.24),'sidewalk',.07)
        if lod==0:
            for sign in [-1,1]:
                for i in range(4):
                    u=x-.39+i*.25; h=rng.uniform(.20,.65); z=2.60
                    mesh('Concrete rain streak',[(u-.025,sign*3.158,z),(u+.026,sign*3.158,z),
                         (u+.01,sign*3.158,z-h),(u-.007,sign*3.158,z-h-.13)],[(0,1,2,3)],'asphalt')
                    mesh('Pier moss patch',[(u-.09,sign*3.16,.62),(u+.07,sign*3.16,.62),
                         (u+.06,sign*3.16,.89),(u-.03,sign*3.16,1.03),(u-.08,sign*3.16,.83)],[(0,1,2,3,4)],'grass')
    box('Structural deck',(0,0,2.91),(13.1,6.8,.40),'sidewalk',.06)
    box('Road asphalt',(0,0,3.135),(13,5.70,.09),'asphalt',.025)
    if lod==0:
        # Flat asphalt panels sit 5 mm over the bed; narrow gaps form real seams.
        for ix in range(10):
            for iy in range(4):
                x=-6.5+ix*1.3; y=-2.85+iy*1.425
                panel=mesh('Asphalt resurfacing panel',[(x+.009,y+.009,3.185),(x+1.291,y+.009,3.185),
                     (x+1.291,y+1.416,3.185),(x+.009,y+1.416,3.185)],[(0,1,2,3)],'asphalt')
                tone=rng.uniform(.68,1.12)
                for c in panel.data.color_attributes['ao'].data: c.color=(tone,tone*.96,tone*.96,1)
        for x,y in [(-4.2,-1.7),(1.6,1.4),(3.1,-1.8),(-.6,2.1)]:
            pts=[(x,y,3.194),(x+.20,y+.06,3.194),(x+.32,y+.21,3.194),(x+.59,y+.24,3.194)]
            ribbon('Fine pavement fissure',pts,.013,'uiDark')
    for y in [-3.13,3.13]:
        curb_count=[13,3,1][lod]
        for i in range(curb_count):
            length=13/curb_count
            x=-6.5+(i+.5)*length
            box('Sidewalk curb course',(x,y,3.22),(length-.022,.52,.38),'sidewalk',.035)
        # edge stripe is 10 mm clear of road top (3.18).
        box('Yellow shoulder marking',(0,y*.89,3.195),(12.88,.065,.010),'schoolBusYellow',0)
        for x in [-5.8,-1.92,1.92,5.8]:
            box('Concrete guard post',(x,y,3.73),(.60,.59,1.02),'sidewalk',.045)
            if lod<2: box('Post cap',(x,y,4.25),(.65,.64,.09),'picketWhite',.03)
            if lod==0:
                # mounting sockets and bolts remain raised away from concrete faces.
                for z in [3.66,4.06]:
                    c=cylinder('Rail socket',(x+.31,y,z),.12,.028,'woodWarm',verts=12)
                    c.rotation_euler=(0,math.pi/2,0)
        for z in [3.65,4.05]: rod('Continuous tubular guardrail',(-5.78,y,z),(5.78,y,z),.065,'uiDark')
        rail_count=[15,7,3][lod]
        for i in range(rail_count):
            x=-5.45+i*10.9/(rail_count-1)
            rod('Guardrail stanchion',(x,y,3.38),(x,y,4.07),.045,'uiDark')
            if lod==0:
                box('Rail foot plate',(x,y,3.419),(.18,.19,.022),'uiDark',.008)
                for z in [3.65,4.05]:
                    clamp=cylinder('Rail clamp',(x,y,z),.078,.15,'sidewalk',verts=12)
                    clamp.rotation_euler=(0,math.pi/2,0)
        for x in [-6.12,6.12]:
            box('End bollard',(x,y,3.55),(.68,.62,1.08),'sidewalk',.06)
            hazard(x,y,1 if x>0 else -1)
    for i in range(10): box('Dashed yellow centerline',(-5.85+i*1.30,0,3.196),(.77,.095,.012),'schoolBusYellow',0)
    for x in [-5.1,5.1]: box('Bridge expansion joint',(x,0,3.191),(.045,5.55,.008),'uiDark',0)
    for index,(x,y) in enumerate([(-5.95,-3.16),(5.95,-3.16),(-5.95,3.16),(5.95,3.16)]): lamp(x,y,index)
    # Rocks frame the channel. Vegetation stays at the banks, keeping road legible.
    for side in [-1,1]:
        for i in range([15,8,4][lod]):
            y=-5.6+i*11.2/([14,7,3][lod]); x=side*rng.uniform(4.60,5.42)
            s=rng.uniform(.33,.68); rock((x,y,.55),(s,s*.8,s*.65))
        for i in range([22,8,3][lod]):
            x=side*rng.uniform(5.1,7.7); y=rng.uniform(-5.7,5.7)
            if abs(y)<3.8: continue
            bush(x,y,.64,rng.uniform(.45,.9))
        for i in range([50,15,5][lod]):
            x=side*rng.uniform(4.95,7.85); y=rng.uniform(-5.85,5.85)
            if abs(y)<3.4 and abs(x)<6.7: continue
            tuft(x,y,.64,rng.uniform(.2,.5))
    if lod==0:
        for side in [-1,1]:
            for i in range(4):
                x=side*(4.85+.21*(i%2)); y=-4.95+i*.62
                rock((x,y,.72),(.72,.58,.55))
            for y in [-4.2,4.5]: bush(side*6.05,y,.64,1.1)
            # Bare-earth patches and scattered aggregate break up the flat bank.
            patches=[]
            for i in range(18):
                x=side*rng.uniform(5.25,7.75); y=rng.choice([-1,1])*rng.uniform(3.55,5.7)
                r=rng.uniform(.10,.34)
                if any(math.hypot(x-a,y-b)<r+q+.04 for a,b,q in patches): continue
                patches.append((x,y,r))
                points=[(x+math.cos(k*math.pi/3)*r,y+math.sin(k*math.pi/3)*r*.55,.638) for k in range(6)]
                mesh('Exposed earth patch',points,[tuple(range(6))],'woodWarm')
        for x in [-5.70,5.70]:
            box('White approach bar',(x,0,3.212),(.13,5.45,.010),'picketWhite',0)
    col=empty('col:deck',(0,0,2.96),root); col['collider']='cuboid'; col['size']=[13.1,6.8,.5]
    for y in [-3.13,3.13]:
        c=empty('col:rail_'+('L' if y>0 else 'R'),(0,y,3.73),root)
        c['collider']='cuboid'; c['size']=[13,.60,1.10]
    # Apply bevels, merge by material and animation parent, reset origins to joints.
    for o in list(scene.objects):
        if o.type=='MESH':
            bpy.context.view_layer.objects.active=o
            for mod in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    groups={}
    for o in scene.objects:
        if o.type=='MESH': groups.setdefault((o.parent,o.data.materials[0]),[]).append(o)
    for (parent,mat),objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects: o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join()
        o=bpy.context.object; o.name=parent.name+'_'+mat.name
        bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
        scene.cursor.location=parent.matrix_world.translation; bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    meshes=[o for o in scene.objects if o.type=='MESH']
    if lod==1:
        preserve={'pal_asphalt','pal_backpackTeal','pal_picketWhite','pal_schoolBusYellow','pal_woodWarm'}
        for o in meshes:
            if o.data.materials[0].name in preserve: continue
            bpy.context.view_layer.objects.active=o
            mod=o.modifiers.new('LOD1 secondary geometry','DECIMATE'); mod.ratio=.5
            bpy.ops.object.modifier_apply(modifier=mod.name)
    return meshes


def stats(meshes):
    return {'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes),
            'draw_calls':sum(len(o.data.materials) for o in meshes),
            'materials':sorted({m.name for o in meshes for m in o.data.materials})}


def stage():
    scene=bpy.context.scene
    # Preview-only vertex tint. Export materials retain scalar Principled inputs;
    # glTF multiplies exported COLOR_0 by the scalar palette base color itself.
    for m in M.values():
        p=m.node_tree.nodes['Principled BSDF']
        color=m.node_tree.nodes.new('ShaderNodeVertexColor'); color.layer_name='ao'
        mul=m.node_tree.nodes.new('ShaderNodeMixRGB'); mul.blend_type='MULTIPLY'
        mul.inputs[0].default_value=1; mul.inputs[1].default_value=p.inputs['Base Color'].default_value
        m.node_tree.links.new(color.outputs['Color'],mul.inputs[2])
        m.node_tree.links.new(mul.outputs['Color'],p.inputs['Base Color'])
    box('Studio floor',(0,0,-.14),(200,200,.20),'uiDark',0)
    scene.world=bpy.data.worlds.new('Warm studio'); scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.22,.24,.32,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
    for name,loc,energy,color,size in [('Key',(-3,-8,15),3600,(1,.78,.58),9),
        ('Fill',(8,-1,11),2100,(.72,.81,1),10),('Rim',(-4,8,12),3200,(1,.69,.40),7)]:
        d=bpy.data.lights.new(name,'AREA'); d.energy=energy; d.color=color; d.size=size
        o=bpy.data.objects.new(name,d); scene.collection.objects.link(o); o.location=loc
        o.rotation_euler=(Vector((0,0,2))-o.location).to_track_quat('-Z','Y').to_euler()
    for o in list(scene.objects):
        if o.name.startswith('light:'):
            d=bpy.data.lights.new('Lantern warm pool','POINT'); d.energy=38; d.color=(1,.38,.07); d.shadow_soft_size=.3
            n=bpy.data.objects.new('Lantern warm pool',d); scene.collection.objects.link(n); n.location=o.matrix_world.translation
    d=bpy.data.cameras.new('Camera'); c=bpy.data.objects.new('Camera',d); scene.collection.objects.link(c)
    views={'ref':(17,-24,17),'game':(20,-20,28),'front':(25,-1,12),'side':(1,-25,12),'rear':(-20,17,17)}
    c.location=views.get(args.view,views['ref']); c.rotation_euler=(Vector((0,0,1.8))-c.location).to_track_quat('-Z','Y').to_euler()
    d.type='ORTHO'; d.ortho_scale=29.5 if args.view=='game' else 25.5
    scene.camera=c; scene.render.engine='CYCLES'; scene.cycles.samples=args.samples
    scene.cycles.use_denoising=True; scene.cycles.seed=226
    scene.render.resolution_x=args.width; scene.render.resolution_y=args.height; scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'; scene.view_settings.look='AgX - Medium High Contrast'
    tree=bpy.data.node_groups.new('Warm lamp glow','CompositorNodeTree'); scene.compositing_node_group=tree
    tree.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
    rl=tree.nodes.new('CompositorNodeRLayers'); gl=tree.nodes.new('CompositorNodeGlare')
    gl.inputs['Type'].default_value='Fog Glow'; gl.inputs['Threshold'].default_value=1.5; gl.inputs['Strength'].default_value=.22
    out=tree.nodes.new('NodeGroupOutput'); tree.links.new(rl.outputs['Image'],gl.inputs['Image']); tree.links.new(gl.outputs['Image'],out.inputs['Image'])
    scene.render.filepath=str(Path(args.render).resolve()); bpy.ops.render.render(write_still=True)
    print('RENDER OK',args.render)


if args.glb:
    sys.path.insert(0,str(HERE.parents[1]/'tools'/'blender'))
    from sslib import ao
    metrics={}
    for lod,suffix in [(0,''),(1,'.lod1'),(2,'.lod2')]:
        meshes=build(lod); metrics['lod'+str(lod)]=stats(meshes)
        assert metrics['lod'+str(lod)]['triangles'] <= 40000
        assert metrics['lod'+str(lod)]['draw_calls'] <= 40
        if lod:
            ratio=metrics['lod'+str(lod)]['triangles']/metrics['lod0']['triangles']
            lower,upper=(.10,.15) if lod==1 else (.025,.04)
            assert lower<=ratio<=upper, 'LOD ratio outside delivery target'
        tints={o:[tuple(c.color) for c in o.data.color_attributes['ao'].data] for o in meshes}
        ao.bake_all(meshes,samples=32)
        for o in meshes:
            for c,tint in zip(o.data.color_attributes['ao'].data,tints[o]):
                c.color=tuple(c.color[k]*tint[k] for k in range(3))+(1,)
        bpy.ops.object.select_all(action='SELECT')
        path=Path(args.glb).resolve(); path=path.with_name(path.stem+suffix+path.suffix)
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
            export_apply=True,export_yup=True,export_extras=True,export_lights=False,export_cameras=False)
    (HERE/'metrics.json').write_text(json.dumps(metrics,indent=2))
    print('EXPORT OK',json.dumps(metrics))
if args.render:
    meshes=build(0); print('BUILD OK',json.dumps(stats(meshes))); stage()
