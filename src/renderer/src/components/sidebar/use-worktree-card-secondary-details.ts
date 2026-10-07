import { useCallback } from 'react'
import { toast } from 'sonner'

import { translate } from '@/i18n/i18n'
import { openWorkspaceBrowserTab } from '@/lib/workspace-browser-tab-open'
import { hasWorktreeCardDetails } from './WorktreeCardMeta'
import { usePromptCacheCountdownStartedAt } from './CacheTimer'
import { useWorktreeAgentRows } from './useWorktreeAgentRows'
import type { WorktreeCardProps } from './worktree-card-model'
import type { WorktreeCardPrDisplay } from './worktree-card-pr-display'
import type { useWorktreeCardFoundation } from './use-worktree-card-foundation'
import type { useWorktreeCardLinkedDetails } from './use-worktree-card-linked-details'

type Foundation = ReturnType<typeof useWorktreeCardFoundation>
type LinkedDetails = ReturnType<typeof useWorktreeCardLinkedDetails>

export function useWorktreeCardSecondaryDetails({
  worktree,
  showStatus,
  showIssue,
  showLinearIssue,
  showJiraIssue,
  showPR,
  showAutomation,
  showCli,
  showComment,
  showPorts,
  issueDisplay,
  linearIssueDisplay,
  jiraIssueDisplay,
  cardProps,
  newCardStyle,
  compactCards,
  agentActivityDisplayMode,
  workspacePorts,
  settings
}: Pick<WorktreeCardProps, 'worktree'> &
  Pick<
    Foundation,
    | 'cardProps'
    | 'newCardStyle'
    | 'compactCards'
    | 'agentActivityDisplayMode'
    | 'workspacePorts'
    | 'settings'
  > &
  Pick<LinkedDetails, 'issueDisplay' | 'linearIssueDisplay' | 'jiraIssueDisplay'> & {
    showStatus: boolean
    showIssue: boolean
    showLinearIssue: boolean
    showJiraIssue: boolean
    showPR: boolean
    showAutomation: boolean
    showCli: boolean
    showComment: boolean
    showPorts: boolean
  }) {
  // Why: unread lives in the left status lane, so the Status toggle owns both the dot/PR slot and unread emphasis.
  const showUnreadEmphasis = showStatus && worktree.isUnread
  const hoverIssue = issueDisplay
  const hoverLinearIssue = linearIssueDisplay
  const hoverJiraIssue = jiraIssueDisplay
  // Why: no forge review data is cached any more, so no card carries a PR display.
  const hoverReview: WorktreeCardPrDisplay | null = null
  const statusLaneReview: WorktreeCardPrDisplay | null = null
  const hoverComment = worktree.comment
  const metaIssue = showIssue ? hoverIssue : null
  const metaLinearIssue = showLinearIssue ? hoverLinearIssue : null
  const metaJiraIssue = showJiraIssue ? hoverJiraIssue : null
  const metaReview = showPR ? hoverReview : null
  const metaAutomationProvenance = showAutomation ? worktree.automationProvenance : null
  const metaCliProvenance = showCli ? worktree.cliProvenance : null
  const metaComment = showComment ? hoverComment : null
  const showInlineAgentList = cardProps.includes('inline-agents') && (newCardStyle || !compactCards)
  const compactInlineAgentRows = useWorktreeAgentRows(
    worktree.id,
    showInlineAgentList && agentActivityDisplayMode === 'compact'
  )
  const compactInlineAgentRowsVisible =
    showInlineAgentList &&
    agentActivityDisplayMode === 'compact' &&
    compactInlineAgentRows.length > 0
  const showAggregateCacheTimer = !compactCards && !compactInlineAgentRowsVisible
  const openLinkedUrlInBrowser = useCallback(
    (url: string): void => {
      void openWorkspaceBrowserTab({
        workspaceId: worktree.id,
        url,
        intent: { kind: 'url' }
      }).catch((error: unknown) => {
        toast.error(
          error instanceof Error
            ? error.message
            : translate('auto.lib.workspace.browser.tab.open.urlFailed', 'Unable to open URL.')
        )
      })
    },
    [worktree.id]
  )
  const handleOpenIssueInBrowser = useCallback(
    (url: string): void => {
      openLinkedUrlInBrowser(url)
    },
    [openLinkedUrlInBrowser]
  )
  const hasDetails = hasWorktreeCardDetails({
    issue: metaIssue,
    linearIssue: metaLinearIssue,
    jiraIssue: metaJiraIssue,
    review: newCardStyle ? null : metaReview,
    comment: metaComment,
    automationProvenance: metaAutomationProvenance,
    cliProvenance: metaCliProvenance
  })
  const hasPorts = showPorts && workspacePorts.length > 0
  const cacheStartedAt = usePromptCacheCountdownStartedAt(worktree.id, showAggregateCacheTimer)
  // Why: derived from the settings the card already subscribes to — a third store
  // subscription for this one field costs a listener per card on every store write.
  const cacheTtlMs = showAggregateCacheTimer ? (settings?.promptCacheTtlMs ?? 0) : 0

  return {
    showUnreadEmphasis,
    hoverIssue,
    hoverLinearIssue,
    hoverJiraIssue,
    hoverReview,
    statusLaneReview,
    hoverComment,
    metaIssue,
    metaLinearIssue,
    metaJiraIssue,
    metaReview,
    metaAutomationProvenance,
    metaCliProvenance,
    metaComment,
    showInlineAgentList,
    compactInlineAgentRows,
    handleOpenIssueInBrowser,
    hasDetails,
    hasPorts,
    cacheStartedAt,
    cacheTtlMs
  }
}
