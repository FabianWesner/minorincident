"""Aftermath skins from the shipped civilian source geometry and rigid rig.

Explicit sphere/profile/curve recipes per distance; no mesh simplification.
The source's finishing/decimation section is never executed. Palette swatches,
soft soot fields and attached wraps share one vertex-colored draw per joint.
"""
import ast
import json
import math
import shutil
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector
from . import export, palette, sockets

BASES = {'npc.civilian-elderly.aftermath': 'npc.civilian-elderly',
         'npc.paramedic.aftermath': 'npc.paramedic',
         'npc.civilian-woman-a.aftermath': 'npc.civilian-woman-a',
         'npc.survivor-group.aftermath': 'npc.survivor-group'}
STOPS = {'npc.civilian-elderly': '# Preserve sculpted silhouette while reducing',
         'npc.paramedic': '# Preserve a smooth hero silhouette inside',
         'npc.civilian-woman-a': '# Merge static surfaces by material',
         'npc.survivor-group': '# Join static details per rigid joint'}
# Authored omissions: silhouette shells, facial whites/irises and clothing
# identifiers remain. Mid/far omit trim that is subpixel at the game camera.
TRIM = ('stitch', 'seam', 'knuckle', 'eyelet', 'notch', 'groove', 'glint small',
        'plaid ', 'lower sleeve plaid', 'waist knit rib', 'cloth fold', 'lash tip',
        'sole lug', 'brass shirt button', 'pouch fastener', 'brass stud', 'gathered trouser fold',
        'half_up_ridge', 'fringe_ridge', 'fringe sheen', 'ivory_button')
FAR = ('finger', 'thumb', 'lace', 'button', 'buckle inset', 'ear inset', 'ear inner',
       'ear_inner', 'lower lid', 'eye bag', 'nostril', 'flower_center', 'bodice_petal',
       'pocket flap', 'shirt collar', 'collar stitch', 'tongue', 'shoe stitching',
       'shoe_badge', 'heel_tab', 'sole_groove', 'cap panel', 'bill edge')


