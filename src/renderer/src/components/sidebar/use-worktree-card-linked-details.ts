import { translate } from '@/i18n/i18n'
import { getWorktreeCardJiraIssueDisplay } from './worktree-card-jira-issue-display'
import type { WorktreeCardIssueDisplay, WorktreeCardLinearIssueDisplay } from './WorktreeCardMeta'
import {
  coerceWorktreeCardVisibleTitle,
  getWorktreeCardTitleDisplay
} from './worktree-card-title-display'
import { useWorkspaceDeleteModifierPressed } from './workspace-delete-quick-action'
import type { WorktreeCardProps } from './worktree-card-model'
import type { useWorktreeCardFoundation } from './use-worktree-card-foundation'

type Foundation = ReturnType<typeof useWorktreeCardFoundation>

export function useWorktreeCardLinkedDetails({
  worktree,
  newCardStyle,
  deleteState,
  branch
}: Pick<WorktreeCardProps, 'worktree'> &
  Pick<Foundation, 'newCardStyle' | 'deleteState'> & { branch: string }) {
  // Why: no forge or tracker lookup remains, so a linked issue shows only its stored identifier.
  const issueDisplay: WorktreeCardIssueDisplay | null = worktree.linkedIssue
    ? { number: worktree.linkedIssue, title: '' }
    : null
  const linearIssueDisplay: WorktreeCardLinearIssueDisplay | null = worktree.linkedLinearIssue
    ? { identifier: worktree.linkedLinearIssue, title: '' }
    : null
  const jiraIssueDisplay = getWorktreeCardJiraIssueDisplay(worktree)
  const cardTitleDisplay = getWorktreeCardTitleDisplay({
    storedDisplayName: worktree.displayName,
    branchName: branch,
    linearIssueTitle: linearIssueDisplay?.title,
    jiraIssueTitle: jiraIssueDisplay?.title,
    issueTitle: issueDisplay?.title
  })
  const legacyCardTitleDisplay = coerceWorktreeCardVisibleTitle(worktree.displayName)
  const visibleCardTitle = newCardStyle ? cardTitleDisplay : legacyCardTitleDisplay
  const isDeleting = deleteState?.isDeleting ?? false
  const isQueuedForDeletion = deleteState?.phase === 'queued'
  const deleteLabel = isQueuedForDeletion
    ? translate('auto.components.sidebar.WorktreeCard.ef18787206', 'Queued for deletion')
    : translate('auto.components.sidebar.WorktreeCard.691ccfd622', 'Deleting…')
  const deleteModifierPressed = useWorkspaceDeleteModifierPressed()

  return {
    issueDisplay,
    linearIssueDisplay,
    jiraIssueDisplay,
    visibleCardTitle,
    isDeleting,
    isQueuedForDeletion,
    deleteLabel,
    deleteModifierPressed
  }
}
