"""R15 source audit, paired live-bus metrics and spectrum sheets.
Run from the repository root after both hiss-capture.ts modes. Requires FFmpeg,
NumPy, SciPy, Matplotlib and Pillow. Raw PCM stays in R15_RAW (default /tmp).
"""
import json, subprocess, pathlib, hashlib, os
import numpy as np
from scipy import signal
root=pathlib.Path.cwd(); results=[]
for f in sorted((root/'public/assets/audio').glob('score-*')):
 if f.suffix not in ('.webm','.m4a'): continue
 p=subprocess.run(['ffmpeg','-v','error','-threads','1','-i',str(f),'-ac','1','-ar','48000','-f','f32le','-'],capture_output=True,check=True)
 x=np.frombuffer(p.stdout,dtype='<f4'); rate=48000
 # One-second windows; choose the quietest 10% by full-band music RMS.
 count=len(x)//rate; xw=x[:count*rate].reshape(count,rate)
 power=np.mean(xw*xw,axis=1); quiet=np.argsort(power)[:max(1,int(count*.1))]
 sos=signal.butter(6,[4000,16000],btype='bandpass',fs=rate,output='sos')
 band=signal.sosfilt(sos,x)[:count*rate].reshape(count,rate)
 bp=np.mean(band*band,axis=1)
 # Noise-like whiteness of a quiet excerpt. Music may have percussion/noisy pads;
 # this describes the spectrum, it does not label musical energy as hiss.
 q=int(quiet[0]); freq,px=signal.welch(xw[q],rate,nperseg=2048)
 y=px[(freq>=4000)&(freq<=16000)];flat=np.exp(np.mean(np.log(y+1e-30)))/(np.mean(y)+1e-30)
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=sample_rate,codec_name','-of','json',str(f)]))
 results.append(dict(file=f.name,sha256=hashlib.sha256(f.read_bytes()).hexdigest(),durationS=len(x)/rate,codec=probe['streams'][0],peakDbfs=float(20*np.log10(max(1e-12,np.max(np.abs(x))))),quietSeconds=quiet.tolist(),quietBandDbfs=float(10*np.log10(max(1e-24,np.mean(bp[quiet])))),quietFlatness=float(flat)))
 print(f.name,results[-1]['quietBandDbfs'],flush=True)
out=root/'docs/reports/r15-hiss';out.mkdir(exist_ok=True,parents=True)
(out/'music-source-audit.json').write_text(json.dumps(dict(sampleRate=48000,windowSeconds=1,quietFraction=.1,measurement='4-16 kHz sixth-order Butterworth band RMS in quietest 10% one-second full-band music windows; dBFS, mono decode',files=results),indent=2)+'\n')

# Audit each music sprite slice separately: padding between cues must not be
# mistaken for a low noise floor. Includes recorded accents and L10 heartbeat.
layout=json.loads((pathlib.Path(os.environ.get('R15_RAW', '/tmp/r15-hiss-audio'))/'audio-layout.json').read_text())
recipes=json.loads((root/'assets/audio/imports.json').read_text())['cues']
music_cues=[c for c in layout['cues'] if c['bus']=='music']; sprite_rows=[]
for category in sorted(set(c['category'] for c in music_cues)):
 for ext in ['webm','m4a']:
  path=root/'public/assets/audio'/f'{category}.{ext}'
  data=subprocess.check_output(['ffmpeg','-v','error','-threads','1','-i',str(path),'-ac','1','-ar','48000','-f','f32le','-'])
  bank=np.frombuffer(data,dtype='<f4')
  for cue in [c for c in music_cues if c['category']==category]:
   x=bank[round(cue['offset']*48000):round((cue['offset']+cue['duration'])*48000)]
   band=signal.sosfilt(signal.butter(6,[4000,16000],btype='bandpass',fs=48000,output='sos'),x)
   sprite_rows.append(dict(file=path.name,cue=cue['id'],offset=cue['offset'],duration=cue['duration'],recipe=recipes.get(cue['id'],'procedural'),bandRmsDbfs=float(10*np.log10(max(1e-24,np.mean(band*band)))),peakDbfs=float(20*np.log10(max(1e-12,np.max(np.abs(x)))))))
