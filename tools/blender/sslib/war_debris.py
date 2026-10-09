"""L5 debris: explicit solid recipes and angular blast bowls, never decimation.

Uses the rescue set's rigid-body batching, shared palette, AO and export contract.
Crater collision is an exact triangle surface carried by an EMPTY; runtime terrain
cutout/concave collision consumption belongs to the level lane (see asset notes).
"""
import argparse
import json
import math
import shutil
import sys
from pathlib import Path
import bpy
from mathutils import Vector
from . import ao, colliders, export, palette, sockets
from .rescue_assets import Scene


def prism(s, name, outline, height, token, position=(0, 0, 0), rotation=(0, 0, 0)):
    n = len(outline)
    verts = [(x, y, z) for z in (0, height) for x, y in outline]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2*n))]
    faces += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
    obj = s.mesh(name, verts, faces, token)
    obj.location = position
    obj.rotation_euler = rotation
    if position[2] >= 0:
        bpy.context.view_layer.update()
        low = min((obj.matrix_world @ v.co).z for v in obj.data.vertices)
        if low < 0: obj.location.z -= low
    return obj


def chunk(s, name, pos, size, token, angle=0):
    x, y, z = size
    # Chipped corners and an off-centre split, not a regular cuboid/cone.
    outline = [(-.5*x, -.32*y), (-.32*x, -.5*y), (.47*x, -.43*y),
               (.5*x, .28*y), (.18*x, .5*y), (-.43*x, .42*y)]
    if s.lod == 2:
        outline = [(-.5*x, -.5*y), (.5*x, -.38*y), (.36*x, .5*y), (-.42*x, .43*y)]
    n=len(outline)
    rings=[(1,0),(1,.72),(.78,1)] if s.lod==0 else [(1,0),(.84,1)]
    verts=[]
    for row,(fac,h) in enumerate(rings):
        for i,(px,py) in enumerate(outline):
            zz=z*h
            if row==len(rings)-1:zz*=.76+.24*(.5+.5*math.sin(i*2.1+angle))
            verts.append((px*fac,py*fac,zz))
    faces=[tuple(reversed(range(n))),tuple(range((len(rings)-1)*n,len(rings)*n))]
    for row in range(len(rings)-1):
        faces += [(row*n+i,row*n+(i+1)%n,(row+1)*n+(i+1)%n,(row+1)*n+i) for i in range(n)]
    obj=s.mesh(name,verts,faces,token);obj.location=pos
    obj.rotation_euler=(.12*math.sin(angle),.15*math.cos(angle),angle)
    # Base corners stay at ground for scattered fragments.
    bpy.context.view_layer.update()
    low = min((obj.matrix_world @ v.co).z for v in obj.data.vertices)
    if low < 0 and pos[2] >= 0: obj.location.z -= low
    return obj


