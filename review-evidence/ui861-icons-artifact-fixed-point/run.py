import subprocess,json,sys,time
from pathlib import Path
out=Path('/workspace/shared/ui861-icons-artifact-fixed-point');name=sys.argv[1];args=sys.argv[2:];start=time.monotonic()
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
with (out/(name+'.log')).open('w') as log:r=subprocess.run(args,stdout=log,stderr=subprocess.STDOUT)
(out/(name+'.json')).write_text(json.dumps({'sourceSha':head,'command':args,'exitCode':r.returncode,'seconds':time.monotonic()-start},indent=2)+'\n')
print(name,'exit',r.returncode)
raise SystemExit(r.returncode)
