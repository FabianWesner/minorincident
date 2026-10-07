#!/usr/bin/env python3
"""Adds the sfx2 recorded sources and cue recipes to assets/audio/imports.json (idempotent).
Usage: python3 tools/audio/sfx2_recipes.py <dir with downloaded archives and x/<pack>/ extractions>
Every source is CC0 (Kenney, rubberduck, qubodup, GGBotNet); the build tool downloads and hash-checks them."""
import hashlib, json, sys
root = sys.argv[1]
path = 'assets/audio/imports.json'
d = json.load(open(path))
def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()
CC0 = ('CC0', 'https://creativecommons.org/publicdomain/zero/1.0/')
PACKS = {
  'k': dict(pack='kenney-impact-sounds', file='kenney_impact-sounds.zip', dir='kenney_impact-sounds', pre='Audio/', title='Impact Sounds', author='Kenney', url='https://kenney.nl/assets/impact-sounds', dl='https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip', ext='.ogg'),
  'r75': dict(pack='rubberduck-75-breaking', file='sfx_breaking_and_falling.zip', dir='sfx_breaking_and_falling', pre='', title='75 CC0 breaking / falling / hit SFX', author='rubberduck', url='https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx', dl='https://opengameart.org/sites/default/files/sfx_breaking_and_falling.zip', ext='.ogg'),
  'r100': dict(pack='rubberduck-100-v2', file='sfx_100_v2.zip', dir='sfx_100_v2', pre='', title='100 CC0 SFX #2', author='rubberduck', url='https://opengameart.org/content/100-cc0-sfx-2', dl='https://opengameart.org/sites/default/files/sfx_100_v2.zip', ext='.ogg'),
  'rwm': dict(pack='rubberduck-wood-metal', file='100-CC0-wood-metal-SFX.zip', dir='100-CC0-wood-metal-SFX', pre='', title='100 CC0 Metal and Wood SFX', author='rubberduck', url='https://opengameart.org/content/100-cc0-metal-and-wood-sfx', dl='https://opengameart.org/sites/default/files/100-CC0-wood-metal-SFX.zip', ext='.ogg'),
  'car': dict(pack='ggbotnet-car-sfx', file='car_sound_effects_pack.zip', dir='car', pre='', title='Car Sound Effects Pack (Low Quality)', author='GGBotNet', url='https://opengameart.org/content/car-sound-effects-pack-low-quality', dl='https://opengameart.org/sites/default/files/car_sound_effects_pack.zip', ext='.ogg'),
  'sc': dict(pack='qubodup-slightscreams', file='slightscreams.7z', dir='slightscreams', pre='', title='15 vocal male strain/hurt/pain/jump sounds', author='qubodup', url='https://opengameart.org/content/15-vocal-male-strainhurtpainjump-sounds', dl='https://opengameart.org/sites/default/files/slightscreams.7z', ext='.flac'),
}
used = {}
def src(key):
    """key like 'k:footstep_concrete_000' -> source id, registering metadata."""
    p, name = key.split(':'); pk = PACKS[p]; sid = f'sfx2-{p}-{name}'
    if sid not in d['sources']:
        member = pk['pre'] + name + pk['ext']
        d['sources'][sid] = dict(title=f"{pk['title']}: {name}", author=pk['author'], license=CC0[0], licenseUrl=CC0[1], url=pk['url'], pack=pk['pack'], downloadUrl=pk['dl'], downloadFile=pk['file'],
            downloadSha256=sha(f"{root}/{pk['file']}"), member=member, sha256=sha(f"{root}/x/{pk['dir']}/{member}"))
    return sid
def fam(cue, items, n=4):
    """Four variants (cue, cue.v1..v3) from (key, filter) pairs; fewer than four repeat cyclically."""
    for i in range(n):
        key, filt = items[i % len(items)]
        r = dict(source=src(key), start=0)
        if filt: r['filter'] = filt
        d['cues'][cue if i == 0 else f'{cue}.v{i}'] = r
def ks(n, a, b=None, lo=None): return [(f'k:{n}_{i:03d}', lo) for i in range(a, a + 4)]
def up(r): return f'asetrate={int(48000 * r)},aresample=48000'
SOFT = 'lowpass=f=4800'
# footsteps: soft, short, matched to the contact (recorded, per surface)
for surf, items in {
  'asphalt': ks('footstep_concrete', 0, lo=SOFT), 'sidewalk': ks('footstep_concrete', 1, lo='lowpass=f=5200'), 'grass': ks('footstep_grass', 0),
  'wood': ks('footstep_wood', 0), 'tile': [(k, up(1.1) + ',lowpass=f=6000') for k, _ in ks('footstep_concrete', 0)],
  'metal': ks('impactPlate_light', 0, lo='lowpass=f=3800'), 'glass': ks('impactGlass_light', 0, lo='lowpass=f=5000'),
  'water': [(f'r100:sfx100v2_footstep_wet_0{i}', None) for i in (1, 2, 3, 1)], 'blood': [(f'r100:sfx100v2_footstep_wet_0{i}', 'lowpass=f=1800') for i in (1, 2, 3, 2)],
}.items(): fam(f'footstep.survivor.{surf}', items)
for surf in ('asphalt', 'sidewalk', 'grass', 'tile', 'gravel'):  # corgi claws: lighter, higher
    base = 'footstep_grass' if surf == 'grass' else 'footstep_concrete'
    fam(f'footstep.corgi.{surf}', [(f'k:{base}_{i:03d}', up(1.5) + ',highpass=f=500') for i in range(4)])