def rubble(s):
    # Exact big slab, brick landmarks and extremity chunks survive every tier.
    outline = [(-.78,-.38),(.48,-.43),(.74,-.2),(.66,.34),(-.38,.42),(-.76,.19)]
    slab=prism(s, 'exposedSlab', outline, .20, 'sidewalk', (-.02,.02,.24), (0,-.83,.22))
    rocks = [(-.90,-.42,0,.58,.52,.30,.4),(.82,.49,0,.58,.50,.35,-.3),
             (-.43,.47,.14,.66,.49,.53,.9),(.43,.22,.36,.67,.58,.65,-.5),
             (.47,-.45,0,.63,.44,.31,.6),(-.38,-.64,0,.50,.36,.23,-.5)]
    for i,(x,y,z,dx,dy,dz,a) in enumerate(rocks):
        chunk(s,'brokenMasonry',(x,y,z),(dx,dy,dz),'brick' if i%3 else 'sidewalk',a)
    for y in (-.86,.78):
        chunk(s,'perimeterSlab',(.20,y,0),(.42,.36,.12),'sidewalk',.15)
    if s.lod < 2:
        for i in range(18 if s.lod==0 else 10):
            a=i*2.39996; r=.34+.60*((i*7)%13)/13
            chunk(s,'looseBrick',(math.cos(a)*r,math.sin(a)*r,.10+.23*(i%3)),(.35,.22,.17),'brick',a)
        prism(s,'splitSlab',[(-.43,-.24),(.41,-.22),(.45,.12),(.1,.24),(-.44,.17)],.15,'sidewalk',(.50,-.36,.12),(.12,-.30,-.30))
    # Splintered timber and exposed bent reinforcing bar, present at game distance.
    for i in range(2):
        obj=s.box('splinteredBeam',(-.43+i*.30,-.26,.35+i*.10),(.95,.10,.12),'woodWarm',angle=.7+i*.34)
        obj.rotation_euler.y=-.35
    s.beam('bentRebar',(-.42,.23,.80),(-.50,.26,1.20),.025,'uiDark')
    s.beam('bentRebarTip',(-.50,.26,1.20),(-.75,.25,1.30),.025,'uiDark')
    sockets.empty('debrisCenterSocket',(0,0,.45),s.root)
    # Individual coarse solids leave pockets around the heap, no footprint slab.
    for i,(x,y,z,dx,dy,dz,a) in enumerate(rocks):
        c=colliders.cuboid('masonry'+str(i),(dx,dy,dz),(x,y,z+dz/2),s.root)
        c.rotation_euler.z=a
    bpy.context.view_layer.update()
    slab_center=slab.matrix_world @ Vector((-.02,-.005,.10))
    proxy=colliders.cuboid('slab',(1.52,.85,.20),slab_center,s.root)
    proxy.rotation_euler=slab.rotation_euler.copy()


def tanker_section():
    """Sample the shipped tank's full-radius ring, then tear/fold that metal skin.

    Keep the actual base cross-section and silver/red identity. Other truck
    assemblies are intentionally not part of the separate crater dressing.
    """
    existing=set(bpy.context.scene.objects)
    source=Path(__file__).resolve().parents[3]/'assets/veh.fuel-truck/model.glb'
    bpy.ops.import_scene.gltf(filepath=str(source))
    imported=set(bpy.context.scene.objects)-existing
    bpy.context.view_layer.update()
    points=[]
    for obj in imported:
        if obj.type!='MESH' or not any(m and m.name.startswith('pal_silver') for m in obj.data.materials):continue
        for v in obj.data.vertices:
            p=obj.matrix_world@v.co
            if abs(p.x+4.66)<.012 and abs((p.y/1.13)**2+((p.z-2.65)/1.12)**2-1)<.015:
                points.append((p.y,p.z))
    for obj in imported:bpy.data.objects.remove(obj,do_unlink=True)
    if not points:raise ValueError('Integrated fuel-truck tank ring not found')
    return points


