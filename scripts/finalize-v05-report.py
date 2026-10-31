#!/usr/bin/env python3
"""Generate factual release reports solely from immutable validated artifacts."""
import hashlib,json,math,os,re,statistics,sys,zipfile
from pathlib import Path

root=Path('delivery')
load=lambda name:json.loads((root/name).read_text())
m,g=load('build-manifest.json'),load('delivery-verification.json')
assert g['status']=='PASS' and g['sourceCommit']==m['sourceCommit']==os.environ['VALIDATED_SOURCE']
assert str(m['workflowRun'])==os.environ['VALIDATED_RUN']
assert m['version']=='0.5.0-experimental' and m['versionCode']==5
assert g['galaxyA51']=='NOT TESTED'
with zipfile.ZipFile(root/'Lightning-F35B-Evidence.zip') as z:
    def read(name):return json.loads(z.read('browser/benchmarks/london-v0.5/'+name+'.json'))
    timing,visual,cpu,flight,geometry=[read(n) for n in ['paired-render','visual-comparison','cpu-paired','endurance','prepared-equivalence']]
    assert timing['status']=='MEASURED' and visual['status']==geometry['status']=='PASS'
    assert timing['sourceCommit']==m['sourceCommit'] and timing['repeats']==3 and timing['secondsPerRun']==10
    assert timing['sources']['after']['sha256']==m['sha256']
    assert timing['sources']['before']['sha256']=='f1f6a9e9b19c0bc8210b5bab4ef91e9b03c854f0b895cda0c965ae6779a45aad'
    assert len(visual['images'])==19 and flight['completed'] and flight['elapsedWallSeconds']>=1200
    assert not flight['assessment']['issues'] and not flight['errors']
    assert cpu['status']=='MEASURED' and geometry['errors']==[]
    assert cpu['environment']['finalSourceSha256']==m['sourceHashes']['src/terrain/london.js']
    assert timing['timingProtocol']=={'name':'bounded-webgl-throughput-v1','maxInFlightSubmissions':2}
    unit=z.read('browser/benchmarks/london-v0.5/unit-tests.tap').decode()
    assert re.search(r'\btests\s+169\b',unit) and re.search(r'\bpass\s+169\b',unit)
    assert 'Project configuration self-test: 10/10 passed' in unit and 'Android metadata/evidence self-test: 29/29 passed' in unit
    assert 'Ran 17 tests' in z.read('browser/benchmarks/london-v0.5/delivery-guard-tests.txt').decode()
    browser=json.loads(z.read('browser/benchmarks/final/browser-tests.json'))
    london=json.loads(z.read('browser/benchmarks/london-v0.3/functional.json'))
    offline=json.loads(z.read('browser/benchmarks/final/offline-file-test.json'))
    lifecycle=json.loads(z.read('browser/benchmarks/next/v05-flight-integrity-'+m['sha256'][:12]+'.json'))
    for report,count in [(browser,9),(london,7),(lifecycle,6)]:
        assert report['status']=='PASS' and sum(c['status']=='PASS' for c in report['checks'])==count
    assert offline['status']=='PASS' and offline['validation']=={'passed':36,'total':36}
    # Small readable metrics file allows independent API review without a local runtime.
    summary={'sourceCommit':m['sourceCommit'],'workflowRun':m['workflowRun'],'htmlSha256':m['sha256'],'apkSha256':g['apkSha256'],
             'environment':timing['environment'],'visual':visual,'geometry':{k:geometry[k] for k in ['status','checked','attributes','bytes']},
             'cpu':[ {k:v for k,v in c.items() if k!='pairs'} for c in cpu['comparisons']],
             'flight':{k:flight.get(k) for k in ['status','elapsedWallSeconds','simulation','frameMs','medianFps','onePercentLowFps','assessment']},
             'scenarios':[]}
    med=lambda a:statistics.median(a) if a else None
    def f(v,d=2):
        return 'unavailable' if v is None or not math.isfinite(v) else format(v,'.'+str(d)+'f')
    def pair(a,b):return f(a)+' → '+f(b)
    lines=[]
    def out(s=''):lines.append(str(s))
    def table(headers,rows):
        esc=lambda v:str(v).replace('|',r'\|').replace('\n',' ')
        out('| '+' | '.join(map(esc,headers))+' |')
        out('| '+' | '.join(['---']*len(headers))+' |')
        for row in rows:out('| '+' | '.join(map(esc,row))+' |')
        out()
    out('# Project Lightning v0.5.0-experimental — validation report');out()
    out('Source: '+m['sourceCommit']+'. Validation: https://github.com/mtt004/F35-flight-simulator/actions/runs/'+str(m['workflowRun'])+'. Review: https://github.com/mtt004/F35-flight-simulator/pull/10.');out()
    out('This experimental build removes repeated CPU geometry work and corrects simulation-time progression. Physical Galaxy A51/Mali FPS and the30FPS target remain NOT TESTED. No intentional reduction of resolution, buildings, imagery, materials, landmarks, shadows, aircraft or atmospheric fidelity was introduced.');out()
    out('## Build identities');out()
    table(['Item','Identity'],[
      ['v0.4 baseline','ca330131115ee983a6457efa33ff513ac34803ad'],
      ['v0.4 HTML SHA-256',timing['sources']['before']['sha256']],['v0.5 HTML SHA-256',m['sha256']],
      ['v0.5 APK SHA-256',g['apkSha256']],['Version / Android code',m['version']+' / '+str(m['versionCode'])],
      ['Engine','Bundled Three.js revision128'],['Browser',timing['environment']],
      ['Android WebView',g['androidRuntime']['webView']],['Signing','Debug; ephemeral CI key. A differently signed installed build may require uninstalling before installation.']])
    out('## Method and limits');out()
    out(timing['method']);out()
    out('Twelve scenes use three alternating10-second pairs in one Chromium process, at identical1152×648 buffers, BALANCED Q1, poses, weather and clock. Nineteen native-size screenshot pairs verify complete scenery, geometry/submission counts and gauge inputs. The two-submission GPU pipeline is a benchmark throughput workload; its interval FPS is not unmodified production-loop or physical display FPS. Nonblocking fence waits and final drains are included in completed throughput. No gl.finish() is used. Software-renderer results cannot establish Mali limits.');out()
    out('## CPU streaming');out()
    out(cpu['environment']['method']);out()
    rows=[]
    for c in cpu['comparisons']:
        ps=c['pairs']
        rows.append([c['name'],pair(med([p['before']['updateWorkMs']['total'] for p in ps]),med([p['after']['updateWorkMs']['total'] for p in ps])),
                     f((c['medianUpdateWorkRatio']-1)*100,1)+'%',pair(med([p['before']['convergenceWallMs'] for p in ps]),med([p['after']['convergenceWallMs'] for p in ps])),
                     f((c['medianProcessCpuRatio']-1)*100,1)+'%'])
    table(['Phase','Synchronous work ms: v0.4 → v0.5','Paired work change','Convergence wall ms: v0.4 → v0.5','Total process CPU change'],rows)
    out('Runtime building-generation batches per route/round: '+str([(r['baseline']['generationCalls'],r['prepared']['generationCalls']) for r in cpu['rounds']])+'. Synchronous work excludes asynchronous completion callbacks; total process CPU includes native gzip and callbacks. Some phases can regress total CPU. These Node VM observations are not FPS or physical-device measurements. Raw paired rounds preserve variability.');out()
    table(['Streaming phase','Median update p95 ms: v0.4 → v0.5','Median update p99 ms','Worst update spike across rounds ms'],[
        [c['name'],pair(med([p['before']['updateWorkMs']['p95'] for p in c['pairs']]),med([p['after']['updateWorkMs']['p95'] for p in c['pairs']])),
         pair(med([p['before']['updateWorkMs']['p99'] for p in c['pairs']]),med([p['after']['updateWorkMs']['p99'] for p in c['pairs']])),
         pair(max(p['before']['updateWorkMs']['max'] for p in c['pairs']),max(p['after']['updateWorkMs']['max'] for p in c['pairs']))] for c in cpu['comparisons']])
    out('## Matched bounded rendering workload');out()
    out('Every arrow is v0.4 → v0.5. Values are medians of the three per-run statistics. Interval FPS/p95/p99 include explicit GPU backpressure. Completed submissions/s includes timed elapsed plus tail drain. GPU medians use valid non-disjoint elapsed queries; skipped/pending/sample counters remain in raw evidence. None of these values is a physical display FPS claim.');out()
    rows=[];memory=[]
    for s in timing['scenarios']:
        if s['settings'].get('captureOnly'):continue
        def stat(label,fn):return med([fn(r) for r in s['runs'][label]])
        def p(fn):return pair(stat('before',fn),stat('after',fn))
        gpu=p(lambda r:r['raw']['gpu']['p50Ms']) if all(r['raw']['gpu']['p50Ms'] is not None for l in ['before','after'] for r in s['runs'][l]) else 'unavailable'
        rows.append([s['name'],p(lambda r:r['medianFps']),p(lambda r:r['onePercentLowFps']),p(lambda r:r['frameMs']['p95']),p(lambda r:r['frameMs']['p99']),p(lambda r:r['cpuSubmissionMs']['p50']),gpu,p(lambda r:r['raw']['completedWebGLSubmissionsPerSecond'])])
        a,b=[s['states'][l] for l in ['before','after']]
        memory.append([s['name'],str(a['renderer']['calls'])+' → '+str(b['renderer']['calls']),str(a['renderer']['triangles'])+' → '+str(b['renderer']['triangles']),
                       pair(a['memory']['geometryAttributeBytes']/1048576,b['memory']['geometryAttributeBytes']/1048576),
                       pair(a['memory']['textureEstimatedRGBABytes']/1048576,b['memory']['textureEstimatedRGBABytes']/1048576),
                       pair(a['memory']['heapBytes']/1048576,b['memory']['heapBytes']/1048576) if a['memory']['heapBytes'] and b['memory']['heapBytes'] else 'unavailable'])
        summary['scenarios'].append({'name':s['name'],'states':s['states'],'paired':s['paired'],'medians':{
            l:{'intervalMedianFps':stat(l,lambda r:r['medianFps']),'onePercentLowFps':stat(l,lambda r:r['onePercentLowFps']),
               'p95Ms':stat(l,lambda r:r['frameMs']['p95']),'p99Ms':stat(l,lambda r:r['frameMs']['p99']),
               'cpuP50Ms':stat(l,lambda r:r['cpuSubmissionMs']['p50']),'completedSubmissionsPerSecond':stat(l,lambda r:r['raw']['completedWebGLSubmissionsPerSecond'])}
            for l in ['before','after']}})
    table(['Scene','Bounded median FPS*','1% low*','p95 ms*','p99 ms*','CPU submit p50 ms','GPU p50 ms','Completed submissions/s'],rows)
    out('Three paired runs provide descriptive ranges, not a narrow confidence interval or a universal speedup claim. Separate instrumented production-loop observations retain inclusive CPU phases and simulation/wall-time progression; their changed simulation progression prevents a controlled active-flight FPS comparison.');out()
    out('### Separate actual-loop CPU observations');out()
    out('These single30-second parked-runway observations execute the unmodified production loop with inclusive function wrappers and optional bounded diagnostics. Main-thread work is a performance.now wall span, including driver waiting, not CPU-core utilisation or GPU execution. Function spans are not additive and are not overhead-corrected. Changed time progression and normal governor behaviour prevent a controlled FPS or CPU speedup claim.');out()
    production=timing['productionLoopObservations']['runs']
    def quantile(values,p):
        values=sorted(values)
        return values[max(0,math.ceil(len(values)*p)-1)] if values else None
    table(['Version','Rendered samples','Elapsed s','CPU work p50 /p95 /max ms','Simulation /wall','Retained debt s','Final buffer /Q'],[
        [label,len(r['frameRows']),f(r['elapsedSeconds']),
         ' / '.join(f(v) for v in [quantile([x['cpuWorkMs'] for x in r['frameRows']],.5),quantile([x['cpuWorkMs'] for x in r['frameRows']],.95),max(x['cpuWorkMs'] for x in r['frameRows'])]),
         f(r['simulationToWallRatio'],4),f(r['debtSeconds'],4),str(r['endState']['drawingBuffer'])+' / '+str(r['endState']['quality'])]
        for label,r in production.items()])
    phases=sorted(set().union(*(r['phaseStatistics'] for r in production.values())))
    table(['Inclusive function span','p50 ms: v0.4 → v0.5','p95 ms: v0.4 → v0.5','Calls /rendered sample: v0.4 → v0.5'],[
        [name,pair(*(production[l]['phaseStatistics'][name]['perPresentedFrameMs']['p50'] for l in ['before','after'])),
         pair(*(production[l]['phaseStatistics'][name]['perPresentedFrameMs']['p95'] for l in ['before','after'])),
         pair(*(production[l]['phaseStatistics'][name]['calls']/len(production[l]['frameRows']) for l in ['before','after']))] for name in phases])
    summary['productionLoopObservations']={label:{k:r[k] for k in ['elapsedSeconds','simulationToWallRatio','debtSeconds','phaseStatistics','gpuBoundary']} for label,r in production.items()}
    table(['Scene','Draw calls','Triangles','Geometry attributes MiB','Estimated texture MiB','Reported JS heap MiB'],memory)
    out('Geometry counts, bytes and submissions match by mandatory assertion. Texture residency is an estimate, not driver allocation. performance.memory can be coarse or cached; repeated identical heap values do not prove zero allocations or absence of leaks. Android PSS, physical GPU memory, thermals and battery remain unavailable.');out()
    out('## Visual and exact geometry checks');out()
    table(['Scene','Whole SSIM','Minimum region SSIM','Changed pixels'],[[i['name'],f(i['ssim'],9),f(min(r['ssim'] for r in i['regions']),9),i['changedPixels']] for i in visual['images']])
    out(str(sum(i['pixelEquivalent'] for i in visual['images']))+' of19 final pairs are pixel-identical. Every pair passes SSIM≥0.995 and every fixed3×3 region≥0.99, without image resizing. Native PNGs and8× amplified differences are in the evidence ZIP. All nine authored landmarks have matched captures. The standalone montage is a resized overview only; it is not used for quantitative scoring.');out()
    out('Geometry verification covers '+str(geometry['checked'])+' meshes, '+str(geometry['attributes'])+' attribute arrays and '+format(geometry['bytes'],',')+' bytes, including merged culling bounds. Positions, normals, UVs, colours and architectural identifiers match the published v0.4 runtime. Generator and source input hashes are pinned.');out()
    out('Independent visual QA on the same HTML hashes verified all38 PNG hashes and manually inspected all19 scenes:17 pairs were exact; one runway aircraft pixel and32 exterior aircraft pixels differed. Minimum SSIM0.9999993189 and regional0.9999936875. No surrounding scenery, landmark, roof, cockpit, night or weather change was observed. The tiny aircraft residual cause is unproven. That earlier1×1-second QA establishes visual evidence, not full timing acceptance or Mali results; final metrics above belong to this acceptance run.');out()
    out('## Sustained flight and clock progression');out()
    out(flight['method']);out()
    samples=flight['samples']
    table(['Observation','Result'],[
      ['Status',flight['status']],['Elapsed wall seconds',flight['elapsedWallSeconds']],['Simulation progression',flight['simulation']],['Issues',flight['assessment']['issues']],
      ['Production RAF median /1% low FPS',str(flight['medianFps'])+' / '+str(flight['onePercentLowFps'])],['Production frame intervals ms',flight['frameMs']],
      ['Geometry object range',str(min(s['geometries'] for s in samples))+'–'+str(max(s['geometries'] for s in samples))],
      ['Texture object range',str(min(s['textures'] for s in samples))+'–'+str(max(s['textures'] for s in samples))],
      ['Observed governor levels',sorted({s['quality'] for s in samples})],
      ['Geographical ranges',{axis:[min(s['globalPosition'][i] for s in samples),max(s['globalPosition'][i] for s in samples)] for i,axis in enumerate(['x','height','z'])}]])
    out('The normal governor is active and the route can leave photographic coverage. This is not20 minutes continuously over dense central London or full-quality FPS acceptance. Finite resource counts and source disposal review limit conclusions to the observation; they do not prove physical-device memory stability.');out()
    out('Separate sequential local20-minute observations on the same cloud Chromium151/SwiftShader host completed without observed flight failures. V0.4 advanced about0.140741 simulated seconds per wall second; v0.5 advanced0.999970, with about2ms retained debt at its final sample. Different trajectories/work and active governors prohibit a controlled FPS speedup claim. Raw local reports, logs and host metadata are included in Lightning-v0.5-Local-Endurance.zip on this release. They are separate from the mandatory CI acceptance observation.');out()
    out('A fixed-step regression verifies ten active wall seconds yield ten simulated seconds at60,30,10 and2FPS once retained debt drains. The120Hz aircraft integrator is unchanged. Nine physics/control/collision/replay functions have retained byte-equivalence evidence.');out()
    out('## Technical changelog and validation');out()
    out('- src/terrain/london.js and prepared-geometry.js: exact prepared attributes, identical LOD0/1 reuse, cached cell coordinates/landmark materials, one active decode, cancellation/reset ownership and complete-mesh replacement. Same collider/source identities and shadow flags.')
    out('- scripts/build-london-geometry.mjs and build-web.mjs: deterministic pinned tile preparation and self-contained embedding. Every output hash and six generator/source hashes are checked. Unquantized Float32 buffers are viewed without another tile merge.')
    out('- src/simulator.js: one London dispatch per frame, retained active physics debt with bounded120-step catch-up, lifecycle clock resets and weather/traffic following executed steps. Camera/effect stability clamps remain.')
    out('- src/terrain/imagery.js: distance/sort/id lookup reuse plus lifecycle counters. Same image source bytes, four-texture ceiling and decode concurrency.')
    out('- src/rendering/london-lighting.js: remove redundant scene-wide material invalidation. Existing map resolution, coverage, cadence and lighting intent remain.')
    out('- src/rendering/diagnostics.js: optional bounded CPU observations; CPU submission is not labelled GPU execution. GPU queues and timer instrumentation are test-only.')
    out('- Android version5, offline build identity, instrumentation runtime records, source/asset checks, paired tests, release gates and reproduction notes are updated consistently.');out()
    out('Passing acceptance includes169 unit tests, configuration10/10, Android metadata/evidence29/29, delivery guards17/17, LiDAR estimator tests, browser9/9, London7 checks including actual keyboard takeoff/context restoration, offline36/36 with zero remote requests, six save/replay lifecycle checks, exhaustive geometry verification, repeated paired/visual checks, full1200-second flight, Android build/lint/archive verification and actual API33 instrumentation. Raw XML and per-suite results are retained; validator tests are distinct from actual installed-device tests.');out()
    out('## Rejected attempts and remaining limits');out()
    out('Rejected evidence is retained for uncontrolled approach recording, inherited external attitude caching, incomplete road warm-up, inherited gauge inputs and the unbounded headless GPU queue. The last queued over60s of software work; the final bounded protocol preserves quality and changes only test scheduling. No short smoke replaces the mandatory3×10s runs.');out()
    out('Prepared tiles add about30.5MB compressed and grow the HTML from46.8MB to88.1MB. Eagerly decoding all222.5MiB of attributes was rejected; there is no decoded cache. Unsupported native decompression retains the original soft-budget generator, which can still stall on a complex polygon. No lossy texture compression, geometry quantisation, new graphics reduction, worker framework or engine migration was adopted.');out()
    out('An inherited external HUD can lag its derived attitude by one120Hz step; rigid pose and integrator are unchanged. Known STOVL/landing qualifications remain disclosed in existing known issues. Galaxy A51 FPS, Mali bottleneck attribution, physical input latency, touch/gyro, PSS, thermals, battery and long-duration phone acceptance are NOT TESTED. The30FPS goal is not accepted from cloud results.');out()
    out('Reproduction: follow docs/v0.5.md and .github/workflows/v05-validation.yml from the delivered source. Restore the exact hash-pinned v0.4 release inputs before building. SHA256SUMS.txt verifies assets; the build manifest pins source files. Browser ZIP contains one offline HTML with the same simulator bytes as the APK.');out()
    (root/'Lightning-v0.5-Performance-Report.md').write_text('\n'.join(lines)+'\n')
    (root/'Lightning-v0.5-Metrics.json').write_text(json.dumps(summary,indent=2)+'\n')
    # API-readable publication evidence, rather than an unverified benchmark claim.
    Path('review-data').mkdir(exist_ok=True)
    Path('review-data/metrics.json').write_text(json.dumps(summary,indent=2)+'\n')
    names=['04-westminster-low','05-tower-bridge','06-shard-city','07-canary-wharf','10-cockpit','11-night-london','12-heavy-weather','15-aircraft-exterior']
    from PIL import Image,ImageDraw
    import io
    sheet=Image.new('RGB',(1152,len(names)*240),(7,10,14));draw=ImageDraw.Draw(sheet)
    for row,name in enumerate(names):
        for col,label in enumerate(['before','after','diff']):
            raw=z.read('browser/screenshots/london-v0.5/'+label+'/'+name+'.png')
            image=Image.open(io.BytesIO(raw)).convert('RGB').resize((384,216))
            sheet.paste(image,(col*384,row*240))
            draw.text((col*384+6,row*240+220),name+' / '+label,fill='white')
    sheet.save(root/'Lightning-v0.5-Visual-Comparisons.png')
print(json.dumps({'status':'REPORTS_GENERATED','sourceCommit':m['sourceCommit'],'visualPairs':len(visual['images']),'pixelEquivalentPairs':sum(i['pixelEquivalent'] for i in visual['images'])}))

