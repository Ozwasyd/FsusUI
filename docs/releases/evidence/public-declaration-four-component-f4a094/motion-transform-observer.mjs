import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const root='/workspace/FsusUI-public-declaration-integration';
const req=createRequire(root+'/package.json');
const {transformBetterDefine}=await import(pathToFileURL(req.resolve('@vue-macros/better-define/api')).href);
const file=root+'/vue/packages/motion/components/FsuTransition.vue';
const src=await readFile(file,'utf8');
const before=execFileSync('git',['show','2d05f240e5fb04ac0cd602b4ed638ffe00b1859b:vue/packages/motion/components/FsuTransition.vue'],{cwd:root,encoding:'utf8'});
if(src!==before)throw Error('Motion source was changed');
const mode=process.argv[2]||'cold';
const rows=[];
if(mode==='concurrent') {
const glob=req('fast-glob');
const files=await glob('vue/packages/**/*.vue',{cwd:root,absolute:true});
await Promise.all(files.map(async f=>{try {await transformBetterDefine(await readFile(f,'utf8'),f,false);}catch{}}));
}
for(const production of [false,true,false]){
const result=await transformBetterDefine(src,file,production);
rows.push({production,modeLine:result.code.match(/mode: [^\n]+/)?.[0],code:result.code});
}
await writeFile('/workspace/.setup/public-declaration-component-offers/motion-transform-'+mode+'.json',JSON.stringify({sourceIdenticalTo2d:true,node:process.version,betterDefine:'1.11.4',api:'0.13.4',rows},null,2)+'\n');
console.log(rows.map(({production,modeLine})=>({production,modeLine})));
