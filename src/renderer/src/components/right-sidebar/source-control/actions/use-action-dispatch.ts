import type React from 'react'
import { useCallback } from 'react'
import { shouldForcePushWithLeaseForUpstream } from '../../../../../../shared/git-upstream-status'
import type { DropdownActionKind } from '../../source-control-dropdown-item-types'
import type { SourceControlCommitAction } from '../commit/use-commit-action'
import { handleSourceControlCommitShortcut } from '../commit/commit-shortcut'
import type { SourceControlFileListing } from '../listing/use-file-listing'
import type { SourceControlWorktreeContext } from '../listing/use-worktree-context'
import type { SourceControlConflictAbort } from '../sync/use-conflict-abort'
import type { SourceControlRemoteActionRunner } from '../sync/use-remote-action-runner'
import type { SourceControlActionModel } from './use-action-model'

/**
 * Routes the primary button, the dropdown and the commit shortcut to one shared dispatcher, so
 * every entry point obeys the same handlers.
 */
export function useSourceControlActionDispatch({
  handleAbortMerge,
  handleAbortRebase,
  handleCommit,
  handleStageAllPrimary,
  primaryAction,
  remoteStatus,
  runCompoundCommitAction,
  runRemoteAction
}: {
  handleAbortMerge: SourceControlConflictAbort['handleAbortMerge']
  handleAbortRebase: SourceControlConflictAbort['handleAbortRebase']
  handleCommit: SourceControlCommitAction['handleCommit']
  handleStageAllPrimary: SourceControlFileListing['handleStageAllPrimary']
  primaryAction: SourceControlActionModel['primaryAction']
  remoteStatus: SourceControlWorktreeContext['remoteStatus']
  runCompoundCommitAction: SourceControlRemoteActionRunner['runCompoundCommitAction']
  runRemoteAction: SourceControlRemoteActionRunner['runRemoteAction']
}) {
  // Dispatch primary + dropdown action kinds to their handlers.
  const handleActionInvoke = useCallback(
    (kind: DropdownActionKind): void => {
      switch (kind) {
        case 'commit':
          void handleCommit()
          break
        case 'commit_push':
          void runCompoundCommitAction('push')
          break
        case 'commit_sync':
          void runCompoundCommitAction('sync')
          break
        case 'abort_merge':
          void handleAbortMerge()
          break
        case 'abort_rebase':
          void handleAbortRebase()
          break
        case 'push':
        case 'force_push':
        case 'pull':
        case 'fast_forward':
        case 'sync':
        case 'fetch':
        case 'publish':
        case 'rebase_base':
          void runRemoteAction(kind === 'rebase_base' ? 'rebase' : kind)
          break
        case 'create_pr':
        case 'push_create_pr':
          // Why: no forge integration remains, so review creation is never offered.
          break
      }
    },
    [handleCommit, handleAbortMerge, handleAbortRebase, runCompoundCommitAction, runRemoteAction]
  )

  // Why: 'stage' routes to a primary-only handler since handleActionInvoke is typed to DropdownActionKind (compound commit_* kinds are dropdown-only).
  const handlePrimaryClick = useCallback((): void => {
    switch (primaryAction.kind) {
      case 'stage':
        void handleStageAllPrimary()
        break
      case 'push':
        // Why: primary labels "Force Push" but keeps kind 'push', so invoke the explicit force path when lease force is required.
        handleActionInvoke(
          shouldForcePushWithLeaseForUpstream(remoteStatus) ? 'force_push' : 'push'
        )
        break
      case 'commit':
      case 'pull':
      case 'sync':
      case 'publish':
      case 'create_pr':
        handleActionInvoke(primaryAction.kind)
        break
      case 'create_pr_intent':
        break
    }
  }, [handleActionInvoke, handleStageAllPrimary, primaryAction.kind, remoteStatus])

  const handleSourceControlKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      handleSourceControlCommitShortcut(event, primaryAction, handlePrimaryClick)
    },
    [handlePrimaryClick, primaryAction]
  )

  return {
    handleActionInvoke,
    handlePrimaryClick,
    handleSourceControlKeyDown
  }
}

export type SourceControlActionDispatch = ReturnType<typeof useSourceControlActionDispatch>
