#!/usr/bin/env python3
"""Prebuilt-only native diagnostic. Does not alter source or publish results."""
import argparse, hashlib, json, math, os, re, signal, shutil, subprocess
from pathlib import Path

PRODUCT = {"A": "f2d929a5d045439c35e93b4771f912ce50ec2337",
           "B": "340712f4049e03e3282ad92f3c0f4d8121bd85d9"}
DRIVER = "38b0401b59a342a9ad8e702a46a0c23f206bce63b99135b1ba63e93552734882"
HISTORICAL = "847ac4385b6fec58b6e8fbf6a9e09289878853e6294936f1ab78fea46aff85e1"
PROTOCOL = "variable-list-layout-ready.v1"
V = "virtual-list-variable-100k"
S = V + "-sustained"
F = "virtual-list-fixed-100k"
SEQUENCE = ("A","B","B","A")
PHASES = ("FrameMs","ActionMs","MeasureArrangeMs","DrawMs","RenderAwaitMs","MountUnmountMs","AllocatedBytes")
COUNTS = ("RealizedVisuals","RealizedContainers","PooledContainers","RetainedMeasurements","LoadedWindows")

def need(ok, message):
    if not ok:
        raise ValueError(message)

def get(p):
    return json.loads(p.read_text())

def sha(p):
    with p.open("rb") as f:
        digest = hashlib.sha256()
        for block in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(block)
        return digest.hexdigest()

def put(p, obj):
    p.write_text(json.dumps(obj, indent=2, allow_nan=False) + "\n")

def cohort():
    return [{"index": n, "product": p, "ids": [F,V,S]}
            for n,p in enumerate(SEQUENCE,1)]

def layout_clock(path, scenario):
    c=get(path)
    need(c["Scenario"]==scenario and c["WallFrequency"]>0, "layout clock metadata")
    need(c["PhaseOrder"]==["start","measure-end","arrange-end","layout-ready-end"],"unexpected clock boundary order")
    stamps=c["Stamps"]
    need(len(stamps)==84,"missing layout stamps")
    tids={t["Tid"] for t in stamps}
    need(len(tids)==1 and next(iter(tids))>0,"UI thread changed")
    frames=[]
    for index in range(21):
        x=stamps[index*4:index*4+4]
        if scenario==F: need(x[2]==x[3],"fixed unexpectedly ran readiness")
        def duration(a,b):
            wall=(b["WallTicks"]-a["WallTicks"])*1000/c["WallFrequency"]
            cpu=(b["CpuNanoseconds"]-a["CpuNanoseconds"])/1e6
            gc=b["Gen2"]-a["Gen2"]
            need(min(wall,cpu,gc)>=0,"nonmonotonic clock/GC count")
            return {"wallMs":wall,"threadCpuMs":cpu,"wallMinusCpuMs":wall-cpu,"gen2CountDelta":gc}
        frames.append({"index":index,"measure":duration(*x[:2]),"arrange":duration(*x[1:3]),
                       "readiness":duration(*x[2:]),"layout":duration(x[0],x[3])})
    return {"tid":next(iter(tids)),"frames":frames}

def pct(x, p):
    return sorted(x)[math.ceil(len(x)*p)-1]

