import type { BranchPrefixStrategy } from '../../shared/ui-chrome-types'
import type { GitAdmissionTier } from '../../shared/rpc-contract/git-admission-tier-params'
import { gitExecFileAsync } from '../git/runner'
import { listWorktrees } from '../git/worktree'
import { computeValidatedBranchName } from '../ipc/worktree-logic'
import { normalizeLocalBranchName } from './runtime-worktree-selection'

export async function resolveCreateBranchName(
  repoPath: string,
  branchNameOverride: string | undefined,
  sanitizedName: string,
  settings: { branchPrefix: string; branchPrefixCustom?: string },
  username: string | null,
  gitOptions: { wslDistro?: string; admissionTier?: GitAdmissionTier } = {}
): Promise<string> {
  if (!branchNameOverride) {
    return computeValidatedBranchName(
      sanitizedName,
      { ...settings, branchPrefix: settings.branchPrefix as BranchPrefixStrategy },
      username
    )
  }
  if (branchNameOverride.startsWith('-')) {
    throw new Error('Branch name must not start with "-"')
  }
  await gitExecFileAsync(['check-ref-format', '--branch', branchNameOverride], {
    cwd: repoPath,
    ...gitOptions
  })
  return branchNameOverride
}

export async function canCheckoutExistingLocalBranch(
  repoPath: string,
  branchName: string,
  baseBranch: string,
  gitOptions: { wslDistro?: string; admissionTier?: GitAdmissionTier } = {}
): Promise<boolean> {
  let localHead = ''
  try {
    const { stdout } = await gitExecFileAsync(
      ['rev-parse', '--verify', '--quiet', `refs/heads/${branchName}^{commit}`],
      { cwd: repoPath, ...gitOptions }
    )
    localHead = stdout.trim()
  } catch {
    return false
  }
  if (normalizeLocalBranchName(baseBranch) !== branchName) {
    if (!localHead) {
      return false
    }
    try {
      const { stdout } = await gitExecFileAsync(
        ['rev-parse', '--verify', '--quiet', `${baseBranch}^{commit}`],
        { cwd: repoPath, ...gitOptions }
      )
      if (stdout.trim() !== localHead) {
        return false
      }
    } catch {
      return false
    }
  }
  const worktrees = await listWorktrees(repoPath, gitOptions)
  return !worktrees.some((worktree) => normalizeLocalBranchName(worktree.branch) === branchName)
}
