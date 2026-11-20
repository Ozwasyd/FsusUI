#!/usr/bin/env python3
"""Build exact real Demo once per product, retaining only diagnostic evidence."""
import argparse, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path
from overlay import apply_overlay
from run import DRIVER, HISTORICAL, PRODUCT, need, put, run, sha

SDK = "10.0.401"
DEMO = Path("dotnet/FsusUI.Avalonia.Demo")
PROJECT = DEMO/"FsusUI.Avalonia.Demo.csproj"
SOURCE = DEMO/"RenderPerformanceRunner.cs"
HERE = Path(__file__).resolve().parent

def git(cwd,*args):
    return subprocess.check_output(["git", "-C", str(cwd), *args], timeout=30)

def verify_source(roots):
    for side, root in roots.items():
        need(git(root, "rev-parse", "HEAD").decode().strip()==PRODUCT[side], "wrong product checkout")
        git(root, "diff", "--quiet", "HEAD", "--")
        need(git(root, "show", f"HEAD:{SOURCE}")== (root/SOURCE).read_bytes(), "dirty runner")
        need(sha(root/SOURCE)==(HISTORICAL if side=="A" else DRIVER), "wrong committed runner")

def sdk_host():
    dotnet = shutil.which("dotnet")
    need(dotnet,"dotnet missing")
    output=subprocess.check_output([dotnet,"--list-sdks"], text=True, timeout=15)
    match=re.search(r"^10\.0\.401 \[(.+)\]$",output,re.M)
    need(match,"SDK10.0.401 not installed")
    dotnet=Path(match[1]).parent/"dotnet"
    cli=Path(match[1])/SDK/"dotnet.dll"
    return dotnet, cli

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--baseline",type=Path,required=True)
    p.add_argument("--candidate",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    roots={"A":args.baseline.resolve(),"B":args.candidate.resolve()}
    verify_source(roots)
    dotnet,cli=sdk_host()
    output=args.output.resolve();output.mkdir()
    env=dict(os.environ,DOTNET_CLI_TELEMETRY_OPTOUT="1",AVALONIA_TELEMETRY_OPTOUT="1",RestoreLockedMode="true")
    need(not env.get("CustomAfterMicrosoftCommonTargets"),"unexpected ambient MSBuild target")
    env["PATH"]=str(dotnet.parent)+os.pathsep+env["PATH"]
    fixtures={}
    with tempfile.TemporaryDirectory(prefix="fsus-native-2x2-build-") as directory:
        private=Path(directory)
        adapted=private/"RenderPerformanceRunner.cs"
        adapted.write_bytes(apply_overlay((roots["B"]/SOURCE).read_bytes(), DRIVER))
        targets=HERE/"historical-compile.targets"
        for side, root in roots.items():
            stage=private/side
            compile_manifest=private/"historical-compile.txt"
            version=subprocess.check_output([str(dotnet),str(cli),"--version"],cwd=root,text=True,timeout=30).strip()
            need(version==SDK,"build SDK mismatch")
            build_env=dict(env)
            build_env.update(CustomAfterMicrosoftCommonTargets=str(targets),
                FsusLayoutReadyProject=str(root/PROJECT),FsusLayoutReadyOriginal=str(root/SOURCE),
                FsusLayoutReadyAdapted=str(adapted),FsusLayoutReadyManifest=str(compile_manifest))
            compile_manifest.unlink(missing_ok=True)
            run([str(dotnet),str(cli),"build",str(root/PROJECT),"--configuration","Release",
                "--output",str(stage),"--no-incremental"],build_env,output/f"{side}-build.log",360,cwd=root)
            swaps=";".join(compile_manifest.read_text().strip().splitlines())
            need(swaps=="original=1/0;adapted=0/1","symmetric compile substitution mismatch")
            dll=stage/"FsusUI.Avalonia.Demo.dll"
            binding=output/f"{side}-build-binding.json"
            put(binding,{"kind":"diagnostic-build-only-not-release-binding","productSha":PRODUCT[side],
                "originalDriverSha256":sha(root/SOURCE),"effectiveDriverSha256":DRIVER,"overlaySha256":sha(adapted),
                "demoAssemblySha256":sha(dll),"compileSubstitution":swaps,"sdk":version,
                "historicalCompileTargetsSha256":sha(targets)})
            fixtures[side]={"assembly":str(dll),"binding":str(binding)}
        verify_source(roots)
        inputs=private/"inputs.json"
        put(inputs,fixtures)
        try:
            subprocess.run([sys.executable,str(HERE/"run.py"),"--inputs",str(inputs),
                "--output",str(output/"capture")],env=env, check=True)
        finally:
            verify_source(roots)

if __name__=="__main__":
    main()
