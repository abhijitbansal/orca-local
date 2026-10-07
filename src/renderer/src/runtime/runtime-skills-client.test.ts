import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SkillDiscoveryResult, SkillDiscoveryTarget } from '../../../shared/skills'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from './runtime-compatibility-test-fixture'
import { discoverSkillsForRuntimeTarget } from './runtime-skills-client'

function discoveryResult(skillName: string): SkillDiscoveryResult {
  return {
    skills: [
      {
        id: 'skill-1',
        name: skillName,
        description: null,
        providers: ['agent-skills'],
        sourceKind: 'home',
        sourceLabel: 'Agent skills home',
        rootPath: '/home/dev/.agents/skills',
        directoryPath: `/home/dev/.agents/skills/${skillName}`,
        skillFilePath: `/home/dev/.agents/skills/${skillName}/SKILL.md`,
        installed: true,
        updatedAt: null
      }
    ],
    sources: [],
    scannedAt: 0
  }
}

const discover = vi.fn<(target?: SkillDiscoveryTarget) => Promise<SkillDiscoveryResult>>()
const runtimeEnvironmentCall = vi.fn()

beforeEach(() => {
  discover.mockReset()
  runtimeEnvironmentCall.mockReset()
  vi.stubGlobal('window', {
    api: {
      skills: { discover },
      runtimeEnvironments: {
        call: (args: RuntimeEnvironmentCallRequest) =>
          createCompatibleRuntimeStatusResponseIfNeeded(args) ?? runtimeEnvironmentCall(args)
      }
    }
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('discoverSkillsForRuntimeTarget', () => {
  it('scans the local host through the skills IPC for a local target', async () => {
    const result = discoveryResult('orchestration')
    discover.mockResolvedValueOnce(result)
    const target: SkillDiscoveryTarget = { runtime: 'host' }

    await expect(discoverSkillsForRuntimeTarget({ kind: 'local' }, target)).resolves.toBe(result)

    expect(discover).toHaveBeenCalledWith(target)
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  // Why: no caller can produce these yet, so the remote params must stay empty
  // rather than shipping a client-host target the server would misread.
  // Why: refresh describes the request, not the client's host. Dropping it would
  // leave an explicit re-check reading the remote host's shared scan instead of
  // its disk, which is exactly what an install-completed refresh must not do.
})
