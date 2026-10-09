const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const {execFileSync} = require('node:child_process')
const root = '/workspace/FsusUI-ui861-66-baseline-projection'
const tracked = new Set(execFileSync('git', ['ls-files', '-z'], {cwd:root,encoding:'utf8'}).split('\0').filter(Boolean))
const outputs = new Set(['spec/baselines/vue-current.json','docs/avalonia/vue-public-api-baseline.md'])
const dependencyMetadata = new Set(['vue','@vue/compiler-sfc','@babel/parser','typescript','prettier'].map(name => 'node_modules/'+name+'/package.json'))
const reads = new Map()
const readOriginal = fs.readFileSync
fs.readFileSync = function(...args) {
  const result = readOriginal.apply(this,args)
  if (typeof args[0] === 'string') {
    const relative = path.relative(root,path.resolve(args[0]))
    if (!outputs.has(relative) && (tracked.has(relative) || dependencyMetadata.has(relative))) {
      const bytes = Buffer.isBuffer(result) ? result : Buffer.from(result)
      reads.set(relative,{path:relative,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length})
    }
  }
  return result
}
require('node:module').syncBuiltinESMExports()
process.on('exit',()=>fs.writeFileSync('/workspace/.setup/ui861-66-baseline-projection/observed-inputs-'+process.pid+'.json',JSON.stringify({sourceHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),pid:process.pid,argv:process.argv,observationOnly:true,originalReadArgumentsAndReturnUnchanged:true,inputs:[...reads.values()].sort((a,b)=>a.path.localeCompare(b.path))},null,2)+'\n'))
