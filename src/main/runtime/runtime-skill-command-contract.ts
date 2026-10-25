import type { ExecutionHostId } from '../../shared/execution-host'
import type {
  SkillBundleInstallPreview,
  SkillBundleInstallPreviewRequest
} from '../../shared/skill-bundle-install-contract'
import type {
  BundledSkillExecuteRequest,
  BundledSkillInstallResult,
  BundledSkillPlan,
  BundledSkillPlanRequest
} from '../../shared/bundled-skill-plan'
import type { RuntimeSkillCommands } from './runtime-skill-command-surface'
import type { ManagedSkillInstall } from '../../shared/skill-install-contract'
import type { SkillInstallPreview } from '../../shared/skill-install-contract'
import type { SkillInstallPreviewRequest } from '../../shared/skill-install-contract'
import type { SkillInstallResult } from '../../shared/skill-install-contract'
import type { SkillProviderRootOverrides } from '../skills/skill-provider-destinations'
import type { SkillRemoveRequest } from '../../shared/skill-install-contract'
export type RuntimeSkillCommandSurface = {
  planLocalBundledSkills(request: BundledSkillPlanRequest): Promise<BundledSkillPlan>
  executeLocalBundledSkills(request: BundledSkillExecuteRequest): Promise<BundledSkillInstallResult>
  previewSharedSkillInstallRequest(
    request: SkillInstallPreviewRequest
  ): Promise<SkillInstallPreview>
  previewSharedSkillBundleInstallRequest(
    request: SkillBundleInstallPreviewRequest
  ): Promise<SkillBundleInstallPreview>
  removeSharedSkillInstallRequest(request: SkillRemoveRequest): Promise<SkillInstallResult>
  listManagedSkillInstalls(): Promise<ManagedSkillInstall[]>
  resolveSkillDiscoveryProviderRoots(target: {
    kind: 'native-host' | 'wsl'
    distro?: string
  }): Promise<SkillProviderRootOverrides>
}

export function installRuntimeSkillCommandSurface(
  target: RuntimeSkillCommandSurface,
  commands: RuntimeSkillCommands
): void {
  const targetMethods = target as unknown as Record<string, (...args: never[]) => unknown>
  const ownerMethods = commands as unknown as Record<string, (...args: never[]) => unknown>
  let prototype: object | null = Object.getPrototypeOf(commands)
  while (prototype && prototype !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(prototype)) {
      if (name !== 'constructor') {
        targetMethods[name] = ownerMethods[name]!.bind(commands)
      }
    }
    prototype = Object.getPrototypeOf(prototype)
  }
}

export type RuntimeSkillCommandHost = {
  getRuntimeId(): string
  getUserDataPath(): string
  isPackaged(): boolean
  getSettings(): { agentSkillSharingEnabled?: boolean }
  listRepos(): {
    id: string
    path: string
    connectionId?: string | null
    executionHostId?: ExecutionHostId | null
  }[]
  listFolderWorkspaces(): {
    id: string
    folderPath: string
    connectionId?: string | null
    executionHostId?: ExecutionHostId | null
  }[]
  listResolvedWorktrees(): Promise<{ id: string; path: string; hostId?: ExecutionHostId }[]>
  showManagedWorktree(selector: string): Promise<{ id: string; path: string }>
  resolveProjectRuntimeForWorktree?(
    worktreeId: string
  ): { status: string; runtime?: { kind: string; distro?: string } } | undefined
  getClaudeConfigDirectory?(
    target: { runtime: 'host' } | { runtime: 'wsl'; wslDistro: string }
  ): string | null
  skillTransactionRecovery: Promise<unknown>
}
