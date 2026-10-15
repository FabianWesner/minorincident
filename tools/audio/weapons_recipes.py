#!/usr/bin/env python3
"""Weapon audio pass (PO bug 36, 10-15): adds the recorded weapon sources and cue recipes to assets/audio/imports.json (idempotent).
Usage: python3 tools/audio/weapons_recipes.py <dir with lib.7z, residue/r.zip, reload/*.wav> (for the source hashes)
Sources, all CC0 (the build tool downloads and hash-checks them):
  - The Free Firearm Sound Library (Ben Jaszczak, Brian Nelson, Kevin Heras, Matthew Nanney; OGA user bart): real 1911, Walther PPQ, Model 12, Nova, AK-47, PPSh ... recordings
  - SpringySpringo "gun reload sounds": reload and shotgun pump
  - FacadeGaikan "Residue SFX": empty-clip click, barrel whir
Per-class loudness targets live in LEVEL (active-part RMS dBFS, see tools/audio/build.ts); tools/audio/weapon-loudness.ts measures LUFS / true peak."""
import hashlib, json, sys
root = sys.argv[1].rstrip('/')
path = 'assets/audio/imports.json'
d = json.load(open(path))
def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()
CC0 = ('CC0', 'https://creativecommons.org/publicdomain/zero/1.0/')
FFL = 'Prepared SFX Library/'
FFL_URL = 'https://opengameart.org/content/the-free-firearm-sound-library'
def ffl(name):
    sid = 'fw-' + name.replace('/', '-').replace(' ', '_').replace('.wav', '')
    if sid not in d['sources']:
        d['sources'][sid] = dict(title=f'The Free Firearm Sound Library: {name.split("/")[1]} ({name.split("/")[0]})', author='Ben Jaszczak, Brian Nelson, Kevin Heras, Matthew Nanney (OGA: bart)', license=CC0[0], licenseUrl=CC0[1],
            url=FFL_URL, pack='free-firearm-sound-library', downloadUrl='https://opengameart.org/sites/default/files/Prepared%20SFX%20Library.7z', downloadFile='Prepared SFX Library.7z',
            downloadSha256=sha(f'{root}/ffl/lib.7z'), member=FFL + name, sha256=sha(f'{root}/ffl/{FFL}{name}'))
    return sid
def single(sid, title, author, url, pack, dl, file, member, local, ):
    if sid not in d['sources']:
        d['sources'][sid] = dict(title=title, author=author, license=CC0[0], licenseUrl=CC0[1], url=url, pack=pack, downloadUrl=dl, downloadFile=file, downloadSha256=sha(local), member=member, sha256=sha(local))
    return sid
def reload_src(sid, title, f):
    return single(sid, f'gun reload sounds: {title}', 'SpringySpringo', 'https://opengameart.org/content/gun-reload-sounds', 'springyspringo-gun-reload',
        f'https://opengameart.org/sites/default/files/{f}', f, f, f'{root}/reload/{f}')
def residue(name):
    sid = f'residue-{name}'
    if sid not in d['sources']:
        d['sources'][sid] = dict(title=f'Residue SFX: {name}', author='FacadeGaikan', license=CC0[0], licenseUrl=CC0[1], url='https://opengameart.org/content/residue-sfx', pack='residue-sfx',
            downloadUrl='https://opengameart.org/sites/default/files/residue-sfx.zip', downloadFile='residue-sfx.zip', downloadSha256=sha(f'{root}/residue/r.zip'), member=f'residue-sfx/{name}', sha256=sha(f'{root}/residue/residue-sfx/{name}'))
    return sid
def up(r): return f'asetrate={int(48000 * r)},aresample=48000'
# Active-part RMS targets in dBFS (build.ts `level`; the gentle compressor evens the crest first). Louder class = higher number.
LEVEL = dict(melee=-19, handgun=-8, nail=-8, smg=-8, rifle=-8, mg=-8, hunting=-8, shotgun=-8, rocket=-8, minigun=-8, hmg=-8, throw=-21, thump=-18)
# Pre-limiter boost in dB per cue: raises the body and tail against the transient (a gunshot's crest is ~25 dB) so the class gets its loudness inside the -4.4 dBFS sprite ceiling.
BOOST = {'action.weapon.handgun': 22, 'action.weapon.pistol': 30, 'action.weapon.nail-gun': 12, 'action.weapon.firecracker-lure': 3, 'action.weapon.shotgun': 30, 'action.weapon.smg': 18, 'action.ability.turret': 18,
         'action.weapon.assault-rifle': 22, 'action.weapon.hunting-rifle': 30, 'action.weapon.machine-gun': 24, 'action.weapon.army-mg': 24, 'action.weapon.rotary-minigun': 18, 'weapon.hmg': 28, 'action.weapon.rocket-launcher': 7}
