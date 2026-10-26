import { translate } from '@/i18n/i18n'
import {
  coerceWorktreeCardVisibleTitle,
  getWorktreeCardTitleDisplay
} from './worktree-card-title-display'
import { useWorkspaceDeleteModifierPressed } from './workspace-delete-quick-action'
import type { WorktreeCardProps } from './worktree-card-model'
import type { useWorktreeCardFoundation } from './use-worktree-card-foundation'
import type { useWorktreeCardReviewDetails } from './use-worktree-card-review-details'

type Foundation = ReturnType<typeof useWorktreeCardFoundation>
type ReviewDetails = ReturnType<typeof useWorktreeCardReviewDetails>

// Local-only stub: no issue-tracker links, so the card title and delete state are all that remain.
export function useWorktreeCardLinkedDetails({
  worktree,
  newCardStyle,
  deleteState,
  branch
}: Pick<WorktreeCardProps, 'worktree'> &
  Pick<Foundation, 'newCardStyle' | 'deleteState'> &
  Pick<ReviewDetails, 'branch'> &
  Record<string, unknown>) {
  const issueDisplay = null
  const linearIssue = null
  const linearIssueDisplay = null
  const jiraIssueDisplay = null
  const cardTitleDisplay = getWorktreeCardTitleDisplay({
    storedDisplayName: worktree.displayName,
    branchName: branch
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
    linearIssue,
    linearIssueDisplay,
    jiraIssueDisplay,
    visibleCardTitle,
    isDeleting,
    isQueuedForDeletion,
    deleteLabel,
    deleteModifierPressed
  }
}
