#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import {
  BLOCKER_ISSUE_TITLE,
  reconcileFreshnessReport,
} from './dependency-freshness-blocker-lib.mjs'

function argument(name) {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}

function api(args, options = {}) {
  const output = execFileSync('gh', ['api', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  })
  return output.trim() ? JSON.parse(output) : null
}

function githubClient(repository) {
  const endpoint = `repos/${repository}`
  const listIssuesByTitle = async (title) => {
    const pages = api([
      '--method',
      'GET',
      '--paginate',
      '--slurp',
      `${endpoint}/issues`,
      '-f',
      'state=all',
      '-f',
      'per_page=100',
    ])
    return pages
      .flat()
      .filter((issue) => !issue.pull_request && issue.title === title)
      .map((issue) => ({
        number: issue.number,
        state: issue.state,
        title: issue.title,
        body: issue.body ?? '',
        updatedAt: issue.updated_at,
      }))
  }

  return {
    async assertWritable() {
      api(['--method', 'GET', endpoint])
    },
    listIssuesByTitle,
    async createIssue(fields) {
      return api([
        '--method',
        'POST',
        `${endpoint}/issues`,
        '-f',
        `title=${fields.title}`,
        '-f',
        `body=${fields.body}`,
      ])
    },
    async updateIssue(number, fields) {
      const args = ['--method', 'PATCH', `${endpoint}/issues/${number}`]
      for (const [name, value] of Object.entries(fields)) {
        args.push('-f', `${name}=${value}`)
      }
      return api(args)
    },
    async setPullRequestLabel(number, label, action) {
      if (action === 'add') {
        return api([
          '--method',
          'POST',
          `${endpoint}/issues/${number}/labels`,
          '-f',
          `labels[]=${label}`,
        ])
      }
      execFileSync(
        'gh',
        [
          'api',
          '--method',
          'DELETE',
          `${endpoint}/issues/${number}/labels/${encodeURIComponent(label)}`,
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      )
    },
  }
}

const reportPath = argument('--report')
const repository = argument('--repo') ?? process.env.GITHUB_REPOSITORY
if (!reportPath || !repository) {
  console.error(
    'usage: dependency-freshness-blocker.mjs --report <path> --repo <owner/repo>',
  )
  process.exit(2)
}

try {
  const report = JSON.parse(readFileSync(reportPath, 'utf8'))
  const result = await reconcileFreshnessReport({
    report,
    client: githubClient(repository),
  })
  console.log(
    `[dependency-freshness-blocker] ${result.action} title=${JSON.stringify(BLOCKER_ISSUE_TITLE)} blockers=${result.blockers}`,
  )
} catch (error) {
  console.error(`[dependency-freshness-blocker] FAIL ${error.message}`)
  process.exitCode = 1
}