class Recipe(ast.NodeTransformer):
    """Apply named native primitive recipes, retaining original profile points."""
    def __init__(self, lod, group):
        self.lod, self.group = lod, group
        self.radial = (10, 6, 4)[lod] if not group else (6, 4, 4)[lod]
        self.rings = (7, 4, 3)[lod] if not group else (4, 3, 3)[lod]

    def visit_FunctionDef(self, node):
        # Each existing source helper owns its actual topology. No global
        # bpy monkey patch, no change to rig construction or shaping functions.
        if node.name in ('ell', 'loft', 'tube', 'lock', 'finish', 'mesh', 'box'):
            assignments = []
            args = {a.arg for a in node.args.args}
            for name, value in [('seg', self.radial), ('N', self.radial), ('sub', 0), ('res', 0)]:
                if name in args:
                    rhs = f'min({name}, {value})' if name in ('seg', 'N') else str(value)
                    assignments.extend(ast.parse(f'{name} = {rhs}').body)
            if node.name == 'ell' and 'rings' in args:
                assignments.extend(ast.parse(f'rings = min(rings, {self.rings})').body)
            if node.name == 'lock' and self.lod == 2:
                assignments.extend(ast.parse('''if len(points) > 3:
    picks = [0, len(points)//2, len(points)-1]
    points = [points[i] for i in picks]
    widths = [widths[i] for i in picks]
    depths = [depths[i] for i in picks]
''').body)
            if node.name == 'tube':
                limit = (14, 8, 5)[self.lod]
                assignments.extend(ast.parse(f'''points = list(points)
if len(points) > {limit}:
    picks = [round(i*(len(points)-1)/({limit}-1)) for i in range({limit})]
    if 'radii' in locals(): radii = [radii[i] for i in picks]
    points = [points[i] for i in picks]
''').body)
            if node.name == 'ell' and self.lod == 2:
                woman = 'sz' in args
                name, pos, size, material, parent = ('n','p','sz','m','par') if woman else ('name','c','r','mat','parent')
                finish = f'finish(o, {name}, {material}, {parent})' if woman else f'finish(o, {material}, {parent})'
                node.body = ast.parse(f'''data = bpy.data.meshes.new({name})
data.from_pydata([(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)], [], [(0,2,4),(2,1,4),(1,3,4),(3,0,4),(2,0,5),(1,2,5),(3,1,5),(0,3,5)])
o = bpy.data.objects.new({name}, data)
bpy.context.scene.collection.objects.link(o)
o.location = {pos}
o.scale = {size}
'''+ ('if rot: o.rotation_euler = rot\n' if woman else '')+f'return {finish}').body
            if node.name == 'box' and (self.lod > 0 or self.group):
                woman = 'sz' in args
                name, pos, size, material, parent = ('n','p','sz','m','par') if woman else ('name','c','size','mat','parent')
                finish = f'finish(o, {name}, {material}, {parent})' if woman else f'finish(o, {material}, {parent})'
                node.body = ast.parse(f'''bpy.ops.mesh.primitive_cube_add(size=1, location={pos})
o = bpy.context.object
o.name = {name}
o.scale = {size}
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
if rot: o.rotation_euler = rot
return {finish}
''').body
            if node.name == 'loft' and self.lod == 2:
                assignments.extend(ast.parse('''rings = list(rings)
if len(rings) > 4:
    rings = [rings[round(i*(len(rings)-1)/3)] for i in range(4)]
''').body)
                if self.group:
                    assignments.extend(ast.parse('''if len(rings) > 3:
    rings = [rings[0], rings[len(rings)//2], rings[-1]]
''').body)
            node.body = assignments + node.body
        if node.name == 'medical_star' and self.lod > 0:
            node.body = [statement for statement in node.body if not ('modifiers' in ast.unparse(statement) or 'modifier_apply' in ast.unparse(statement) or ast.unparse(statement).startswith('be.'))]
        return self.generic_visit(node)

    def visit_Assign(self, node):
        # Native cap/dress/profile construction uses explicit radial constants.
        if isinstance(node.value, ast.Constant) and isinstance(node.value.value, int):
            names = [t.id for t in node.targets if isinstance(t, ast.Name)]
            if set(names) & {'seg', 'N', 'segments'} and node.value.value >= 10:
                node.value = ast.Constant(self.radial)
            if 'rows' in names and node.value.value >= 6:
                node.value = ast.Constant((7, 5, 3)[self.lod])
            if any(isinstance(t, ast.Attribute) and t.attr == 'segments' for t in node.targets):
                node.value = ast.Constant(1)
            if any(isinstance(t, ast.Attribute) and t.attr in ('resolution_u', 'render_resolution_u') for t in node.targets):
                node.value = ast.Constant(1)
        return self.generic_visit(node)


