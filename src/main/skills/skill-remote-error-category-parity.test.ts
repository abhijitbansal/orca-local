import { describe, expect, it, vi } from 'vitest'
import type { IPtyProvider } from '../providers/pty-provider-contract'
import {
  SkillInstallFailureCategorySchema,
  type SkillInstallFailure
} from '../../shared/skill-install-failure'
import type { SkillInstallRequest } from '../../shared/skill-install-contract'

import { skillInstallFailureFromError } from './skill-install-operation-error'
import { installSkillOnSshHost } from './skill-ssh-relay-service'

const request: SkillInstallRequest = {
  operationId: 'operation-1',
  package: {
    packageId: 'package-1',
    versionId: 'version-1',
    packageDigest: 'a'.repeat(64),
    archiveSha256: 'b'.repeat(64),
    compressedBytes: 12
  },
  ingress: {
    kind: 'download-grant',
    url: 'https://storage.googleapis.com/bucket/package.tar.gz',
    expiresAt: '2099-01-01T00:00:00.000Z'
  },
  destination: { scope: 'global' }
}

const failures = SkillInstallFailureCategorySchema.options.map(
  (category, index): SkillInstallFailure => ({
    category,
    code: `skill-contract-${category}`,
    retryable: index % 2 === 0
  })
)

async function capturedFailure(promise: Promise<unknown>): Promise<SkillInstallFailure | null> {
  try {
    await promise
    throw new Error('expected-skill-install-failure')
  } catch (error) {
    return skillInstallFailureFromError(error)
  }
}

describe('remote skill failure category parity', () => {
  it.each(failures)('preserves $category across SSH', async (failure) => {
    const requestHostRpc = vi.fn(async (method: string) => {
      if (method === 'relay.status') {
        return { capabilities: ['skills.install.v1'] }
      }
      throw Object.assign(new Error(failure.code), { code: -32000, data: failure })
    })
    const ssh = await capturedFailure(
      installSkillOnSshHost({
        provider: { requestHostRpc } as unknown as IPtyProvider,
        userDataPath: '/state',
        request,
        requireHttps: true
      })
    )

    expect(ssh).toEqual(failure)
  })
})
