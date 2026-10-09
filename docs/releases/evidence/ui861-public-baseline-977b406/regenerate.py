import subprocess,os,json,hashlib,shutil
from pathlib import Path
root=Path('/workspace/FsusUI-ui861-66-baseline-projection');out=Path('/workspace/.setup/ui861-66-baseline-projection')
files=['spec/baselines/vue-current.json','docs/avalonia/vue-public-api-baseline.md','spec/components/contracts/v1/vue-public-contracts.json','spec/components/contracts/v2/contract-v2.json']
for i,f in enumerate(files):shutil.copy2(root/f,out/('before-'+str(i)+Path(f).suffix))
def run(label,command,observe=False):
 env=dict(os.environ)
 if observe:env['NODE_OPTIONS']='--require '+str(out/'observe-inputs.cjs')
 with (out/(label+'.log')).open('w')as log:r=subprocess.run(command,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
 print(label,r.returncode,flush=True);return r.returncode
results={}
results['before']=run('baseline-before-check',['pnpm','run','avalonia:baseline:check'])
for label,script in [('baseline-first','avalonia:baseline'),('v1-first','component-contracts:generate'),('v2-first','contract-v2:generate')]:
 results[label]=run(label,['pnpm','run',script],label=='baseline-first');assert results[label]==0
for i,f in enumerate(files):shutil.copy2(root/f,out/('first-'+str(i)+Path(f).suffix))
first={f:hashlib.sha256((root/f).read_bytes()).hexdigest()for f in files}
for label,script in [('baseline-second','avalonia:baseline'),('v1-second','component-contracts:generate'),('v2-second','contract-v2:generate')]:
 results[label]=run(label,['pnpm','run',script]);assert results[label]==0
second={f:hashlib.sha256((root/f).read_bytes()).hexdigest()for f in files};assert first==second
for label,script in [('baseline-check','avalonia:baseline:check'),('v1-check','component-contracts:check'),('v2-check','contract-v2:check'),('contract-v2-tests','test:contract-v2'),('surface-check','check:update-surface'),('docs-check','check:documentation-architecture')]:
 results[label]=run(label,['pnpm','run',script]);assert results[label]==0
(out/'fixed-point.json').write_text(json.dumps({'sourceSha':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'originalProducersUnchanged':True,'first':first,'second':second,'byteIdentical':first==second,'results':results},indent=2)+'\n')