def source_scene(source, lod, group):
    text = source.read_text().split(STOPS[source.parent.name])[0]
    if group:
        radial = (8, 6, 4)[lod]
        text = text.replace('range(24)', f'range({radial})').replace('*24', f'*{radial}').replace('/24', f'/{radial}').replace('%24', f'%{radial}')

    tree = Recipe(lod, group).visit(ast.parse(text))
    ast.fix_missing_locations(tree)
    previous = sys.argv
    sys.argv = [str(source)]
    try:
        exec(compile(tree, str(source), 'exec'), {'__file__': str(source), '__name__': '__aftermath_recipe__'})
    finally:
        sys.argv = previous
    bpy.context.view_layer.update()
    omitted = []
    for obj in list(bpy.context.scene.objects):
        if obj.type != 'MESH':
            continue
        name = obj.name.lower()
        omit = any(s in name for s in TRIM) or (lod == 2 and any(s in name for s in FAR))
        if source.parent.name == 'npc.paramedic' and 'hand medical case' in name:
            omit = True  # Rosa is unarmed and has empty hands in L5/L6.
        if lod == 2 and any(s in name for s in ('nape curl', 'swept silver lock', 'moustache lock', 'knit rib', 'hem band', 'rolled cuff', 'turned trouser cuff', 'knee fabric', 'round shoe toe', 'white sideburn', 'temple sweep', 'cheek blush', 'smile crease', 'slant pocket', 'rear patch pocket', 'neck ribbing', 'shoe tongue', 'leather welt', 'lower lip', 'nose bridge')):
            omit = True
        if lod > 0 and any(s in name for s in ('layered crown', 'medical backpack piping', 'harness inset', 'cargo pocket', 'pouch flap', 'hip gear cable', 'outer lash', 'lower lid', 'cheek blush')):
            omit = True
        if lod == 2 and any(s in name for s in ('layered crown', 'temple sideburn', 'side flick', 'hip gear cable', 'harness inset', 'backpack piping', 'red harness strap', 'outer lash', 'utility pouch', 'cargo pocket', 'pouch flap', 'shirt placket', 'sleeve folded cuff', 'rounded toe cap', 'knee cloth', 'bun_coil', 'half_up_sweep', 'tote_piping', 'cardigan_placket', 'back_cardigan_hem', 'rolled_cuff', 'shoe_collar', 'eye_rim', 'ear_inner', 'tote_leaf_stem', 'outer_tote_stem', 'upper lashes', 'gathered_waist', 'tote_leaf0', 'tote_leaf1', 'tote_leaf2', 'tote_leaf3', 'tote_leaf4', 'equipment pouch', 'belt pouch', 'glove cuff', 'boot collar', 'boot tongue', 'boot welt', 'medical backpack silver latch', 'hair sheen', 'long temple framing lock', 'harness adjuster', 'medical backpack webbing', 'medical backpack corner guard', 'radio speaker')):
            omit = True
        if group and any(s in name for s in ('sole tread', 'brass button', 'pack stud', 'shoe side stripe', 'sleeve fold', 'thigh crease', 'ankle gather', 'elbow fold', 'fringe ridge', 'ear bowl', 'eye socket')):
            omit = True
        if group and any(s in name for s in ('crown hair', 'shoulder webbing', 'finger', 'lace', 'pack clasp', 'pack buckle', 'pack flap', 'pack piping', 'pants pocket', 'shirt light', 'cord end')):
            omit = True
        if group and lod == 2 and any(s in name for s in ('swept fringe', 'crown flick', 'pant cuff', 'cap emblem', 'cap patch', 'bun coil', 'shirt collar', 'hood drawstring', 'collar fold', 'beard jaw', 'toe cap', 'heel', 'tongue', 'underhood', 'hood horseshoe', 'hem band', 'belt', 'field patch', 'patch emblem', 'pack side', 'pack handle', 'sleeve cuff', 'elbow', 'wrist', 'knee', 'cheek', 'glint', 'lash', 'lid', 'nose wing', 'eye bag', 'ear inner')):
            omit = True
        if lod == 2 and group and any(s in name for s in ('pocket', 'strap', 'zip', 'trim', 'glint', 'lash', 'lid', 'lip', 'mouth corner', 'nose bridge', 'brass', 'sole ', 'welt')):
            omit = True
        if lod == 2 and name.startswith('pony sculpt lock') and name.endswith(('.001', '.003', '.005', '.007')):
            omit = True
        if group and lod > 0:
            keep = ('shirt', 'coat shell', 'neck', 'pants seat', 'sleeve', 'forearm', 'palm',
                    'trouser thigh', 'trouser shin', 'outsole', 'shoe upper', 'backpack body',
                    'face sculpt', 'ear', 'eye white', 'iris', 'nose tip', 'scalp',
                    'cap crown', 'cap bill', 'hair bun', 'glasses rim', 'glasses temple',
                    'glasses bridge', 'beard chin volume', 'chin beard', 'moustache', 'worried brow',
                    'swept fringe', 'crown flick', 'sideburn', 'beard cheek', 'midsole', 'rolled cuff', 'cap patch')
            if lod == 2:
                keep = tuple(n for n in keep if n not in ('shirt', 'neck', 'ear', 'nose tip', 'swept fringe', 'worried brow', 'midsole', 'rolled cuff', 'cap patch', 'sideburn', 'beard cheek', 'glasses temple'))
            plain = name.rsplit('.', 1)[0] if name[-3:].isdigit() else name
            omit = plain not in keep
            if lod == 2 and plain == 'crown flick' and not name.endswith('.001'):
                omit = True
        if name.startswith(('flower_', 'bodice_petal')):
            # Keep the large floral identity, drop the two subpixel sprinkle rows.
            if name.startswith(('flower_1_', 'flower_3_')) or 'center' in name:
                omit = True
            else:
                vertices = [v.co.copy() for v in obj.data.vertices]
                lo = Vector(tuple(min(v[k] for v in vertices) for k in range(3)))
                hi = Vector(tuple(max(v[k] for v in vertices) for k in range(3)))
                c = (lo+hi)/2
                r = (hi-lo)/2
                vs = [(c.x+r.x, c.y+r.y*math.cos(i*math.tau/5), c.z+r.z*math.sin(i*math.tau/5)) for i in range(5)]
                material = obj.data.materials[0]
                mesh = bpy.data.meshes.new(obj.name+'_flatPetal')
                mesh.from_pydata(vs, [], [(0,1,2),(0,2,3),(0,3,4)])
                mesh.materials.append(material)
                obj.data = mesh
        if omit:
            omitted.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)
    return omitted