def blast_profile(s, fuel=False):
    n=[24,16,10][s.lod]
    rx,ry,depth=(3.9,2.8,.82) if fuel else (2.10,1.85,.66)
    # Ground contact boundary at Z=0, physical concavity extends below grade.
    rings=[]
    for factor in (.22,.64,1.0,1.20):
        ring=[]
        for i in range(n):
            a=math.tau*i/n
            rough=1+.070*math.sin(3*a+.3)+.055*math.cos(5*a)
            z = (-depth if factor==.22 else -depth*.42 if factor==.64 else .16+.22*(.5+.5*math.sin(7*a+.7)) if factor==1.0 else 0)
            ring.append((rx*factor*rough*math.cos(a),ry*factor*rough*math.sin(a),z))
        rings.append(ring)
    verts=[p for ring in rings for p in ring]+[(0,0,-depth-.015)]
    faces=[]; tokens=[]
    for i in range(n):
        faces.append((4*n,i,(i+1)%n));tokens.append('uiDark')
    for j in range(3):
        for i in range(n):
            # The rim separates into torn plates at LOD0/1; no large smooth cone.
            k=(i+1)%n
            faces.append((j*n+i,(j+1)*n+i,(j+1)*n+k,j*n+k))
            tokens.append('uiDark' if j==0 else 'asphalt' if fuel or j==2 else 'leatherShadow')
    obj=s.mesh('blastBowl',verts,faces,'asphalt')
    materials={t:palette.mat(t) for t in sorted(set(tokens))}
    obj.data.materials.clear()
    for m in materials.values():obj.data.materials.append(m)
    slots={t:i for i,t in enumerate(materials)}
    for f,t in zip(obj.data.polygons,tokens):f.material_index=slots[t]
    # Exact visual surface triangles in GAME coordinates. No collision AABB fills the void.
    obj.data.calc_loop_triangles()
    collider=sockets.empty('col:blastSurface',parent=s.root)
    collider['collider']='trimesh'
    collider['vertices']=[v for x,y,z in verts for v in (x,z,-y)]
    collider['indices']=[i for t in obj.data.loop_triangles for i in t.vertices]
    collider['coordinateSpace']='gltf-y-up'
    for name,pos in [('blastCenterSocket',(0,0,-depth)),('terrainCutoutSocket',(0,0,0)),('rimGroundSocket',(rx*1.2,0,0))]:
        sockets.empty(name,pos,s.root)
    cutout=sockets.empty('terrainCutout',parent=s.root)
    cutout['ss_terrain_cutout']={'boundary':[[x,-y] for x,y,z in rings[-1]],'depth':depth,'removeGroundCollider':True}
    # Large asymmetric chunks remain across all tiers; fine chips only near.
    count=[12,8,3 if fuel else 4][s.lod]
    for i in range(count):
        a=math.tau*i/count+.24; r=1.05+.06*math.sin(i*2.1)
        chunk(s,'ejectedAsphalt' if fuel else 'ejectedStone',(rx*r*math.cos(a),ry*r*math.sin(a),.01),
              (.48 if fuel else .30,.34 if fuel else .27,.25 if i%3==0 else .12),'asphalt' if fuel else 'sidewalk',a)
    if s.lod < 2:
        for i in range(8 if s.lod==0 else 3):
            a=i*2.39996;r=1.12
            chunk(s,'radialFragment',(rx*r*math.cos(a),ry*r*math.sin(a),0),(.23,.18,.09),'asphalt' if fuel else 'leatherShadow',a)
        # Torn raised lips are closed irregular slabs standing away from the bowl.
        for i in range(8 if s.lod==0 else 4):
            a=i*math.tau/(8 if s.lod==0 else 4)+.16
            obj=prism(s,'tornRim',[(-.38,-.16),(.26,-.22),(.42,.06),(.1,.28),(-.37,.15)],.09,
                      'asphalt' if fuel else 'sidewalk',(rx*math.cos(a),ry*math.sin(a),.18),(0,-.38,a))
    if s.lod==2:
        for a in (.25,3.40):
            prism(s,'tornRim',[(-.38,-.16),(.26,-.22),(.42,.06),(.1,.28),(-.37,.15)],.09,
                  'asphalt' if fuel else 'sidewalk',(rx*math.cos(a),ry*math.sin(a),.22),(0,-.38,a))
    if fuel:
        section=tanker_section()
        # Two ripped, curved tanker sheets, no intact truck or glowing fixtures.
        for k,(x,y,angle) in enumerate([(-2.1,.65,.35),(1.65,-1.48,-.55)]):
            steps=[6,4,2][s.lod];vv=[]
            for row in range(2):
                for i in range(steps+1):
                    t=i/steps
                    a=.35+1.65*t
                    by,bz=min(section,key=lambda p:(p[0]-1.13*math.cos(a))**2+(p[1]-2.65-1.12*math.sin(a))**2)
                    vv.append((-by*.85+.23,.60*row+.12*math.sin(t*4+k),(bz-2.80)*.55+.18+.1*row))
            ff=[(i,i+1,steps+2+i,steps+1+i) for i in range(steps)]
            offset=len(vv);vv += [(x,y,z-.035) for x,y,z in vv]
            ff += [tuple(i+offset for i in reversed(face)) for face in list(ff)]
            boundary=list(range(steps+1))+list(reversed(range(steps+1,offset)))
            ff += [(i,j,j+offset,i+offset) for i,j in zip(boundary,boundary[1:]+boundary[:1])]
            sheet=s.mesh('tornTankSheet',vv,ff,'silver');sheet.location=(x,y,.16);sheet.rotation_euler.z=angle
            sheet.data.materials[0].use_backface_culling=False
        if s.lod==2:
            s.box('fuelLivery',(-2.1,.8,.48),(.62,.10,.035),'survivorRed',angle=.35)
        if s.lod < 2:
            # Surviving fictional fuel livery fragments identify the blast source.
            for x,y,a in [(-2.1,.65,.35),(1.65,-1.48,-.55)]:
                strip=s.box('fuelLivery',(x,y+.15,.48),(.62,.10,.035),'survivorRed',angle=a)
                strip.rotation_euler.y=-.24
            s.box('rupturedTankBrace',(.65,.90,.33),(1.05,.13,.12),'uiDark',angle=.7)
        sockets.empty('fuelTruckRemnantSocket',(-2.1,.65,.16),s.root)


