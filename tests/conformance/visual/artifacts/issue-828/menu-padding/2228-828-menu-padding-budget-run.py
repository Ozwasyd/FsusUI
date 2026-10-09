import subprocess,os,time,urllib.request,json,signal
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
log=open('/tmp/2228-828-menu-padding-budget-preview.log','w')
p=subprocess.Popen(['pnpm','exec','vite','preview','--config','vue/packages/demo-app/vite.config.ts','--outDir',os.path.abspath('.tmp/visual-runtime/demo-dist'),'--host','127.0.0.1','--port','5381','--strictPort'],stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
try:
 ready=False
 for n in range(100):
  if p.poll() is not None:raise RuntimeError('owned native preview refused')
  try:urllib.request.urlopen('http://127.0.0.1:5381',timeout=1);ready=True;break
  except Exception:time.sleep(.1)
 if not ready:raise RuntimeError('owned native preview not ready')
 env=os.environ.copy();env.pop('CI',None);env['LABEL_PORT']='5381'
 steps=[('current-budget',['node','.tmp/issue-828-menu-padding/probe-budget.mjs'])]
 for name,cmd in steps:
  path=f'/tmp/2228-828-menu-padding-{name}-first.log'
  with open(path,'w') as f:q=subprocess.run(cmd,stdout=f,stderr=subprocess.STDOUT,env=env)
  json.dump({'candidate':head,'command':cmd,'exitCode':q.returncode,'log':path},open(path.replace('.log','-result.json'),'w'),indent=2)
  print(name,q.returncode,flush=True)
finally:
 if p.poll() is None:os.killpg(p.pid,signal.SIGTERM);p.wait()
 log.close()