def tint_and_wrap(root, lod, group):
    white = palette.mat('picketWhite')
    neutral = white.diffuse_color[:3]
    meshes = [o for o in root.children_recursive if o.type == 'MESH']
    for obj in meshes:
        layer = obj.data.color_attributes.new(name='palette', type='FLOAT_COLOR', domain='CORNER')
        obj.data.color_attributes.active_color = layer
        for face in obj.data.polygons:
            material = obj.data.materials[face.material_index]
            rgb = material.diffuse_color[:3]
            token = material.name.lower()
            # Clothes remain recognisable: feather a broad diagonal soot field,
            # stronger on hems/knees/backpack, leaving living eyes and skin warm.
            cloth = not any(s in token for s in ('skin', 'eye', 'hair', 'mouth')) and not any(s in obj.name.lower() for s in ('eye', 'iris', 'pupil', 'glint', 'medical star', 'insignia'))
            for index in face.loop_indices:
                p = obj.matrix_world @ obj.data.vertices[obj.data.loops[index].vertex_index].co
                wave = math.sin(p.x*13+p.y*8+p.z*9) + .45*math.sin(p.z*21-p.y*11)
                dirt = max(0, min(.62, (wave+.45)*.28)) if cloth else .08 if 'skin' in token else 0
                if cloth:
                    patch = math.exp(-((p.z-.84)/.16)**2-((p.y-.075)/.14)**2)
                    dirt = max(dirt, .68*patch)
                if cloth and p.z < .48:
                    dirt = max(dirt, .28)
                layer.data[index].color = (*[min(1, rgb[i]/neutral[i])*(1-dirt) for i in range(3)], 1)
        obj.data.materials.clear()
        obj.data.materials.append(white)
    # Closed, pale cuff wraps occupy the native forearm, attached to that owner.
    # The original elbow/wrist locations determine direction, never a new rig.
    prefixes = ['', 'survivor02_', 'survivor03_', 'survivor04_'] if group else ['']
    for prefix in prefixes:
        elbow = bpy.data.objects[prefix+'foreArmL']
        wrist = bpy.data.objects[prefix+'handL']
        a, b = elbow.matrix_world.translation, wrist.matrix_world.translation
        center = a.lerp(b, .67)
        length = (b-a).length*.40
        bpy.ops.mesh.primitive_cylinder_add(vertices=(12, 8, 4)[lod], radius=.051, depth=length, location=center)
        wrap = bpy.context.object
        wrap.name = prefix+'cleanArmWrap'
        wrap.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
        wrap.data.materials.append(white)
        bpy.context.view_layer.update()
        world = wrap.matrix_world.copy()
        wrap.parent = elbow
        wrap.matrix_world = world
        layer = wrap.data.color_attributes.new(name='palette', type='FLOAT_COLOR', domain='CORNER')
        wrap.data.color_attributes.active_color = layer
        for value in layer.data:
            value.color = (.98, .98, .95, 1)
    if lod == 2 and root.get('skinSource') == 'npc.paramedic':
        head = bpy.data.objects['head']
        pony = [o for o in root.children_recursive if o.type == 'MESH' and o.name.startswith('pony sculpt lock')]
        points = [o.matrix_world@v.co for o in pony for v in o.data.vertices]
        lo = Vector(tuple(min(p[k] for p in points) for k in range(3)))
        hi = Vector(tuple(max(p[k] for p in points) for k in range(3)))
        center, radius = (lo+hi)/2, (hi-lo)/2
        vertices = []
        for z, fraction in [(lo.z, .30), (center.z, 1), (hi.z, .30)]:
            for j in range(6):
                a = j*math.tau/6
                vertices.append((center.x+radius.x*fraction*math.cos(a), center.y+radius.y*fraction*math.sin(a), z))
        faces = [(i*6+j, i*6+(j+1)%6, (i+1)*6+(j+1)%6, (i+1)*6+j) for i in range(2) for j in range(6)]
        faces += [tuple(reversed(range(6))), tuple(range(12,18))]
        data = bpy.data.meshes.new('closedPonyVolume'); data.from_pydata(vertices, [], faces)
        data.materials.append(white)
        obj = bpy.data.objects.new('closedPonyVolume', data); bpy.context.scene.collection.objects.link(obj)
        obj.parent = head; obj.matrix_parent_inverse = head.matrix_world.inverted()
        layer = data.color_attributes.new(name='palette', type='FLOAT_COLOR', domain='CORNER'); data.color_attributes.active_color = layer
        for value in layer.data: value.color = (.27, .085, .032, 1)
        for strand in pony: bpy.data.objects.remove(strand, do_unlink=True)
    protected = {o.name for o in root.children_recursive if o.type == 'EMPTY' and not 'socket' in o.name.lower()}
    export.merge_by_material(root, protected, preserve_vertex_colors=True)
    # The shared merger emits explicit triangles. Smooth native rounded forms;
    # normals are applied per owner with no topology reduction.
    for obj in root.children_recursive:
        if obj.type == 'MESH':
            for face in obj.data.polygons:
                face.use_smooth = True
    bpy.context.view_layer.update()


