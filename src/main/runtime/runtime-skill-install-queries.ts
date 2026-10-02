import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { detectInstalledAgentsWithShellPathHydration } from '../preflight/agent-detection'
import { listManagedSkillInstalls } from '../skills/skill-install-provenance'
import { WslSkillInstallFilesystem } from '../skills/skill-wsl-install-filesystem'
import { nativeSkillInstallFilesystem } from '../skills/skill-install-filesystem'
import {
  previewSharedSkillBundleInstall,
  previewSharedSkillInstall,
  removeSharedSkillInstall
} from '../skills/skill-install-management-service'
import { toLinuxPath } from '../wsl'
import type {
  SkillBundleInstallPreviewRequest,
  SkillInstallPreviewRequest,
  SkillRemoveRequest,
  ManagedSkillInstall
} from './runtime-skill-types'
import { RuntimeSkillInstallCommands } from './runtime-skill-install-commands'

export class RuntimeSkillInstallQueries extends RuntimeSkillInstallCommands {
  async previewSharedSkillInstallRequest(request: SkillInstallPreviewRequest) {
    await this.host.skillTransactionRecovery
    return previewSharedSkillInstall(request, {
      authority: this.authority(),
      stateDirectory: this.userDataPath(),
      detectProviders: detectInstalledAgentsWithShellPathHydration,
      resolveProviderRootOverrides: (destination) => this.roots(destination)
    })
  }
  async previewSharedSkillBundleInstallRequest(request: SkillBundleInstallPreviewRequest) {
    await this.host.skillTransactionRecovery
    return previewSharedSkillBundleInstall(request, {
      authority: this.authority(),
      stateDirectory: this.userDataPath(),
      detectProviders: detectInstalledAgentsWithShellPathHydration,
      resolveProviderRootOverrides: (destination) => this.roots(destination)
    })
  }
  async removeSharedSkillInstallRequest(request: SkillRemoveRequest) {
    await this.host.skillTransactionRecovery
    return removeSharedSkillInstall(request, {
      authority: this.authority(),
      stateDirectory: this.userDataPath(),
      detectProviders: detectInstalledAgentsWithShellPathHydration,
      resolveProviderRootOverrides: (destination) => this.roots(destination)
    })
  }
  async listManagedSkillInstalls(): Promise<ManagedSkillInstall[]> {
    await this.host.skillTransactionRecovery
    const runtimeId = this.host.getRuntimeId()
    // Why Promise.all: the receipt walk and the worktree resolve are independent, and the
    // resolve can take a full scan round-trip on an SSH fleet.
    const [installs, worktrees] = await Promise.all([
      listManagedSkillInstalls(join(this.userDataPath(), 'skill-installs'), {
        observeReceipt: async (receipt) =>
          receipt.wslDistro
            ? new WslSkillInstallFilesystem(receipt.wslDistro, [
                dirname(receipt.canonicalPath)
              ]).observeSkill(receipt.canonicalPath, receipt.fileModes)
            : nativeSkillInstallFilesystem.observeSkill(receipt.canonicalPath, receipt.fileModes)
      }),
      this.host.listResolvedWorktrees()
    ])
    const folders = this.host.listFolderWorkspaces()
    return installs.flatMap((install): ManagedSkillInstall[] => {
      if (install.scope === 'global') {
        return [
          {
            ...install,
            destination: install.destinationIdentity.startsWith(`global:${runtimeId}:wsl:`)
              ? {
                  scope: 'global' as const,
                  executionTarget: {
                    kind: 'wsl' as const,
                    distro: install.destinationIdentity.slice(`global:${runtimeId}:wsl:`.length)
                  }
                }
              : { scope: 'global' as const }
          }
        ]
      }
      const worktree = worktrees.find(
        (candidate) => install.destinationIdentity === `workspace:${runtimeId}:${candidate.id}`
      )
      const folder = folders.find(
        (candidate) => install.destinationIdentity === `workspace:${runtimeId}:${candidate.id}`
      )
      return worktree
        ? [{ ...install, destination: { scope: 'workspace' as const, worktreeId: worktree.id } }]
        : folder
          ? [
              {
                ...install,
                destination: { scope: 'workspace' as const, folderWorkspaceId: folder.id }
              }
            ]
          : []
    })
  }
  async resolveSkillDiscoveryProviderRoots(target: {
    kind: 'native-host' | 'wsl'
    distro?: string
  }) {
    const roots = await this.roots({
      scope: 'global',
      homeDirectory: homedir(),
      ...(target.kind === 'wsl' && target.distro ? { wslDistro: target.distro } : {})
    })
    return target.kind === 'wsl'
      ? Object.fromEntries(
          Object.entries(roots).map(([provider, root]) => [provider, toLinuxPath(root)])
        )
      : roots
  }
}
