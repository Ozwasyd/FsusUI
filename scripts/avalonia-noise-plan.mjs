import assert from 'node:assert/strict'
export const plan = Object.freeze({
  kind: 'diagnostic-only-not-formal-acceptance', samples: 61, warmups: 1, longScrollIterations: 256,
  scenario: 'virtual-list-variable-100k-sustained', limit: .15,
  sequence: ['A1','B1','B2','A2','B3','A3','A4','B4'],
  sameBinaryAdjacentPairs: [['B1','B2'],['A3','A4']],
  crossProductPairs: [['A1','B1'],['A2','B2'],['A3','B3'],['A4','B4']],
  windows: [[0,21],[21,41],[41,61]],
})
export function quantile(values,p) {
  assert.ok(values.length && values.every(v=>Number.isFinite(v)&&v>=0))
  return [...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1]
}
export function describe(raw) {
  assert.equal(raw.Id,plan.scenario)
  assert.equal(raw.RemountPerSample,false)
  assert.equal(raw.LongScroll.Iterations,256)
  const phases=['FrameMs','MeasureArrangeMs','DrawMs','ActionMs','RenderAwaitMs']
  for(const phase of phases) assert.equal(raw[phase].length,61)
  const stats = values=>({p50:quantile(values,.5),p95:quantile(values,.95),max:Math.max(...values)})
  return { phases:Object.fromEntries(phases.map(p=>[p,stats(raw[p])])),
    windows:plan.windows.map(([start,end])=>({start,end,frame:stats(raw.FrameMs.slice(start,end))})),
    top:raw.FrameMs.map((frame,index)=>({index,frame,layout:raw.MeasureArrangeMs[index],draw:raw.DrawMs[index]})).sort((a,b)=>b.frame-a.frame).slice(0,5),
    gcCountsOnlyNotPauseAttribution:raw.Gc }
}
export function controls(arms) {
  return plan.sameBinaryAdjacentPairs.map(([first,second])=>{
    assert.equal(arms[first].assemblySha256,arms[second].assemblySha256,'same-product control binary mismatch')
    const a=arms[first].p95,b=arms[second].p95
    assert.ok(Number.isFinite(a)&&a>0&&Number.isFinite(b)&&b>0)
    return {first,second,forward:b/a,reverse:a/b,within15PercentBothWays:Math.max(a/b,b/a)<=1.15}
  })
}