# melee hit layers: transient (existing flesh.*) + body + low thump
fam('impact.body.punch', ks('impactPunch_medium', 0))
fam('impact.body.wood', ks('impactWood_heavy', 0))
fam('impact.body.metal', ks('impactMetal_medium', 0))
fam('impact.thump', [(k, up(0.8) + ',lowpass=f=260') for k, _ in ks('impactSoft_heavy', 0)])
# human voice: survivor effort / hurt (male recorded; female = same takes raised ~20 %)
EFF, HURT = (2, 4, 5, 7, 9, 12, 13, 15), (6, 8, 3, 11, 14, 1, 10, 6)
sc = lambda n: f'sc:slightscream-{n:02d}'
fam('bark.male.effort', [(sc(n), None) for n in EFF[:4]]); fam('bark.male.hurt', [(sc(n), None) for n in HURT[:4]])
fam('bark.female.effort', [(sc(n), up(1.2)) for n in EFF[4:]]); fam('bark.female.hurt', [(sc(n), up(1.22)) for n in HURT[4:]])
fam('bark.male.quip', [(sc(n), None) for n in (4, 7, 9, 12)]); fam('bark.female.quip', [(sc(n), up(1.2)) for n in (13, 15, 5, 2)])
# props, glass, doors
fam('prop.wood', [(f'rwm:wood_hit_0{i}', None) for i in (1, 2, 3, 4)]); fam('prop.metal', [(f'rwm:metal_hit_0{i}', None) for i in (1, 2, 3, 4)])
fam('prop.plastic', ks('impactTin_medium', 0)); fam('prop.glass', [('r75:bfh1_glass_hit_01', None), ('r75:bfh1_glass_hit_02', None), ('k:impactGlass_medium_000', None), ('k:impactGlass_medium_001', None)])
fam('prop.rubber', ks('impactSoft_medium', 0)); fam('prop.sandbag', ks('impactSoft_heavy', 0))
fam('prop.break', [(f'r75:bfh1_wood_breaking_0{i}', None) for i in (1, 2, 3, 4)]); fam('prop.creak', [(f'rwm:wood_cracking_0{i}', None) for i in (1, 2, 3, 4)])
fam('prop.brace', [(f'rwm:wood_slam_0{i}', None) for i in (1, 2, 3, 4)])
fam('lamp.break', [(f'r75:bfh1_glass_breaking_0{i}', None) for i in (1, 2, 3, 4)])
fam('lamp.power-on', [('r100:sfx100v2_switch_01', None), ('r100:sfx100v2_switch_02', None), ('r100:sfx100v2_switch_01', up(1.08)), ('r100:sfx100v2_switch_02', up(0.93))])
fam('lamp.power-off', [('r100:sfx100v2_switch_02', up(0.9)), ('r100:sfx100v2_switch_01', up(0.92)), ('r100:sfx100v2_switch_02', up(0.85)), ('r100:sfx100v2_switch_01', up(0.88))])
fam('lamp.flicker', [('r100:sfx100v2_switch_01', 'highpass=f=900'), ('r100:sfx100v2_switch_02', 'highpass=f=900')])
fam('door.gate', [('rwm:metal_open_01', None), ('rwm:metal_close_01', None), ('r100:sfx100v2_door_01', None), ('r100:sfx100v2_door_02', None)])
fam('door.wood', [('rwm:wood_close_01', None), ('rwm:wood_close_02', None), ('r100:sfx100v2_door_03', None), ('r100:sfx100v2_door_04', None)])
fam('explosion.boom', [(k, up(0.62) + ',lowpass=f=1100') for k, _ in ks('impactMetal_heavy', 0)])
fam('explosion.crack', [(f'r75:bfh1_metal_hit_0{i}', 'highpass=f=300') for i in (1, 2, 3, 4)])
fam('explosion.debris', [(f'r75:bfh1_rock_falling_0{i}', None) for i in (1, 2, 3, 4)])
fam('vehicle.horn', [('car:Car_Horn', None)], 1); fam('vehicle.crash', [('r75:bfh1_metal_falling_01', None), ('k:impactMetal_heavy_000', None), ('r75:bfh1_metal_falling_02', None), ('k:impactMetal_heavy_001', None)])
fam('vehicle.grab', ks('impactMetal_light', 0))
d['cues']['ambient.alarm'] = dict(d['cues']['l1.chaos.car-alarm']) if 'l1.chaos.car-alarm' in d['cues'] else dict(source='siren', start=0.5)
fam('ui.death', [('k:impactBell_heavy_000', up(0.7) + ',lowpass=f=1800')], 1)
d['cues']['ui.respawn'] = dict(source='ui-select-0', start=0)
# L1 sound arc, bike
fam('bike.bell', [(f'k:impactBell_heavy_00{i}', up(1.6)) for i in range(4)])
fam('l1.calm.bike-tick', [('k:impactMetal_light_000', 'highpass=f=1800,lowpass=f=7000')], 1)
d['cues']['l1.glass.rattle'] = dict(source=src('r75:bfh1_glass_falling_01'), start=0)
d['cues']['l1.bell'] = dict(source=src('k:impactBell_heavy_001'), start=0)
d['cues']['l1.crash'] = dict(source=src('r75:bfh1_metal_falling_02'), start=0)
json.dump(d, open(path, 'w'), indent=2); open(path, 'a').write('\n')
print('sources', len(d['sources']), 'cues', len(d['cues']))
