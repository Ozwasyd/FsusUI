import { expect, it } from 'vitest'
import {
  clearFsusRenderPipelineComponentPolicies,
  getFsusRenderPipelineComponentPolicyAuthority,
} from '../vue/render-pipeline-policy'

it('invokes revocation listeners without a private subscription receiver', () => {
  const authority = getFsusRenderPipelineComponentPolicyAuthority()
  const receivers: unknown[] = []
  const release = authority.subscribe(function (this: unknown) {
    receivers.push(this)
  })

  try {
    clearFsusRenderPipelineComponentPolicies()
    expect(receivers).toEqual([undefined])

    release()
    expect(receivers).toEqual([undefined, undefined])

    release()
    clearFsusRenderPipelineComponentPolicies()
    expect(receivers).toEqual([undefined, undefined])
  } finally {
    release()
    clearFsusRenderPipelineComponentPolicies()
  }
})
