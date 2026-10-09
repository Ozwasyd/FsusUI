from PIL import Image,ImageChops
from pathlib import Path
import numpy as np,hashlib,struct,json,sys
root=Path('/workspace/tablev2-fix/tests/conformance/visual/artifacts/issue-285-table-v2')
actual=Path(sys.argv[1])
results=[]
for p in sorted(root.glob('*.png')):
 q=actual/p.name
 a=np.array(Image.open(p).convert('RGBA'));b=np.array(Image.open(q).convert('RGBA'));mask=np.any(a!=b,axis=2);y,x=np.where(mask)
 delta=np.abs(a.astype('int16')-b.astype('int16'))
 r={'name':p.name,'expectedSize':list(Image.open(p).size),'actualSize':list(Image.open(q).size),'expectedBytes':p.stat().st_size,'actualBytes':q.stat().st_size,'expectedSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'actualSha256':hashlib.sha256(q.read_bytes()).hexdigest(),'differentPixels':int(mask.sum()),'pixels':int(mask.size),'differenceBounds':[int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)] if len(x) else None,'maxChannelDifference':int(delta.max()),'alphaDifferentPixels':int(np.count_nonzero(a[:,:,3]!=b[:,:,3])),'pixelsByYBand':[(lo,hi,int(mask[lo:hi].sum())) for lo,hi in [(0,60),(60,78),(78,114),(114,220),(220,320),(320,420),(420,540)] if lo<a.shape[0]]}
 for key,f in [('expectedChunks',p),('actualChunks',q)]:
  chunks=[];data=f.read_bytes();pos=8
  while pos<len(data):
   n=struct.unpack('>I',data[pos:pos+4])[0];chunks.append([data[pos+4:pos+8].decode(),n]);pos+=12+n
  r[key]=chunks
 results.append(r)
 diff=np.zeros_like(a);diff[:,:,:3]=np.where(mask[:,:,None], [255,0,255], [255,255,255]);diff[:,:,3]=255
 Image.fromarray(diff).save(actual/(p.stem+'-diff.png'))
 print(json.dumps(r))
(actual/'pixel-differences.json').write_text(json.dumps(results,indent=2)+'\n')
