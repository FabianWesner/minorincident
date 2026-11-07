import subprocess,time,os,signal
from pathlib import Path
pid=int(Path('test-results/final-c/paused-l10.pid').read_text());ls=subprocess.check_output(['ps','-axo','pid=,command='],text=True).splitlines();ps=[int(l.strip().split(None,1)[0])for l in ls if l.strip().split(None,1)[1].startswith('node --import tsx tools/browser-pool/wrapper.ts exclusive node --import tsx/esm tools/qa/accept/.final-c-high-ground-aim.ts')];assert len(ps)==1,ps
try:
 while subprocess.run(['ps','-p',str(ps[0]),'-o','stat='],text=True,capture_output=True).stdout.strip():time.sleep(1)
finally:
 os.kill(pid,signal.SIGCONT);print('Resumed L10 native CLI',pid,flush=True)