def build_aftermath(directory, output):
    directory = Path(directory).resolve()
    base = BASES[directory.name]
    source = directory.parent/base/'build.py'
    only = int(sys.argv[sys.argv.index('--distance-tier')+1]) if '--distance-tier' in sys.argv else None
    if only not in (None, 0, 1, 2):
        raise ValueError('distance tier must be 0, 1 or 2')
    stats = {}
    for lod in ((only,) if only is not None else (0, 1, 2)):
        omitted = source_scene(source, lod, base == 'npc.survivor-group')
        root = bpy.data.objects['root']
        root['asset_id'] = directory.name
        root['skinSource'] = base
        root['animation'] = 'rigid-part'
        root['adult'] = True
        root['aftermath'] = True
        root['unarmed'] = True
        tint_and_wrap(root, lod, base == 'npc.survivor-group')
        meshes = [o for o in root.children_recursive if o.type == 'MESH']
        points = [o.matrix_world@v.co for o in meshes for v in o.data.vertices]
        low = [min(p[k] for p in points) for k in range(3)]
        high = [max(p[k] for p in points) for k in range(3)]
        sockets.empty('front', (high[0]+.02, 0, (low[2]+high[2])/2), root)
        root['deliveryLod'] = lod
        path = directory/('model.glb' if lod == 0 else f'model.lod{lod}.glb')
        export.glb(root, path)
        triangles = sum(len(o.data.polygons) for o in meshes)
        cap = (15000, 6000, 2000)[lod]
        stats[str(lod)] = {'triangles': triangles, 'draws': len(meshes), 'materials': 1,
                           'bytes': path.stat().st_size, 'dimensionsNative': [high[k]-low[k] for k in range(3)], 'omitted': omitted}
        print('AFTERMATH', directory.name, lod, json.dumps({k:v for k,v in stats[str(lod)].items() if k != 'omitted'}))
        if triangles > cap:
            raise ValueError(f'{directory.name} LOD{lod}: {triangles} > {cap}')
    (directory/'lod-stats.json').write_text(json.dumps(stats, indent=2)+'\n')
    shutil.copyfile(directory/('model.glb' if only in (None, 0) else f'model.lod{only}.glb'), output)


