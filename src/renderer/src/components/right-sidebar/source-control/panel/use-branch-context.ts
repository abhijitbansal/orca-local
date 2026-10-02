import { useSourceControlBaseRefs } from '../sync/use-base-refs'
import { useSourceControlBranchCompare } from '../sync/use-branch-compare'
import type { SourceControlPanelState } from './use-panel-state'

/**
 * Resolves which refs the active branch is compared against and runs the branch compare — the
 * facts every commit and sync action later reads, before any of them can run.
 */
export function useSourceControlBranchContext(panelState: SourceControlPanelState) {
  const {
    activeGitStatusHead,
    activeRepo,
    activeRepoConnectionId,
    activeRepoExecutionHostId,
    activeRepoId,
    activeRepoRuntimeEnvironmentId,
    activeRepoSettings,
    activeWorktree,
    activeWorktreeId,
    branchName,
    isBranchVisible,
    isFolder,
    remoteStatus,
    settings,
    worktreePath
  } = panelState

  const baseRefs = useSourceControlBaseRefs({
    activeRepoConnectionId,
    activeRepoExecutionHostId,
    activeRepoId,
    activeRepoRuntimeEnvironmentId,
    activeRepoWorktreeBaseRef: activeRepo?.worktreeBaseRef,
    activeWorktreeBaseRef: activeWorktree?.baseRef,
    isBranchVisible,
    isFolder,
    remoteStatus,
    settings
  })
  const { compareBaseRef } = baseRefs
  const branchCompare = useSourceControlBranchCompare({
    activeRepoSettings,
    activeWorktreeId,
    worktreePath,
    compareBaseRef,
    isFolder,
    branchName,
    isBranchVisible,
    activeGitStatusHead,
    remoteStatus
  })

  return { ...baseRefs, ...branchCompare }
}

export type SourceControlBranchContext = ReturnType<typeof useSourceControlBranchContext>
