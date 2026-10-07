import { homedir } from 'node:os'
import { getWslHome } from '../wsl'
import { parseWslUncPath } from '../../shared/wsl-paths'
import {
  type ExecutionHostId,
  getRepoExecutionHostId,
  LOCAL_EXECUTION_HOST_ID,
  normalizeExecutionHostId,
  toSshExecutionHostId
} from '../../shared/execution-host'
import { getRepoIdFromWorktreeId } from '../../shared/worktree/id'
import type { SkillInstallDestinationAuthority } from '../skills/skill-install-destinations'
import {
  resolveEnvironmentSkillProviderRoots,
  resolveWslGrokSkillProviderRoot,
  withClaudeSkillProviderRoot
} from '../skills/skill-provider-runtime-roots'
import type { SkillProviderRootOverrides } from './runtime-skill-types'
import type { RuntimeSkillCommandHost } from './runtime-skill-command-surface'

export async function resolveSkillProviderRoots(
  host: RuntimeSkillCommandHost,
  destination: {
    scope: 'global' | 'workspace'
    homeDirectory: string
    workspaceDirectory?: string
    wslDistro?: string
  }
): Promise<SkillProviderRootOverrides> {
  if (destination.scope !== 'global') {
    return {}
  }
  const grok = destination.wslDistro
    ? await resolveWslGrokSkillProviderRoot(destination.wslDistro)
    : null
  const roots = destination.wslDistro
    ? grok
      ? { grok }
      : {}
    : resolveEnvironmentSkillProviderRoots()
  const config = host.getClaudeConfigDirectory?.(
    destination.wslDistro
      ? { runtime: 'wsl', wslDistro: destination.wslDistro }
      : { runtime: 'host' }
  )
  return withClaudeSkillProviderRoot(roots, config)
}

export function folderExecutionHostId(folder: {
  connectionId?: string | null
  executionHostId?: ExecutionHostId | null
}): ExecutionHostId {
  return (
    normalizeExecutionHostId(folder.executionHostId) ??
    (folder.connectionId ? toSshExecutionHostId(folder.connectionId) : LOCAL_EXECUTION_HOST_ID)
  )
}

export function createSkillInstallAuthority(
  host: RuntimeSkillCommandHost
): SkillInstallDestinationAuthority {
  return {
    environmentId: host.getRuntimeId(),
    homeDirectory: homedir(),
    resolveWorktree: async (id) => {
      const repos = host
        .listRepos()
        .filter((candidate) => candidate.id === getRepoIdFromWorktreeId(id))
      const hostIds = new Set(repos.map((repo) => getRepoExecutionHostId(repo)))
      if (hostIds.size > 1) {
        throw new Error('skill-install-workspace-host-ambiguous')
      }
      if (hostIds.size === 1 && !hostIds.has(LOCAL_EXECUTION_HOST_ID)) {
        throw new Error('skill-install-ssh-dispatch-required')
      }
      // Why no catch: swallowing here reports a transient git/IO failure as a missing
      // workspace and loses the real cause.
      const worktree = await host.showManagedWorktree(`id:${id}`)
      if (worktree.id !== id) {
        return null
      }
      const projectRuntime = host.resolveProjectRuntimeForWorktree?.(id)
      return {
        id,
        path: worktree.path,
        ...(projectRuntime?.status === 'resolved' &&
        projectRuntime.runtime?.kind === 'wsl' &&
        projectRuntime.runtime.distro
          ? { wslDistro: projectRuntime.runtime.distro }
          : {})
      }
    },
    resolveFolderWorkspace: async (id) => {
      const workspaces = host.listFolderWorkspaces().filter((candidate) => candidate.id === id)
      if (workspaces.length > 1) {
        throw new Error('skill-install-workspace-host-ambiguous')
      }
      const workspace = workspaces[0]
      if (!workspace) {
        return null
      }
      if (folderExecutionHostId(workspace) !== LOCAL_EXECUTION_HOST_ID) {
        throw new Error('skill-install-ssh-dispatch-required')
      }
      const wsl = parseWslUncPath(workspace.folderPath)
      return { id, path: workspace.folderPath, ...(wsl ? { wslDistro: wsl.distro } : {}) }
    },
    resolveWsl: async (distro) =>
      process.platform === 'win32'
        ? ((homeDirectory) => (homeDirectory ? { homeDirectory } : null))(getWslHome(distro))
        : null
  }
}
