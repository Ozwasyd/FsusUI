/* global module, require */

const { writeFileSync } = require('node:fs')

class VisualAuditRetryReporter {
  results = []

  onTestEnd(test, result) {
    this.results.push({
      durationMs: result.duration,
      parallelIndex: result.parallelIndex,
      retry: result.retry,
      startTime: result.startTime.toISOString(),
      status: result.status,
      title: test.title,
      workerIndex: result.workerIndex,
    })
  }

  onEnd() {
    const output = process.env.FSUS_VISUAL_AUDIT_RETRY_REPORT
    if (!output) {
      throw new Error('FSUS_VISUAL_AUDIT_RETRY_REPORT is required')
    }
    writeFileSync(output, `${JSON.stringify(this.results, null, 2)}\n`)
  }
}

module.exports = VisualAuditRetryReporter