def verify(out, arm):
    s = get(out/"summary.json")
    need(s["SchemaVersion"] == 2 and s["Kind"] == "real-avalonia-render-measurement", "wrong schema")
    need(s["GitSha"] == PRODUCT[arm["product"]] and s["MeasurementProtocol"] == PROTOCOL, "wrong run identity")
    need(s["Profile"] == "quick" and s["Runner"] == {"Warmups":1,"Samples":21,"LongScrollIterations":256,"ScenarioCount":len(arm["ids"])}, "wrong runner parameters")
    env = s["Environment"]
    need(env["DotNet"] == ".NET 10.0.15" and env["RequestedBackend"] == "auto" and env["WindowPlatform"] == "XID" and env["PlatformGraphicsBackend"] == "software-no-platform-graphics", "wrong native environment")
    need([r["Id"] for r in s["Results"]] == arm["ids"], "wrong scenario order")
    need(sorted(x.name for x in (out/"raw").glob("*.raw.json")) == sorted(x+".raw.json" for x in arm["ids"]), "wrong raw files")
    rows = {}
    for row in s["Results"]:
        i = row["Id"]
        raw = get(out/"raw"/(i+".raw.json"))
        need(raw["Id"] == i, "wrong raw id")
        for value in (row,raw):
            need(value["MeasurementProtocol"] == PROTOCOL and value["RemountPerSample"] == (i != S) and value["LongScroll"]["Iterations"] == 256, "wrong raw workload")
        for k in (*PHASES,*COUNTS):
            arr = raw[k]
            need(len(arr)==21 and all(type(x) in (int,float) and math.isfinite(x) and x>=0 for x in arr), f"invalid raw {i} {k}")
            if k in PHASES:
                want={"Samples":21,"P50":pct(arr,.5),"P95":pct(arr,.95),"P99":pct(arr,.99),"Min":min(arr),"Max":max(arr)}
                need(row[k]==want,f"raw mismatch {i} {k}")
        peak = sorted(range(21), key=lambda j: raw["FrameMs"][j], reverse=True)[:4]
        rows[i] = {"phaseStats":{k:row[k] for k in PHASES},"gcCountsOnly":raw["Gc"],
                   "worstFrames":[{"index":j, **{k:raw[k][j] for k in PHASES}} for j in peak]}
    for i in (F,V):
        rows[i]["layoutClock"]=layout_clock(out/"raw"/(i+".layout-clock.json"),i)
    return env,rows

def prebuilt(input_path):
    cfg = get(input_path)
    need(set(cfg)==set(PRODUCT),"provide both A and B")
    resolved={}
    overlay_hashes=set()
    for side, entry in cfg.items():
        dll, binding = (Path(entry[k]).resolve(strict=True) for k in ("assembly","binding"))
        receipt=get(binding)
        need(dll.name=="FsusUI.Avalonia.Demo.dll","use the actual Demo binary")
        need(receipt["productSha"]==PRODUCT[side] and receipt["effectiveDriverSha256"]==DRIVER,"build binding is not exact #1147")
        need(receipt["originalDriverSha256"]==(HISTORICAL if side=="A" else DRIVER),"unexpected original driver")
        need(receipt["compileSubstitution"]=="original=1/0;adapted=0/1","unproven diagnostic driver substitution")
        overlay_hashes.add(receipt["overlaySha256"])
        need(receipt["demoAssemblySha256"]==sha(dll),"assembly hash differs from trusted build binding")
        for ext in (".runtimeconfig.json",".deps.json"):
            need(dll.with_suffix(ext).is_file(),"full Demo deployment required")
        inventory={str(p.relative_to(dll.parent)):sha(p) for p in sorted(dll.parent.rglob("*")) if p.is_file()}
        resolved[side]=(dll,binding,inventory)
    need(len(overlay_hashes)==1 and all(re.fullmatch(r"[0-9a-f]{64}", h) and h!=DRIVER for h in overlay_hashes),"asymmetric overlay")
    return resolved

def run(cmd, env, dest, timeout, cwd=None):
    with dest.open("wb") as log:
        with subprocess.Popen(cmd,env=env,cwd=cwd,stdout=log,stderr=subprocess.STDOUT,start_new_session=True) as proc:
            try:
                code=proc.wait(timeout)
                need(code==0,f"diagnostic exited {code}; see {dest}")
            finally:
                try:
                    os.killpg(proc.pid,signal.SIGTERM)
                    try: proc.wait(5)
                    except subprocess.TimeoutExpired: pass
                    os.killpg(proc.pid,signal.SIGKILL)
                except ProcessLookupError: pass
                proc.wait()