def lim(g): return f'volume={g}dB,asoftclip=type=tanh'
def fam(cue, items, level=None, n=4):
    """Four takes (cue, cue.v1..v3) from (source, start, filter) triples; fewer repeat cyclically."""
    for i in range(n):
        src, start, filt = items[i % len(items)]
        r = dict(source=src, start=round(max(0, start), 3))
        if BOOST.get(cue): filt = (filt + ',' if filt else '') + lim(BOOST[cue])
        if filt: r['filter'] = filt
        if level is not None: r['level'] = level
        d['cues'][cue if i == 0 else f'{cue}.v{i}'] = r
O = 0.02  # start a hair before the detected onset
def shots(file, onsets, filt=None): return [(ffl(file), t - O, filt) for t in onsets]
# ---- handguns: sharp crack, short tail
ppq = shots('Walther PPQ/X_39P.wav', [1.40, 6.44, 10.66])
c1911 = shots('1911/A_42P.wav', [0.94, 5.00])
sw = shots('Smith & Wesson 642/V_27P.wav', [0.80, 6.21])
fam('action.weapon.handgun', ppq + [ppq[0]], LEVEL['handgun'])
fam('action.weapon.pistol', c1911 + sw, LEVEL['handgun'])
fam('action.weapon.nail-gun', shots('Ruger Mark III/R_35P.wav', [0.48, 4.48], 'highpass=f=250,' + up(1.12)), LEVEL['nail'])
# ---- shotgun: deep boom with body (low shelf + slightly slowed), long tail; pump rack is its own cue
sg_f = 'bass=g=7:f=110:w=0.8,' + up(0.9)
fam('action.weapon.shotgun', shots('Model 12/K_22P.wav', [0.84, 7.44], sg_f) + shots('Nova/O_21P.wav', [0.43], sg_f) + shots('CD/H_21P.wav', [0.46], sg_f), LEVEL['shotgun'])
d['cues']['weapon.pump'] = dict(source=reload_src('wp-shotguncock', 'shotguncock.wav', 'shotguncock_0.wav'), start=0, level=-17)
for i in range(1, 4): d['cues'][f'weapon.pump.v{i}'] = dict(source='wp-shotguncock', start=0, level=-17, filter=up([0.96, 1.04, 0.92][i - 1]))
# ---- SMG / rifles / machine guns: punchy single rounds, short tails (they fire in rapid succession)
fam('action.weapon.smg', shots('PPSh/P_30P.wav', [0.96, 4.38, 8.24, 11.42], 'bass=g=3:f=140'), LEVEL['smg'])
fam('action.weapon.assault-rifle', shots('AK-47/C_28P.wav', [0.61, 3.25, 6.02, 9.15]), LEVEL['rifle'])
fam('action.weapon.machine-gun', shots('AK-47/C_28P.wav', [0.61, 3.25, 6.02, 9.15], 'bass=g=5:f=120,' + up(0.88)), LEVEL['mg'])
fam('action.weapon.army-mg', shots('AR-15/D_32P.wav', [0.70, 5.64], 'bass=g=5:f=110,' + up(0.9)) + shots('Carl Gustav M45/G_31P.wav', [0.31, 3.50], 'bass=g=5:f=110,' + up(0.9)), LEVEL['mg'])
fam('action.weapon.hunting-rifle', shots('Tikka/W_29P.wav', [0.57, 5.66], 'bass=g=4:f=120') + shots('Savage 10 .300 Blackout/T_27P.wav', [0.95, 4.96], 'bass=g=4:f=120'), LEVEL['hunting'])
fam('action.weapon.rotary-minigun', shots('AK-47/C_28P.wav', [0.61, 3.25, 6.02, 9.15], 'bass=g=4:f=130,' + up(1.0)), LEVEL['minigun'])
fam('weapon.hmg', shots('AR-15/D_32P.wav', [0.70, 5.64], 'bass=g=9:f=90,' + up(0.78)) + shots('Savage 10 .300 Blackout/T_27P.wav', [0.95, 4.96], 'bass=g=9:f=90,' + up(0.78)), LEVEL['hmg'])
fam('action.ability.turret', shots('PPSh/P_30P.wav', [0.96, 4.38, 8.24, 11.42], 'highpass=f=150,' + up(1.1)), LEVEL['smg'])
# minigun barrel whir (looped; AudioService pitches it with the spin); empty click
d['cues']['weapon.minigun-whir'] = dict(source=residue('ventilator.wav'), start=0, level=-24, filter='lowpass=f=2400,bass=g=4:f=120')
# ---- rocket launcher: blast (boom slowed to half speed + shotgun blast under it); whoosh stays synthesized (self-made)
fam('action.weapon.rocket-launcher', [(residue('boom.ogg'), 0, 'bass=g=10:f=90,lowpass=f=2600,' + up(0.55)), (residue('boom.ogg'), 0, 'bass=g=10:f=90,lowpass=f=2200,' + up(0.5)),
    (ffl('Model 12/K_22P.wav'), 0.84 - O, 'bass=g=12:f=80,lowpass=f=2400,' + up(0.5)), (ffl('Nova/O_21P.wav'), 0.43 - O, 'bass=g=12:f=80,lowpass=f=2400,' + up(0.5))], LEVEL['rocket'])
