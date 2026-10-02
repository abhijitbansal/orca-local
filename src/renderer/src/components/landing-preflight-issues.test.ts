import { describe, expect, it } from 'vitest'
import { getLandingPreflightIssues } from './landing-preflight-issues'

describe('landing preflight issues', () => {
  it('reports a missing Git install', () => {
    const issues = getLandingPreflightIssues({ git: { installed: false } })

    expect(issues.map((issue) => issue.id)).toEqual(['git'])
  })

  it('reports nothing when Git is installed', () => {
    expect(getLandingPreflightIssues({ git: { installed: true } })).toEqual([])
  })
})
