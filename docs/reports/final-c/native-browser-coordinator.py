import subprocess,time,os,signal
from pathlib import Path
lines=subprocess.check_output(['ps','-axo','pid=,command='],text=True).splitlines();wrappers=[int(l.strip().split(None,1)[0])for l in lines if 'tools/browser-pool/wrapper.ts exclusive node --import tsx/esm tools/qa/accept/.final-c-high-ground-aim.ts' in l and l.strip().split(None,1)[1].startswith('node ')]
assert len(wrappers)==1,wrappers
wrapper=wrappers[0]
def alive(pid):
 s=subprocess.run(['ps','-p',str(pid),'-o','stat='],text=True,capture_output=True).stdout.strip();return bool(s)and not s.startswith('Z')
try:
 while alive(94771):time.sleep(1)
 Path('test-results/final-c/native-paused-for-browser.flag').touch();print('L8 child complete; own native launcher paused; high timing may start.',flush=True)
 while alive(wrapper):time.sleep(1)
finally:
 os.kill(74071,signal.SIGCONT);print('High wrapper terminal; resumed own native launcher for L9.',flush=True)
