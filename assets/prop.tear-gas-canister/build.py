"""Deterministic, texture-free Sunset Grove smoking canister (metres, Z up)."""
import argparse
import json
import math
import random
import sys
from pathlib import Path
import bpy
from mathutils import Vector

OUT = Path(__file__).resolve().parent
sys.path.insert(0, str(OUT.parents[1] / 'tools/blender'))
from sslib import palette, ao
ASSET = {'id': 'prop.tear-gas-canister', 'category': 'prop'}

def empty(name, parent=None, location=(0, 0, 0)):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.parent = parent
    o.location = location
    return o

def mesh(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    o = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(o)
    data.materials.append(mat)
    return o

def lathe(name, profile, mat, n=48, hollow=False):
    # Subdivided flat 24-sided profile keeps the chunky reference silhouette.
    vertices = []
    for z, r in profile:
        for i in range(n):
            f, t = divmod(i, n // 24)
            t /= n // 24
            a, b = f * math.tau / 24, (f + 1) * math.tau / 24
            vertices.append((r * ((1-t)*math.cos(a)+t*math.cos(b)),
                             r * ((1-t)*math.sin(a)+t*math.sin(b)), z))
    faces = [(j*n+i, j*n+(i+1)%n, (j+1)*n+(i+1)%n, (j+1)*n+i)
             for j in range(len(profile)-1) for i in range(n)]
    if hollow:
        faces += [((len(profile)-1)*n+i, (len(profile)-1)*n+(i+1)%n, (i+1)%n, i) for i in range(n)]
    else:
        bottom, top = len(vertices), len(vertices)+1
        vertices += [(0,0,profile[0][0]), (0,0,profile[-1][0])]
        faces += [(bottom,(i+1)%n,i) for i in range(n)]
        faces += [(top,(len(profile)-1)*n+i,(len(profile)-1)*n+(i+1)%n) for i in range(n)]
    return mesh(name, vertices, faces, mat)

def box(name, location, size, mat, bevel=.002):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    o = bpy.context.object
    o.name = name
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(mat)
    modifier = o.modifiers.new('soft machined edges', 'BEVEL')
    modifier.width = bevel
    modifier.segments = 3
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return o

def rod(name, a, b, radius, mat, n=32):
    d = Vector(b)-Vector(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=n, radius=radius, depth=d.length,
                                      location=(Vector(a)+Vector(b))/2)
    o = bpy.context.object
    o.name = name
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    o.data.materials.append(mat)
    return o

def torus(name, location, radius, tube, mat, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_segments=64, minor_segments=12,
        location=location, major_radius=radius, minor_radius=tube, rotation=rotation)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o

def join(objects, name, root, pivot=(0, 0, 0)):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    o = objects[0]
    o.name = name
    bpy.context.scene.cursor.location = pivot
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    o.parent = root
    return o

def build(ctx=None):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    grey = palette.mat('pants')
    dark = palette.mat('pantsDark')
    black = palette.mat('uiDark')
    silver = palette.mat('silver')
    yellow = palette.mat('schoolBusYellow')
    rust = palette.mat('hairCopper')
    smoke = palette.mat('hairSilver')
    for m in (grey, dark, silver):
        bs = m.node_tree.nodes['Principled BSDF']
        bs.inputs['Metallic'].default_value = .6
        bs.inputs['Roughness'].default_value = .48
    bs = smoke.node_tree.nodes['Principled BSDF']
    bs.inputs['Alpha'].default_value = .36
    bs.inputs['Roughness'].default_value = 1
    smoke.diffuse_color = (*smoke.diffuse_color[:3], .36)
    smoke.surface_render_method = 'DITHERED'
    root = empty('root')
    root['asset_id'] = ASSET['id']
    root['ss_physics'] = {'class': 'light', 'mass': .6, 'friction': .55,
        'restitution': .15, 'centerOfMass': [0, .145, 0], 'pushable': True,
        'kickable': True, 'flammable': False, 'explosive': None, 'sounds': 'prop.metal-light'}
    lathe('shell', [(0,.072),(.004,.077),(.012,.079),(.227,.079),(.238,.077),(.246,.067),(.253,.043)], grey)
    lathe('lower seam', [(.015,.080),(.018,.081),(.022,.081)], black)
    lathe('foot rim', [(0,.074),(.003,.081),(.014,.081),(.018,.078)], silver)
    lathe('shoulder seam', [(.221,.080),(.223,.081),(.226,.081)], black)
    lathe('upper rolled rim', [(.226,.078),(.229,.082),(.239,.082),(.244,.078)], grey)
    lathe('yellow band', [(.092,.083),(.095,.083),(.147,.083),(.150,.083)], yellow)
    lathe('neck collar', [(.252,.039),(.255,.044),(.265,.044),(.269,.041)], dark)
    # Hollow upper head: reverse inner profile leaves a genuine recessed opening.
    lathe('vent head', [(.266,.041),(.271,.044),(.315,.044),(.319,.040),
        (.319,.024),(.302,.024),(.301,.035),(.266,.035)], dark, hollow=True)
    lathe('top rolled lip', [(.314,.040),(.316,.045),(.328,.045),(.330,.041),
        (.330,.025),(.326,.025),(.325,.039)], dark, hollow=True)
    lathe('lip edge', [(.328,.045),(.330,.045),(.330,.041),(.328,.041)], silver, hollow=True)
    lathe('top inner shadow', [(.302,.023),(.308,.023)], black)
    # Side vent is recessed behind its thick bezel and opens toward +X.
    rod('vent recess', (.046,0,.296),(.048,0,.296), .012, black)
    torus('vent bezel', (.049,0,.296),.012,.0035,silver,(0,math.pi/2,0))
    box('side retaining plate', (-.010,-.046,.288),(.047,.009,.047),dark)
    box('plate edge', (-.027,-.051,.287),(.008,.008,.049),silver)
    box('plate inset', (-.009,-.053,.288),(.018,.004,.025),black,.001)
    rod('plate rivet', (.025,-.035,.274),(.029,-.041,.274),.0038,silver,24)
    box('pin bracket', (.019,.050,.294),(.036,.022,.034),silver)
    rod('pin axle', (.014,.044,.306),(.014,.070,.306),.007,dark)
    rod('pin cap', (.014,.069,.306),(.014,.075,.306),.008,silver)
    ring = torus('pullRing',(.022,.106,.264),.041,.0045,silver,(math.pi/2,.22,0))
    # Larger, sparse chipped patches read at study distance; >=3 mm shell clearance.
    rng = random.Random(28)
    for i in range(33):
        angle = rng.uniform(0, math.tau)
        z = rng.uniform(.030,.218)
        w, h = rng.uniform(.002,.006), rng.uniform(.003,.011)
        r = .087 if z+h >= .092 and z-h <= .150 else .083
        verts = []
        for u,v in [(-w,-h),(.4*w,-.8*h),(w,.3*h),(.3*w,h),(-.6*w,.2*h)]:
            a = angle+u/r
            verts.append((r*math.cos(a),r*math.sin(a),z+v))
        mesh('worn paint',verts,[tuple(range(5))],grey if .092 <= z <= .150 else rust)
    ring = join([ring], 'pullRing', root, (.014,.072,.306))
    for m in (grey,dark,black,silver,yellow,rust):
        objects = [o for o in bpy.context.scene.objects if o.type=='MESH' and o != ring and o.data.materials[0] == m]
        if objects:
            join(objects,'body' if m==grey else 'static_'+m.name,root)
    solids = [o for o in bpy.context.scene.objects if o.type=='MESH']
    ao.bake_all(solids, samples=32)
    # A separately pivoted, removable smoke preview. Runtime can replace it with particles.
    puffs = [(.048,.008,.322,.014),(.056,.012,.348,.020),(.068,.015,.373,.026),
        (.091,.013,.402,.032),(.119,.021,.426,.038),(.145,.025,.458,.045),
        (.161,.023,.497,.052),(.200,.020,.512,.053),(.221,.036,.552,.052),
        (.260,.023,.577,.048),(.230,.037,.607,.043),(.184,.048,.601,.047),
        (.152,.016,.555,.052),(.128,.029,.515,.040),(.249,-.020,.532,.044),
        (.195,-.028,.562,.040),(.166,-.024,.582,.035),(.112,-.018,.446,.026)]
    clouds=[]
    for i,(x,y,z,r) in enumerate(puffs):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=r,location=(x,y,z))
        o=bpy.context.object
        o.name='smoke puff'
        o.scale=(1,.78,1.08)
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        for v in o.data.vertices:
            v.co *= 1 + .025*math.sin(v.index*2.71+i)
        for p in o.data.polygons:
            p.use_smooth=True
        o.data.materials.append(smoke)
        clouds.append(o)
    plume=join(clouds,'smoke',root,(.048,.008,.322))
    # Union puffs to remove transparent internal intersections, then bound density.
    bpy.context.view_layer.objects.active=plume
    plume.data.remesh_voxel_size=.003
    bpy.ops.object.voxel_remesh()
    smooth=plume.modifiers.new('soft cloud lobes','SMOOTH')
    smooth.factor=1
    smooth.iterations=4
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    triangulate=plume.modifiers.new('cloud triangulation','TRIANGULATE')
    bpy.ops.object.modifier_apply(modifier=triangulate.name)
    plume.data.calc_loop_triangles()
    decimate=plume.modifiers.new('side tier smoke budget','DECIMATE')
    decimate.ratio=min(1,2700/len(plume.data.loop_triangles))
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    for polygon in plume.data.polygons:
        polygon.use_smooth=True
    plume['ss_effect']={'type':'smoke','replaceable':True,'source':'smokeEmitter'}
    emitter=empty('smokeEmitter',root,(.048,.008,.322))
    emitter['effect']='tearGasSmoke'
    col=empty('col:body',root,(0,0,.165))
    col['collider']='cylinder'
    col['shape']='cylinder'
    col['radius']=.083
    col['height']=.330
    col['size']=[.166,.330,.166]
    return root

def render(args):
    scene=bpy.context.scene
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.001))
    floor=bpy.context.object
    floor.data.materials.append(palette.mat('asphalt'))
    target=Vector((.075,0,.31))
    views={'ref':(1.1,-1.8,1.05),'game':(1.4,-1.4,2.2),'front':(2,0,.65),'side':(0,-2,.65),'rear':(-2,0,.65)}
    bpy.ops.object.camera_add(location=views[args.view])
    camera=bpy.context.object
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO'
    camera.data.ortho_scale=1.45
    scene.camera=camera
    for location,power,size,color in [((1,-2,3),180,2,(1,.85,.70)),((.7,1,1.6),110,1,(1,.72,.46)),((-2,-1,2),140,2,(.65,.76,1))]:
        bpy.ops.object.light_add(type='AREA',location=location)
        o=bpy.context.object
        o.data.energy=power
        o.data.size=size
        o.data.color=color
        o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    scene.world.color=(.12,.12,.12)
    scene.render.engine='CYCLES'
    scene.cycles.samples=args.samples
    scene.cycles.seed=28
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.resolution_x=args.width
    scene.render.resolution_y=args.height
    scene.render.resolution_percentage=100
    scene.render.filepath=args.render
    Path(args.render).parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.render.render(write_still=True)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--render')
    parser.add_argument('--view',default='ref',choices=['ref','game','front','side','rear'])
    parser.add_argument('--samples',type=int,default=24)
    parser.add_argument('--width',type=int,default=960)
    parser.add_argument('--height',type=int,default=540)
    parser.add_argument('--glb')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    build()
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    for o in meshes:
        o.data.calc_loop_triangles()
    stats={'triangles':sum(len(o.data.loop_triangles) for o in meshes),
           'draw_calls':len(meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials}),
           'nodes':[o.name for o in bpy.context.scene.objects]}
    (OUT/'build-stats.json').write_text(json.dumps(stats,indent=2))
    if args.glb:
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.export_scene.gltf(filepath=str(Path(args.glb).resolve()),export_format='GLB',
            export_apply=True,export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
    if args.render:
        render(args)
    print('OK',json.dumps(stats))

if __name__=='__main__':
    main()