MEMBERS = {'dale': ('survivor01_root', ''), 'sam': ('survivor03_root', 'survivor03_'),
           'cap-woman': ('survivor02_root', 'survivor02_'), 'bun-woman': ('survivor04_root', 'survivor04_')}


def build_member(directory, output):
    """Extract one independently usable stock adult from the authored group.

    Shared GLBs are the dependency, no duplicated model or newly authored rig.
    Member roots become origin-centred; all native joint-local frames survive.
    """
    directory = Path(directory).resolve()
    group = directory.parent/'npc.survivor-group.aftermath'
    key = directory.name.removeprefix('npc.survivor-group.aftermath.')
    member_name, prefix = MEMBERS[key]
    stats = {}
    for lod in (0, 1, 2):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        source = group/('model.glb' if lod == 0 else f'model.lod{lod}.glb')
        if not source.exists():
            raise ValueError('Build npc.survivor-group.aftermath first')
        bpy.ops.import_scene.gltf(filepath=str(source))
        member = bpy.data.objects[member_name]
        keep = {member, *member.children_recursive}
        member.parent = None
        member.matrix_world = Matrix.Identity(4)
        for obj in list(bpy.context.scene.objects):
            if obj not in keep:
                bpy.data.objects.remove(obj, do_unlink=True)
        member.name = 'root'
        for obj in member.children_recursive:
            if prefix and obj.name.startswith(prefix):
                obj.name = obj.name[len(prefix):]
        member['asset_id'] = directory.name
        member['skinSource'] = 'npc.survivor-group'
        member['animation'] = 'rigid-part'
        member['unarmed'] = True
        member['identity'] = key
        bpy.context.view_layer.update()
        meshes = [o for o in member.children_recursive if o.type == 'MESH']
        pts = [o.matrix_world@v.co for o in meshes for v in o.data.vertices]
        dims = [max(p[k] for p in pts)-min(p[k] for p in pts) for k in range(3)]
        sockets.empty('front', (max(p.x for p in pts)+.02, 0, dims[2]/2), member)
        destination = directory/('model.glb' if lod == 0 else f'model.lod{lod}.glb')
        export.glb(member, destination)
        stats[str(lod)] = {'triangles': sum(len(o.data.polygons) for o in meshes),
                           'draws': len(meshes), 'materials': 1, 'bytes': destination.stat().st_size,
                           'dimensionsNative': dims}
    (directory/'lod-stats.json').write_text(json.dumps(stats, indent=2)+'\n')
    shutil.copyfile(directory/'model.glb', output)
