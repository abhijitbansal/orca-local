import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import type { RuntimeSkillCommandHost } from './runtime-skill-command-contract'
import { RuntimeSkillInstallQueries } from './runtime-skill-install-queries'

describe('RuntimeSkillInstallQueries', () => {
  it('uses the account-managed Claude config directory for global discovery', async () => {
    const host: RuntimeSkillCommandHost = {
      getRuntimeId: () => 'runtime-1',
      getUserDataPath: () => '/tmp/orca-runtime-skill-test',
      isPackaged: () => true,
      getSettings: () => ({}),
      listRepos: () => [],
      listFolderWorkspaces: () => [],
      listResolvedWorktrees: async () => [],
      showManagedWorktree: async () => {
        throw new Error('unused')
      },
      getClaudeConfigDirectory: () => '/accounts/claude/managed',
      skillTransactionRecovery: Promise.resolve()
    }

    await expect(
      new RuntimeSkillInstallQueries(host).resolveSkillDiscoveryProviderRoots({
        kind: 'native-host'
      })
    ).resolves.toMatchObject({ claude: join('/accounts/claude/managed', 'skills') })
  })

  it('rejects an SSH destination with skill-install-ssh-dispatch-required instead of dispatching', async () => {
    const host: RuntimeSkillCommandHost = {
      getRuntimeId: () => 'runtime-1',
      getUserDataPath: () => '/tmp/orca-runtime-skill-test',
      isPackaged: () => true,
      getSettings: () => ({}),
      listRepos: () => [],
      listFolderWorkspaces: () => [],
      listResolvedWorktrees: async () => [],
      showManagedWorktree: async () => {
        throw new Error('unused')
      },
      skillTransactionRecovery: Promise.resolve()
    }

    await expect(
      new RuntimeSkillInstallQueries(host).previewSharedSkillInstallRequest({
        package: {
          packageId: 'package-1',
          versionId: 'version-1',
          packageDigest: 'a'.repeat(64),
          archiveSha256: 'b'.repeat(64),
          compressedBytes: 100
        },
        name: 'example',
        destination: { scope: 'global', executionTarget: { kind: 'ssh', connectionId: 'ssh-1' } }
      })
    ).rejects.toThrow('skill-install-ssh-dispatch-required')
  })
})
