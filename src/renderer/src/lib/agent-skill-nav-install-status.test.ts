import { describe, expect, it } from 'vitest'
import type { BundledSkillOp, BundledSkillPlan } from '../../../shared/bundled-skill-plan'
import { planOf, sharedEntry } from '../components/skills/bundled-skill-plan-fixtures.test-support'
import { getAgentSkillNavInstallStatus } from './agent-skill-nav-install-status'

function plan(...skills: [string, BundledSkillOp['kind']][]): BundledSkillPlan {
  return planOf(skills.map(([name, kind]) => sharedEntry(name, kind)))
}

describe('getAgentSkillNavInstallStatus', () => {
  it('keeps loading and missing states ahead of the plan', () => {
    expect(
      getAgentSkillNavInstallStatus({
        name: 'orca-linear',
        installed: true,
        loading: true,
        plan: plan(['orca-linear', 'keep'])
      })
    ).toBe('checking')
    expect(
      getAgentSkillNavInstallStatus({
        name: 'orca-linear',
        installed: false,
        loading: false,
        plan: null
      })
    ).toBe('install')
  })
})