(out/'music-sprite-audit.json').write_text(json.dumps(sprite_rows,indent=2)+'\n')

# Actual live graph captures: paired stereo buses in a 10-channel PCM file.
import collections
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from scipy.io import wavfile
raw=pathlib.Path(os.environ.get('R15_RAW', '/tmp/r15-hiss-audio'))
levels=['L1','L4','L7','L10']; captures={}; summaries={}
for level in levels:
 for mode in ['before','after']:
  path=raw/f'{mode}-{level}.wav'; rate,pcm=wavfile.read(path)
  x=pcm.astype(np.float64)/32768.; meta=json.loads((raw/f'{mode}-{level}.json').read_text())
  assert x.shape[1]==10 and len(x)/rate>29, (path,x.shape)
  count=len(x)//(rate//2); blocks=x[:count*(rate//2)].reshape(count,rate//2,10)
  full=np.mean(blocks**2,axis=1)
  band=signal.sosfilt(signal.butter(6,[4000,16000],btype='bandpass',fs=rate,output='sos'),x,axis=0)
  bp=np.mean(band[:count*(rate//2)].reshape(count,rate//2,10)**2,axis=1)
  db=lambda p: float(10*np.log10(float(p))) if p > 0 else None
  cuecounts=collections.Counter(c['cue'] for c in meta['end']['audio']['cues'])
  peak=float(np.max(np.abs(x[:,:2]))); tp=float(np.max(np.abs(signal.resample_poly(x[:,:2],4,1,axis=0))))
  summary=dict(durationS=len(x)/rate,sampleRate=rate,frames=len(x),rawSha256=hashlib.sha256(path.read_bytes()).hexdigest(),startTick=meta['start']['tick'],endTick=meta['end']['tick'],playerStart=meta['start']['player']['transform'],playerEnd=meta['end']['player']['transform'],buses={name:dict(rmsDbfs=db(np.mean(x[:,i*2:i*2+2]**2)),bandRmsDbfs=db(np.mean(band[:,i*2:i*2+2]**2))) for i,name in enumerate(meta['names'])},peakDbfs=20*np.log10(max(peak,1e-12)),truePeakDbtp=20*np.log10(max(tp,1e-12)),clippedSamples=int(np.count_nonzero(abs(x[:,:2])>=.999)),compressorMinDb=min(meta.get('compressorReduction',[0])),cueCounts=dict(cuecounts),errors=meta['end']['audio']['errors'],musicStart=meta['start']['audio']['music']['streamed'],musicEnd=meta['end']['audio']['music']['streamed'])
  captures[level,mode]=dict(x=x,rate=rate,full=full,bp=bp,meta=meta)
  summaries[level,mode]=summary

paired=[]
for level in levels:
 b,a=captures[level,'before'],captures[level,'after']; n=min(len(b['full']),len(a['full']))
 # Match the same wall-clock passages in both captures, avoid walking/firing,
 # and exclude audible voice/SFX. Rank the survivors by MUSIC bus energy only.
 quiet=[]
 for k in range(n):
  t=k*.5
  if 5<=t<26: continue
  if max(np.mean(b['full'][k,6:]),np.mean(a['full'][k,6:]))>10**(-40/10):continue
  quiet.append(k)
 if len(quiet)<2:
  quiet=[k for k in range(n) if k*.5<5 or k*.5>=26]
 quiet=sorted(quiet,key=lambda k:np.mean(b['full'][k,2:4])+np.mean(a['full'][k,2:4]))[:6]
 paired.append(dict(level=level,quietHalfSecondWindows=quiet,quietTotalSeconds=len(quiet)*.5,selection='same 0.5-second windows in both modes, outside movement/combat, lowest music-bus energy with voice/SFX below -40 dBFS when available',before={name:(float(10*np.log10(np.mean(b['bp'][quiet,2*i:2*i+2]))) if np.mean(b['bp'][quiet,2*i:2*i+2]) > 0 else None) for i,name in enumerate(b['meta']['names'])},after={name:(float(10*np.log10(np.mean(a['bp'][quiet,2*i:2*i+2]))) if np.mean(a['bp'][quiet,2*i:2*i+2]) > 0 else None) for i,name in enumerate(a['meta']['names'])}))
report=dict(measurement='48 kHz live AudioContext PCM; 4-16 kHz sixth-order Butterworth RMS; stereo channel mean-square; dBFS; master after limiter, others pre master',captures={f'{level}-{mode}':summary for (level,mode),summary in summaries.items()},quietPassages=paired)
(out/'capture-metrics.json').write_text(json.dumps(report,indent=2)+'\n')

fig,axs=plt.subplots(4,4,figsize=(15,9),sharex=True,sharey=True,layout='constrained')
for row,level in enumerate(levels):
 for col,(mode,bus) in enumerate([('before',0),('after',0),('before',2),('after',2)]):
  c=captures[level,mode];x=c['x'][:,bus*2:bus*2+2];rate=c['rate']
  f,t,p0=signal.spectrogram(x[:,0],rate,nperseg=1024,noverlap=768,scaling='density')
  _,_,p1=signal.spectrogram(x[:,1],rate,nperseg=1024,noverlap=768,scaling='density')
  m=f<=16000; p=10*np.log10((p0+p1)/2+1e-24)
  im=axs[row,col].pcolormesh(t[::4],f[m]/1000,p[m,::4],vmin=-130,vmax=-50,cmap='magma',shading='auto',rasterized=True)
  axs[row,col].axhline(4,color='cyan',lw=.4,alpha=.7)
  if row==0:axs[row,col].set_title(('Before' if mode=='before' else 'After')+' · '+('master' if bus==0 else 'ambience'))
  if col==0:axs[row,col].set_ylabel(level+'\nkHz')
  if row==3:axs[row,col].set_xlabel('Seconds')
  axs[row,col].set_ylim(0,16)
fig.colorbar(im,ax=axs,shrink=.65,label='dBFS/Hz (same scale)')
fig.suptitle('R15: live 30-second level recordings · cyan = 4 kHz · music and event effects retained')
fig.savefig(out/'before-after-spectrograms.png',dpi=110);plt.close(fig)

# Compare the actual starting score alone against the graph. No source processing
# is applied to the game files; FFmpeg decodes directly to memory.
fig,axs=plt.subplots(4,1,figsize=(10,7),sharex=True,sharey=True,layout='constrained')
for row,level in enumerate(levels):
 s=summaries[level,'before']['musicStart'];deck=next(d for d in s['decks'] if d['state']==s['state']);name='score-'+deck['file']+'.webm'
 data=subprocess.check_output(['ffmpeg','-v','error','-i',str(root/'public/assets/audio'/name),'-ss',str(deck['position']),'-t','30','-ac','1','-ar','48000','-f','f32le','-'])
 x=np.frombuffer(data,dtype='<f4');f,t,p=signal.spectrogram(x,48000,nperseg=1024,noverlap=768,scaling='density');m=f<=16000
 im=axs[row].pcolormesh(t[::4],f[m]/1000,10*np.log10(p[m,::4]+1e-24),vmin=-130,vmax=-50,cmap='magma',shading='auto',rasterized=True)
 axs[row].set_ylabel(level+'\nkHz');axs[row].set_title(name,fontsize=9);axs[row].set_ylim(0,16);axs[row].axhline(4,color='cyan',lw=.4)
axs[-1].set_xlabel('Seconds');fig.colorbar(im,ax=axs,shrink=.6,label='dBFS/Hz');fig.suptitle('Starting music recordings alone · identical spectrum scale')
fig.savefig(out/'source-spectrograms.png',dpi=110);plt.close(fig)
print(json.dumps(paired,indent=2))

# Compact, indexed PNGs preserve the measured range at <1 dB colour steps.
from PIL import Image
for name in ['before-after-spectrograms.png', 'source-spectrograms.png']:
 image=Image.open(out/name).convert('RGB').quantize(colors=128)
 image.save(out/name,optimize=True)