# ---- throwables: lobbed throw whoosh (existing CC0 bamboo swishes, slower and lower); molotov adds a glass clink
def sw_(i, r, extra=''): return ('swish-%d' % i, 0.0, up(r) + ',lowpass=f=3200' + extra)
fam('action.weapon.grenade', [sw_(0, 0.7), sw_(1, 0.66), sw_(2, 0.72), sw_(3, 0.68)], LEVEL['throw'])
fam('action.weapon.pipe-bomb', [sw_(2, 0.62), sw_(3, 0.6), sw_(0, 0.64), sw_(1, 0.62)], LEVEL['throw'])
fam('action.weapon.smoke-grenade', [sw_(1, 0.6), sw_(0, 0.62), sw_(3, 0.58), sw_(2, 0.6)], LEVEL['throw'])
fam('action.weapon.flashbang', [sw_(3, 0.8), sw_(2, 0.78), sw_(1, 0.82), sw_(0, 0.8)], LEVEL['throw'])
fam('action.weapon.molotov', [('sfx2-r75-bfh1_glass_hit_01', 0.0, 'highpass=f=1200,' + up(0.9)), sw_(0, 0.66), ('sfx2-r75-bfh1_glass_hit_02', 0.0, 'highpass=f=1200,' + up(0.85)), sw_(1, 0.64)], LEVEL['throw'])
fam('action.weapon.firecracker-lure', shots('Ruger Mark III/R_35P.wav', [0.48, 4.48], 'highpass=f=900,' + up(1.5)), LEVEL['nail'])
# ---- melee swings: heavier tools slower/lower, light blades faster/higher (same CC0 swish takes)
for cue, takes, level in [('knife', [(0, 1.35), (3, 1.3), (1, 1.4), (2, 1.32)], LEVEL['melee'] - 3), ('katana', [(0, 1.5), (1, 1.45), (3, 1.55), (2, 1.5)], LEVEL['melee']),
                          ('nail-bat', [(2, 0.9), (3, 0.88), (1, 0.92), (0, 0.9)], LEVEL['melee']), ('shovel', [(3, 0.78), (2, 0.8), (1, 0.76), (0, 0.78)], LEVEL['melee']),
                          ('police-baton', [(1, 1.1), (0, 1.08), (3, 1.12), (2, 1.1)], LEVEL['melee']), ('fire-axe', [(2, 0.62), (3, 0.6), (1, 0.64), (0, 0.62)], LEVEL['melee'] + 2)]:
    fam(f'action.weapon.{cue}', [('swish-%d' % i, 0.03, up(r)) for i, r in takes], level)
fam('action.ability.ground-slam', [(f'sfx2-k-impactSoft_heavy_00{i}', 0.0, 'bass=g=6:f=80,' + up(0.7)) for i in range(4)], LEVEL['thump'])
# (The other melee weapons keep using the existing flesh.* hit takes through AudioService's fleshLike map: the L1 initial bank is at its 4 MB budget.)
for weapon in ('knife', 'katana', 'fire-axe', 'nail-bat', 'shovel', 'police-baton'):
    for suffix in ('', '.v1', '.v2', '.v3'): d['cues'].pop(f'flesh.{weapon}{suffix}', None)
# ---- reload / empty
d['cues']['weapon.reload'] = dict(source=reload_src('wp-gunreload1', 'gunreload1.wav', 'gunreload1.wav'), start=0.15, level=-24)
d['cues']['weapon.reload-rifle'] = dict(source=reload_src('wp-assaultriflereload1', 'assaultriflereload1.wav', 'assaultriflereload1_0.wav'), start=0.15, level=-24)
d['cues']['weapon.dry'] = dict(source=residue('emptyclip.wav'), start=0, level=-25)
# ---- ranged tails: the room's own decay, taken from the mid-distance Model 12 recording after the bang (street: short slap, interior/tunnel: long and dark, open: faint and short)
k17 = ffl('Model 12/K_17P.wav')
d['cues']['tail.street'] = dict(source=k17, start=1.0, filter='lowpass=f=3200,highpass=f=200', level=-31)
d['cues']['tail.interior'] = dict(source=k17, start=0.98, filter='lowpass=f=1800,aecho=0.8:0.6:45|90|140:0.4|0.3|0.2', level=-27)
d['cues']['tail.open'] = dict(source=k17, start=1.05, filter='lowpass=f=2200', level=-34)
json.dump(d, open(path, 'w'), indent=2); open(path, 'a').write('\n')
print('sources', len(d['sources']), 'cues', len(d['cues']))
