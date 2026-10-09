const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const root=process.argv[2],source='/workspace/FsusUI-public-declaration-integration',req=createRequire(root+'/package.json'),ts=req('typescript');
assert.equal(ts.version,'6.0.2');assert.equal(req('vue/package.json').version,'3.5.32');
const rows=[];
const fixtures=[['datepicker','public-datepicker-panel-declaration',4],['slider','public-slider-declaration',16],['cascader','public-cascader-declaration',20],['select','public-classic-select-declaration',8]];
for(const [owner,dir]of fixtures)for(const phase of ['positive','negative'])fs.copyFileSync(`${source}/tests/fixtures/${dir}/${phase}.ts`,`${root}/${owner}-${phase}.ts`);
for(const [mode,module,moduleResolution]of [['bundler',ts.ModuleKind.ESNext,ts.ModuleResolutionKind.Bundler],['node16',ts.ModuleKind.Node16,ts.ModuleResolutionKind.Node16]]){
const options={strict:true,skipLibCheck:false,noEmit:true,target:ts.ScriptTarget.ES2022,module,moduleResolution,lib:['lib.es2022.d.ts','lib.dom.d.ts','lib.dom.iterable.d.ts'],types:[],esModuleInterop:true};
for(const [owner,phase,inputs,expected]of [['aggregate','positive',['probe.ts','motion-probe.ts','global-probe.ts'],0],...fixtures.flatMap(([owner,,count])=>[[''+owner,'positive',[owner+'-positive.ts'],0],[''+owner,'negative',[owner+'-negative.ts'],count]])]){
const program=ts.createProgram(inputs.map(f=>root+'/'+f),options);
const diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({code:d.code,file:d.file&&path.relative(root,d.file.fileName),line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:null,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
const local=diagnostics.filter(d=>inputs.includes(d.file)),external=diagnostics.filter(d=>!inputs.includes(d.file));
const status=phase==='positive'?(diagnostics.length===0?'PASS':'FAIL'):(external.length===0&&local.length===expected?'PASS':'FAIL');
rows.push({mode,owner,phase,strict:true,skipLibCheck:false,status,expectedLocalDiagnostics:expected,localDiagnostics:local.length,externalDiagnostics:external.length,diagnostics});
fs.writeFileSync(`${root}/${mode}-${owner}-${phase}-actual.json`,JSON.stringify(rows.at(-1),null,2)+'\n');console.log(mode,owner,phase,status,'local='+local.length,'external='+external.length);
}
}
fs.writeFileSync('/workspace/.setup/public-declaration-component-offers/four-component-strict-installed.json',JSON.stringify({sourceSha:'f4a094f300384185918fc6d4be86e88d9ab9f097',typescript:ts.version,vue:req('vue/package.json').version,originalOwnerFixturesUnmodified:true,diagnosticsNeverFilteredFromCompiler: true,rows},null,2)+'\n');