def bag(s,pos,angle,token='olive',torn=False):
    if s.lod==2:
        outline=[(-.39,-.20),(.37,-.18),(.40,.15),(-.32,.20)]
    else:
        outline=[(-.37,-.14),(-.28,-.22),(.28,-.22),(.40,-.13),(.37,.14),(.28,.22),(-.28,.22),(-.40,.12)]
    n=len(outline)
    heights=(0,.09,.23) if s.lod==0 else (0,.23)
    vv=[]
    for row,z in enumerate(heights):
        fac=.80 if row==0 or row==len(heights)-1 else 1
        vv += [(x*fac,y*fac,z) for x,y in outline]
    ff=[tuple(reversed(range(n))),tuple(range((len(heights)-1)*n,len(heights)*n))]
    for row in range(len(heights)-1):
        ff += [(row*n+i,row*n+(i+1)%n,(row+1)*n+(i+1)%n,(row+1)*n+i) for i in range(n)]
    obj=s.mesh('burstBag' if torn else 'sandbag',vv,ff,token);obj.location=pos;obj.rotation_euler.z=angle
    if s.lod==0:
        obj.data.materials.append(palette.mat('khaki'))
        for f in obj.data.polygons:
            if f.normal.z>.5:f.material_index=1
    if torn:
        # A gaping mouth and two folded canvas flaps expose pale filling.
        mouth=s.box('burstMouth',(pos[0],pos[1]-.20,pos[2]+.13),(.30,.024,.12),'uiDark',angle=angle)
        prism(s,'canvasFlap',[(-.20,0),(.17,.04),(.03,.30),(-.15,.18)],.016,'khaki',
              (pos[0],pos[1]-.22,pos[2]+.14),(.20,.35,angle))
    return obj


