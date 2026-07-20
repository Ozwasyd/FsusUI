export interface VisualEvidencePolicy {
  evidence: boolean
  preserveOutput: 'always' | 'failures-only'
  screenshot: 'on' | 'only-on-failure'
  trace: 'on' | 'retain-on-failure'
}

export declare const isVisualEvidenceMode: (env?: NodeJS.ProcessEnv) => boolean
export declare const visualEvidencePolicy: (
  env?: NodeJS.ProcessEnv,
) => VisualEvidencePolicy
export declare function cleanupSuccessfulVisualEvidence(
  env?: NodeJS.ProcessEnv,
  root?: string,
  orchestratedFinal?: boolean,
): Promise<void>
export default function visualEvidenceGlobalTeardown(): Promise<void>
