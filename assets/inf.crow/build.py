"""Flock-budget infected crow (LOD0 <= 3,000 triangles). Deterministic rigid joints; +X forward, +Z up.
Closed low-poly shells and smooth-shaded volumes; no textures, skins, or live modifiers in GLB.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector, Matrix
P = Path(__file__).resolve().parent
ap = argparse.ArgumentParser()
for k in ['render','glb']: ap.add_argument('--'+k)
ap.add_argument('--view',default='hero'); ap.add_argument('--pose',action='store_true'); ap.add_argument('--amputate',action='store_true')
ap.add_argument('--lod',type=int,choices=[0,1,2],default=0)
ap.add_argument('--samples',type=int,default=24)
ap.add_argument('--width',type=int,default=960); ap.add_argument('--height',type=int,default=540)
a = ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
S=bpy.context.scene; nodes={}; meshes=[]; caps=[]
def material(token,h,rough=.65,emit=0):
    m=bpy.data.materials.new(('emi_' if emit else 'pal_')+token); m.use_nodes=True
    c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    c=[x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in c]+[1]
    b=m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value=c; b.inputs['Roughness'].default_value=rough
    if emit: b.inputs['Emission Color'].default_value=c; b.inputs['Emission Strength'].default_value=emit
    m.diffuse_color=c; return m
M={k:material(k,h,r) for k,h,r in [('uiDark','25222c',.58),('asphalt','5b4f5c',.68),('sidewalk','b9a4a0',.53),('blood','b3121f',.42),('infectedSkin','c9a39a',.7),('picketWhite','f2e6dc',.48)]}
M['eye']=material('infectedEye','ff3b2f',.28,3)
def node(n,p,parent=None):
    o=bpy.data.objects.new(n,None); S.collection.objects.link(o); o.location=p
    if parent:
        bpy.context.view_layer.update(); o.parent=nodes[parent]; o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    nodes[n]=o; return o
def finish(o,n,m,parent):
    o.name=n; o.data.materials.append(M[m]); bpy.context.view_layer.objects.active=o
    for f in o.data.polygons: f.use_smooth=True
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bpy.context.view_layer.update(); o.parent=nodes[parent]; o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    meshes.append(o); return o
def ell(n,p,r,m,parent):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,location=p); o=bpy.context.object; o.scale=r
    return finish(o,n,m,parent)
def mesh(n,v,f,m,parent):
    d=bpy.data.meshes.new(n); d.from_pydata(v,[],f); d.update(); o=bpy.data.objects.new(n,d); S.collection.objects.link(o)
    return finish(o,n,m,parent)
def tube(n,points,rs,m,parent,N=5):
    v=[]; f=[]
    for j,p in enumerate(points):
        t=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(j-1,0)]); t.normalize()
        u=t.cross(Vector((0,1,0)))
        if u.length<.01: u=t.cross(Vector((1,0,0)))
        u.normalize(); w=t.cross(u)
        for i in range(N): v.append(Vector(p)+rs[j]*(u*math.cos(i*2*math.pi/N)+w*math.sin(i*2*math.pi/N)))
    for j in range(len(points)-1):
        for i in range(N): k=j*N+i; kk=j*N+(i+1)%N; f.append((k,kk,kk+N,k+N))
    f += [tuple(range(N-1,-1,-1)),tuple((len(points)-1)*N+i for i in range(N))]
    return mesh(n,v,f,m,parent)
def shell(n,outline,normal,depth,m,parent):
    # Concave silhouette polygons are solid, double-sided shells, not alpha cards.
    axis=Vector(normal).normalized()*depth*.5; N=len(outline)
    v=[Vector(p)+axis for p in outline]+[Vector(p)-axis for p in outline]
    f=[tuple(range(N)),tuple(range(2*N-1,N-1,-1))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
    o=mesh(n,v,f,m,parent)
    for face in o.data.polygons: face.use_smooth=False
    return o
node('root',(0,0,0)); node('hip',(-.13,0,.47),'root'); node('torso',(-.10,0,.64),'hip'); node('body',(-.10,0,.64),'torso')
node('head',(.22,0,.91),'body'); node('tail',(-.32,0,.57),'body'); node('backpackSocket',(-.29,0,.7),'torso')
ell('breast',(-.04,0,.63),(.35,.23,.23),'uiDark','body')
ell('arched_back',(-.18,0,.70),(.32,.22,.18),'uiDark','body')
ell('neck',(.16,0,.80),(.15,.15,.20),'uiDark','head')
ell('crow_skull',(.29,0,.96),(.20,.18,.18),'uiDark','head')
# One chunky crown shell and two swept cheek tufts retain the ragged head outline.
shell('crest',[(.30,-.14,1.07),(.19,-.14,1.17),(.18,-.08,1.11),(.10,-.04,1.20),(.18,0,1.13),(.12,.055,1.19),(.23,.08,1.10),(.18,.14,1.16),(.31,.14,1.07)],(1,0,0),.030,'uiDark','head')
for side in [-1,1]:
    shell('cheek'+str(side),[(.33,side*.154,1.015),(.10,side*.178,.92),(.17,side*.17,.91),(.06,side*.17,.84),(.25,side*.16,.885)],(0,1,0),.018,'uiDark','head')
# Hooked upper mandible and separate open lower mandible. Sculpted, not a cone.
tube('upper_beak',[(.40,0,.981),(.48,0,.984),(.58,0,.957),(.67,0,.917),(.706,0,.858)],[.066,.065,.048,.025,.003],'sidewalk','head',N=6)
tube('lower_beak',[(.37,0,.862),(.42,0,.789),(.52,0,.724),(.606,0,.71)],[.062,.049,.024,.003],'asphalt','head',N=6)
mesh('gape_cavity',[(.415,-.06,.934),(.415,.06,.934),(.477,0,.782),(.355,0,.871)],[(0,1,2),(0,3,1),(0,2,3),(1,3,2)],'uiDark','head')
# Open dark throat sits behind the two mandibles.
ell('open_throat',(.368,0,.867),(.045,.074,.08),'blood','head')
tube('tongue',[(.398,0,.832),(.442,0,.796),(.508,0,.754)],[.025,.021,.008],'blood','head')
for s in [-1,1]:
    tube('mouth_rim'+str(s),[(.414,s*.065,.932),(.363,s*.079,.884),(.397,s*.045,.814)],[.013,.015,.007],'blood','head')
    ell('orbital_wound'+str(s),(.422,s*.110,1.002),(.041,.058,.063),'blood','head')
    ell('eye_rim'+str(s),(.446,s*.113,1.009),(.025,.052,.053),'uiDark','head')
    ell('eye_glow'+str(s),(.463,s*.113,1.014),(.023,.041,.042),'eye','head')
    ell('eye_core'+str(s),(.482,s*.113,1.024),(.006,.012,.014),'picketWhite','head')
    tube('brow'+str(s),[(.477,s*.051,1.047),(.445,s*.117,1.078),(.360,s*.161,1.064)],[.018,.025,.017],'uiDark','head')
    ell('nostril'+str(s),(.498,s*.058,.996),(.017,.008,.009),'uiDark','head')
# Three thick silhouette shells per wing replace individual feather geometry.
for sign,side in [(1,'L'),(-1,'R')]:
    shoulder=(-.09,sign*.17,.76); elbow=(-.13,sign*.35,1.08); wrist=(-.10,sign*.45,1.39)
    node('arm'+side,shoulder,'body'); node('wing'+side,shoulder,'arm'+side)
    node('foreArm'+side,elbow,'wing'+side); node('hand'+side,wrist,'foreArm'+side)
    tube('upper_wing_bone'+side,[shoulder,elbow],[.08,.06],'uiDark','wing'+side)
    tube('outer_wing_bone'+side,[elbow,wrist],[.06,.04],'uiDark','foreArm'+side)
    def wing_shell(n,yz,x,mat,parent):
        return shell(n,[(x,sign*y,z) for y,z in yz],(1,0,0),.026,mat,parent)
    wing_shell('wing_root'+side,[(.17,.76),(.27,1.09),(.39,1.24),(.54,1.11),(.44,1.02),(.47,.95),(.36,.99),(.39,.86),(.28,.91),(.29,.72)],.012,'uiDark','wing'+side)
    wing_shell('flight_fan'+side,[(.28,1.09),(.43,1.40),(.99,1.68),(1.055,1.65),(.93,1.56),(.73,1.44),(1.025,1.52),(.99,1.42),(.74,1.34),(.98,1.39),(.93,1.29),(.69,1.23),(.90,1.26),(.84,1.16),(.62,1.12),(.77,1.12),(.72,1.01),(.54,1.03),(.64,.99),(.56,.89),(.38,.98)],-.09,'uiDark','foreArm'+side)
    wing_shell('outer_feather_band'+side,[(.43,1.38),(.99,1.67),(1.03,1.65),(.92,1.56),(.69,1.42),(.98,1.50),(.94,1.43),(.56,1.32)],-.061,'asphalt','hand'+side)
# One saw-toothed, thick tail fan keeps its spread and torn tips.
xy=[(-.27,-.09),(-.66,-.34),(-.70,-.29),(-.56,-.16),(-.77,-.20),(-.80,-.13),(-.68,-.07),(-.82,-.05),(-.80,.04),(-.65,.07),(-.79,.13),(-.74,.20),(-.58,.17),(-.70,.29),(-.65,.34),(-.27,.09)]
shell('tail_fan',[(x,y,.58+(x+.27)*.62) for x,y in xy],(0,0,1),.030,'uiDark','tail')
# Two chunky chest feather shells and the red flank wounds survive flock distance.
for side in [-1,1]:
    shell('breast_rag'+str(side),[(.235,side*.035,.73),(.23,side*.17,.68),(.17,side*.22,.51),(.18,side*.15,.54),(.16,side*.13,.45),(.17,side*.08,.53),(.18,side*.035,.48)],(1,0,0),.024,'asphalt','body')
    ell('flank_wound'+str(side),(-.04,side*.211,.625),(.074,.026,.079),'blood','body')
# Scaly, bent legs and four curled toes per foot. Ground contact at z=0.
for s,side in [(1,'L'),(-1,'R')]:
    hip=(-.01,s*.115,.47); knee=(.07,s*.14,.32); ankle=(.025,s*.17,.15)
    node('leg'+side,hip,'hip'); node('shin'+side,knee,'leg'+side); node('foot'+side,ankle,'shin'+side)
    ell('haunch'+side,hip,(.09,.092,.114),'uiDark','leg'+side)
    tube('upper_leg'+side,[hip,knee],[.055,.04],'asphalt','leg'+side)
    tube('scaly_shin'+side,[knee,(.035,s*.159,.22),ankle],[.036,.03,.032],'sidewalk','shin'+side)
    ell('foot_pad'+side,(.06,s*.17,.12),(.07,.059,.038),'asphalt','foot'+side)
    for j in range(3):
        y=s*.17+(j-1)*.052; spread=(j-1)*.026
        ps=[(.073,y,.126),(.148,y+spread,.115),(.211,y+spread,.067),(.205,y+spread,.029)]
        tube('toe_'+side+str(j),ps,[.023,.024,.018,.011],'sidewalk','foot'+side)
        tube('talon_'+side+str(j),[ps[-2],ps[-1],(.176,y+spread,.011),(.160,y+spread,.017)],[.017,.014,.008,.001],'uiDark','foot'+side)
    tube('hind_toe'+side,[(.04,s*.18,.13),(-.04,s*.21,.102),(-.09,s*.22,.057)],[.024,.021,.012],'sidewalk','foot'+side)
    tube('hind_claw'+side,[(-.09,s*.22,.057),(-.098,s*.22,.022),(-.068,s*.22,.008)],[.013,.008,.001],'uiDark','foot'+side)
# Hidden stump geometry remains in the exported asset; zero scale is runtime visibility.
for n in ['head','armL','armR','foreArmL','foreArmR','legL','legR']:
    pos=nodes[n].matrix_world.translation.copy()
    if n in ['armL','armR']:
        pos.y+=.030 if n.endswith('L') else -.030; pos.z+=.045
    rx,ry,rz=(.065,.065,.020) if n in ['armL','armR'] else (.047,.048,.012)
    v=[pos+Vector(v) for v in [(rx,0,0),(-rx,0,0),(0,ry,0),(0,-ry,0),(0,0,rz),(0,0,-rz)]]
    o=mesh('stump_'+n,v,[(4,0,2),(4,2,1),(4,1,3),(4,3,0),(5,2,0),(5,1,2),(5,3,1),(5,0,3)],'blood',n)
    o['hidden']=True; o['restoreScale']=[1,1,1]; caps.append(o)
# Normalize transforms into true joint-local coordinates, no parent-inverse tricks.
bpy.context.view_layer.update()
for o in meshes:
    world=o.matrix_world.copy(); o.data.transform(o.parent.matrix_world.inverted()@world)
    o.matrix_parent_inverse=Matrix.Identity(4); o.matrix_basis=Matrix.Identity(4)
for o in reversed(list(nodes.values())):
    world=o.matrix_world.copy(); o.matrix_parent_inverse=Matrix.Identity(4)
    o.matrix_basis=o.parent.matrix_world.inverted()@world if o.parent else world
# Merge only geometry sharing a rigid parent/material. Named stump caps remain separate.
bpy.context.view_layer.update()
groups={}
for o in meshes:
    if o not in caps: groups.setdefault((o.parent.name,o.data.materials[0].name),[]).append(o)
for (parent,mat),group in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in group: o.select_set(True)
    bpy.context.view_layer.objects.active=group[0]; bpy.ops.object.join(); group[0].name=parent+'_'+mat
meshes=[o for o in S.objects if o.type=='MESH']
# Lower LODs reuse the same hierarchy; keep eye signals and stump caps readable.
if a.lod:
    for o in meshes:
        if o not in caps and o.data.materials[0].name not in ['emi_infectedEye','pal_picketWhite']:
            bpy.context.view_layer.objects.active=o
            md=o.modifiers.new('flock LOD','DECIMATE'); md.ratio=.25 if a.lod==1 else .10
            bpy.ops.object.modifier_apply(modifier=md.name)
for o in caps: o.scale=(0,0,0)
bpy.context.view_layer.update()
foot_meshes=[o for o in meshes if o.parent.name in ['footL','footR']]
ground_z=min((o.matrix_world@v.co).z for o in foot_meshes for v in o.data.vertices)
nodes['hip'].location.z-=ground_z
bpy.context.view_layer.update()
required=['root','body','head','wingL','wingR','tail','hip','torso','armL','armR','foreArmL','foreArmR','handL','handR','legL','legR','shinL','shinR','footL','footR','backpackSocket']+['stump_'+n for n in ['head','armL','armR','foreArmL','foreArmR','legL','legR']]
triangles=sum(len(f.vertices)-2 for o in meshes for f in o.data.polygons)
assert triangles<=3000, f'Crow budget exceeded: {triangles}'
(P/('build-stats.json' if not a.lod else f'lod{a.lod}-stats.json')).write_text(json.dumps({'triangles':triangles,'meshes':len(meshes),'missing_nodes':[n for n in required if n not in S.objects]},indent=2))
(P/('rig-rest.json' if not a.lod else f'lod{a.lod}-rig-rest.json')).write_text(json.dumps({'pivots':{n:list(o.matrix_world.translation) for n,o in nodes.items()},'parents':{n:o.parent.name if o.parent else None for n,o in nodes.items()}},indent=2))
if a.glb:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
if a.pose:
    nodes['armL'].rotation_euler.x=.35; nodes['foreArmL'].rotation_euler.x=.45; nodes['legR'].rotation_euler.y=-.4
    if a.amputate:
        for o in meshes:
            p=o.parent
            while p:
                if p==nodes['armL']: o.hide_render=True; break
                p=p.parent
        cap=bpy.data.objects['stump_armL']; cap.hide_render=False; cap.scale=(1,1,1); cap['hidden']=False
if a.render:
    world=bpy.data.worlds.new('studio'); world.use_nodes=True; S.world=world
    world.node_tree.nodes['Background'].inputs[0].default_value=(.07,.06,.085,1); world.node_tree.nodes['Background'].inputs[1].default_value=.55
    def light(n,p,power,c,size):
        d=bpy.data.lights.new(n,'AREA'); o=bpy.data.objects.new(n,d); S.collection.objects.link(o); o.location=p
        d.energy=power; d.color=c; d.shape='DISK'; d.size=size; o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(3,-4,5),520,(1,.80,.65),3)
    light('lavender fill',(1,3,3),420,(.66,.70,1),3)
    light('gold rim',(-3,1,3),700,(1,.40,.16),2)
    bpy.ops.mesh.primitive_plane_add(size=200); floor=bpy.context.object
    floor.data.materials.append(material('studio','302b37',.9))
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera')); S.collection.objects.link(cam); S.camera=cam
    views={'hero':(6,-2.9,2.35),'front':(6,0,1.10),'side':(0,-6,1.10),'back':(-6,0,1.10)}
    cam.location=(4,6,2.5) if a.amputate else views.get(a.view,views['hero']); cam.rotation_euler=(Vector((-.05,0,.82))-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO'; cam.data.ortho_scale=(2.50 if a.pose else 2.16)*a.width/a.height
    S.render.engine='CYCLES'; S.cycles.samples=a.samples; S.cycles.use_denoising=True
    S.render.resolution_x=a.width; S.render.resolution_y=a.height; S.render.resolution_percentage=100
    S.view_settings.view_transform='AgX'; S.render.image_settings.file_format='PNG'; S.render.filepath=a.render
    bpy.ops.render.render(write_still=True)
print('OK',triangles,'triangles',len(meshes),'meshes')