def sandbags(s):
    # Two irregular surviving ends leave a full-body-width central breach.
    for side in (-1,1):
        for row in range(4):
            bag(s,(side*(1.04+.045*(row%2)),.07*(row%2),row*.22),side*.055,'olive' if row%2 else 'khaki')
            if s.lod==0 or (s.lod==1 and row==0) or (s.lod==2 and row==0):
                bag(s,(side*1.63,-.015,row*.22),-.05*side,'olive')
        # Displaced bags and burst cloth point into the empty gap.
        bag(s,(side*.45,-.49,.025),side*.60,'olive',torn=s.lod<2)
        bag(s,(side*.75,.59,0),side*1.05,'khaki')
    # Pale sand is broad enough to read at 90px; no display-plinth underneath.
    prism(s,'burstFilling',[(-.88,-.61),(-.36,-.80),(.52,-.72),(.91,-.29),(.65,.29),(-.48,.37),(-.87,.08)],.055,'canvasTan')
    if s.lod < 2:
        for i in range(8 if s.lod==0 else 3):
            a=i*2.39996
            chunk(s,'spilledFilling',(math.cos(a)*.63,math.sin(a)*.38,.05),(.24,.19,.11),'canvasTan',a)
        for side in (-1,1):
            prism(s,'hangingTornCanvas',[(-.13,0),(.12,0),(.08,.63),(-.11,.56)],.018,'khaki',
                  (side*.85,-.25,.73),(-math.pi/2,side*.30,0))
    for side in (-1,1):
        colliders.cuboid('survivingStack'+str(side),(1.42,.50,.89),(side*1.335,0,.445),s.root)
    sockets.empty('breachSocket',(0,0,0),s.root)
    sockets.empty('lineEndLSocket',(-1.8,0,0),s.root)
    sockets.empty('lineEndRSocket',(1.8,0,0),s.root)


def build_one(asset,lod,path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s=Scene(asset,lod)
    s.root['category']='prop'
    if asset=='decay.rubble-pile':rubble(s)
    elif asset=='decay.blown-sandbags':sandbags(s)
    else:blast_profile(s,asset=='decay.fuel-truck-crater')
    s.physics()
    value=json.loads(s.root['ss_physics']);value.update(centerOfMass=[0,-.15 if 'crater' in asset else .35,0],sounds='prop.stone-heavy',flammable=False)
    s.root['ss_physics']=json.dumps(value)
    export.merge_by_material(s.root,{'body'})
    bpy.context.view_layer.update()
    points=[o.matrix_world@v.co for o in s.root.children_recursive if o.type=='MESH' for v in o.data.vertices]
    lo=[min(v[k] for v in points) for k in range(3)];hi=[max(v[k] for v in points) for k in range(3)]
    sockets.empty('front',(hi[0],0,0),s.root)
    ao.bake_all(s.root.children_recursive,16)
    export.glb(s.root,path)
    meshes=[o for o in s.root.children_recursive if o.type=='MESH']
    for o in meshes:o.data.calc_loop_triangles()
    tris=sum(len(o.data.loop_triangles) for o in meshes)
    if tris>[1500,600,200][lod]:raise ValueError(f'{asset} LOD{lod}: {tris} exceeds cap')
    return dict(triangles=tris,draws=len(meshes),materials=len({m.name for o in meshes for m in o.data.materials}),bytes=Path(path).stat().st_size,
                dimensions=dict(x=hi[0]-lo[0],y=hi[2]-lo[2],z=hi[1]-lo[1],tolerance=.10))


def build_set(asset,directory):
    parser=argparse.ArgumentParser()
    parser.add_argument('--glb');parser.add_argument('--quality',default='high')
    parser.add_argument('--distance-tier',type=int,choices=(0,1,2))
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    directory=Path(directory);stats={}
    tiers=(args.distance_tier,) if args.distance_tier is not None else (0,1,2)
    for lod in tiers:
        path=directory/('model'+('' if lod==0 else '.lod'+str(lod))+'.glb')
        stats['lod'+str(lod)]=build_one(asset,lod,path)
        if args.distance_tier is not None and args.glb and Path(args.glb).resolve()!=path:shutil.copyfile(path,args.glb)
    if args.distance_tier is None:
        (directory/'lod-stats.json').write_text(json.dumps(stats,indent=2)+'\n')
        if args.glb and Path(args.glb).resolve()!=directory/'model.glb':shutil.copyfile(directory/'model.glb',args.glb)
    return stats