def compare(records):
    result={}
    for scenario in (F,V):
        result[scenario]=[]
        for arm in records:
            row=arm["rows"][scenario]
            f=row["layoutClock"]["frames"]
            peaks=[{**r,"layoutClock":f[r["index"]]} for r in row["worstFrames"]]
            result[scenario].append({"product":arm["product"],"arm":arm["index"],
              "frameP95":row["phaseStats"]["FrameMs"]["P95"],"slowFrameClock":peaks,
              "layoutWallP95":pct([r["layout"]["wallMs"] for r in f],.95),
              "layoutCpuP95":pct([r["layout"]["threadCpuMs"] for r in f],.95)})
    return result

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--plan",action="store_true",help="print fixed order; no file writes or benchmark")
    p.add_argument("--inputs",type=Path,help='JSON {A:{assembly,binding},B:{assembly,binding}}; bindings must be trusted real build outputs')
    p.add_argument("--output",type=Path)
    args=p.parse_args()
    arms=cohort()
    if args.plan:
        print(json.dumps({"products":PRODUCT,"driverSha256":DRIVER,"protocol":PROTOCOL,"arms":arms},indent=2))
        return
    need(args.inputs and args.output,"--inputs and --output required")
    osinfo=Path("/etc/os-release").read_text()
    need(re.search(r"^ID=ubuntu$",osinfo,re.M) and re.search(r'^VERSION_ID="22\.04"$',osinfo,re.M),"requires target Ubuntu22.04")
    dotnet=shutil.which("dotnet"); xvfb=shutil.which("xvfb-run")
    need(dotnet and xvfb,"requires existing dotnet and xvfb-run")
    runtimes=subprocess.check_output([dotnet,"--list-runtimes"],text=True,timeout=10)
    need(re.search(r"^Microsoft.NETCore.App 10\.0\.15 ",runtimes,re.M),"runtime10.0.15 unavailable")
    builds=prebuilt(args.inputs)
    output=args.output.resolve(); output.mkdir()
    manifest={"kind":"diagnostic-only-not-acceptance","products":PRODUCT,"driverSha256":DRIVER,"protocol":PROTOCOL,
              "builds":{k:{"bindingSha256":sha(v[1]),"files":v[2]} for k,v in builds.items()},
              "arms":[],"status":"started"}
    put(output/"manifest.json",manifest)
    env0={k:v for k,v in os.environ.items() if not re.match(r"^(DOTNET_|COMPlus_)(EnableEventPipe|EventPipe.*|DiagnosticPorts)$",k)}
    for k in ("FSUSUI_AVALONIA_MEASUREMENT_PARTITION","FSUSUI_AVALONIA_MEASUREMENT_LAUNCH_ID"):
        env0.pop(k,None)
    observed=None
    try:
        for arm in arms:
            side=arm["product"]
            out=output/f'{arm["index"]:02}-{side}';out.mkdir()
            dll=builds[side][0]
            argv=[xvfb,"-a",dotnet,"exec","--fx-version","10.0.15",str(dll),"--render-performance",
                  "--profile","quick","--warmups","1","--samples","21","--long-scroll-iterations","256",
                  "--backend","auto","--output",str(out/"summary.json"),"--scenario","virtual-list-"]
            run(argv,dict(env0,GITHUB_SHA=PRODUCT[side],FSUSUI_AVALONIA_MEASUREMENT_PROTOCOL=PROTOCOL),out/"run.log",120)
            environment,rows=verify(out,arm)
            need(observed is None or observed==environment,"native environment mismatch")
            observed=environment
            manifest["arms"].append({**arm,"rows":rows,"argv":argv,"files":{str(f.relative_to(out)):sha(f) for f in sorted(out.rglob("*")) if f.is_file()}})
            put(output/"manifest.json",manifest)
        need(prebuilt(args.inputs)==builds,"prebuilt assemblies/dependencies changed")
        manifest.update(status="complete",environment=observed,contrasts=compare(manifest["arms"]))
    except BaseException as exc:
        manifest.update(status="failed",error=str(exc))
        raise
    finally:
        put(output/"manifest.json",manifest)

if __name__=="__main__":
    main()
