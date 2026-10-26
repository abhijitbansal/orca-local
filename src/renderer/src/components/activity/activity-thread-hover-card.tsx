import React, { useCallback } from 'react'
import { Pencil, StickyNote } from 'lucide-react'
import { HoverCard, HoverCardContent } from '@/components/ui/hover-card'
import { SelectedTextCopyMenu } from '@/components/SelectedTextCopyMenu'
import { translate } from '@/i18n/i18n'
import CommentMarkdown from '../sidebar/CommentMarkdown'
import { DetailHeader, MetadataActionIcon } from '../sidebar/WorktreeCardMetadataControls'
import {
  WorktreeCardDetailSection,
  WorktreeCardDetailSectionContent
} from '../sidebar/WorktreeCardDetailSection'
import { WorktreeCardAutomationDetailSection } from '../sidebar/WorktreeCardAutomationDetailSection'
import { WorktreeCardCliDetailSection } from '../sidebar/WorktreeCardCliDetailSection'
import { WorktreeCardPortsDetails } from '../sidebar/WorktreeCardPorts'
import { WORKTREE_NATIVE_CONTEXT_MENU_ATTR } from '../sidebar/WorktreeContextMenu'
import { useWorktreeCardDetailsHoverControl } from '../sidebar/worktree-card-details-hover-state'
import { useWorktreeCardFoundation } from '../sidebar/use-worktree-card-foundation'
import { useWorktreeCardReviewDetails } from '../sidebar/use-worktree-card-review-details'
import { useWorktreeCardLinkedDetails } from '../sidebar/use-worktree-card-linked-details'
import { useWorktreeCardSecondaryDetails } from '../sidebar/use-worktree-card-secondary-details'
import { useWorkspaceReferenceLinkActions } from '../sidebar/use-workspace-reference-link-actions'
import { LinkActionPopover } from '@/components/link-actions/LinkActionPopover'
import { ActivityThreadHoverCardSummary } from './activity-thread-hover-card-summary'
import { ActivityThreadHoverCardTrigger } from './activity-thread-hover-card-trigger'
import type { AgentPaneThread } from './activity-thread-types'

export type ActivityThreadHoverCardProps = {
  thread: AgentPaneThread
  children: React.ReactElement
  // Keyboard focus only; pointer hover opens on rest (see activity-thread-hover-card-intent).
  openDelay?: number
  closeDelay?: number
  onJumpToWorkspace?: (thread: AgentPaneThread) => void
  canJumpToWorkspace?: boolean
  /** Keeps the preview closed, e.g. while the row's right-click menu covers it. */
  suppressed?: boolean
}

export function ActivityThreadHoverCard({
  thread,
  children,
  openDelay = 200,
  closeDelay = 120,
  onJumpToWorkspace,
  canJumpToWorkspace,
  suppressed = false
}: ActivityThreadHoverCardProps): React.JSX.Element {
  const detailsHoverControl = useWorktreeCardDetailsHoverControl()
  const open = detailsHoverControl.hoverOpen && !suppressed
  const { linkActionRequest, closeLinkActions } = useWorkspaceReferenceLinkActions(
    thread.worktree.id,
    detailsHoverControl.closeHover
  )

  return (
    <HoverCard
      open={open}
      onOpenChange={detailsHoverControl.handleHoverOpenChange}
      openDelay={openDelay}
      closeDelay={closeDelay}
    >
      <span className="contents" onClick={(event) => event.stopPropagation()}>
        <LinkActionPopover request={linkActionRequest} onClose={closeLinkActions} />
      </span>
      <ActivityThreadHoverCardTrigger
        open={open}
        onOpenChange={detailsHoverControl.handleHoverOpenChange}
      >
        {children}
      </ActivityThreadHoverCardTrigger>
      {open ? (
        <ActivityThreadHoverCardContent
          thread={thread}
          detailsHoverControl={detailsHoverControl}
          onJumpToWorkspace={onJumpToWorkspace}
          canJumpToWorkspace={canJumpToWorkspace}
        />
      ) : null}
    </HoverCard>
  )
}

function ActivityThreadHoverCardContent({
  thread,
  detailsHoverControl,
  onJumpToWorkspace,
  canJumpToWorkspace
}: {
  thread: AgentPaneThread
  detailsHoverControl: ReturnType<typeof useWorktreeCardDetailsHoverControl>
  onJumpToWorkspace?: (thread: AgentPaneThread) => void
  canJumpToWorkspace?: boolean
}): React.JSX.Element {
  const { worktree, repo } = thread
  const foundation = useWorktreeCardFoundation({ worktree, repo: repo ?? undefined })
  const review = useWorktreeCardReviewDetails({
    worktree,
    repo: repo ?? undefined,
    settings: foundation.settings,
    projectGroups: foundation.projectGroups,
    cardProps: foundation.cardProps,
    newCardStyle: foundation.newCardStyle
  })
  const linked = useWorktreeCardLinkedDetails({
    worktree,
    newCardStyle: foundation.newCardStyle,
    deleteState: foundation.deleteState,
    branch: review.branch,
    issueEntry: review.issueEntry,
    linearIssueEntry: review.linearIssueEntry,
    linearIssueFallbackEntry: review.linearIssueFallbackEntry,
    prDisplay: review.prDisplay
  })

  const secondary = useWorktreeCardSecondaryDetails({
    worktree,
    showStatus: true,
    showIssue: true,
    showLinearIssue: true,
    showJiraIssue: true,
    showPR: true,
    showAutomation: true,
    showCli: true,
    showComment: true,
    showPorts: true,
    issueDisplay: linked.issueDisplay,
    linearIssueDisplay: linked.linearIssueDisplay,
    jiraIssueDisplay: linked.jiraIssueDisplay,
    newCardStyle: foundation.newCardStyle,
    compactCards: foundation.compactCards,
    cardDetails: foundation.cardDetails,
    agentActivityDisplayMode: foundation.agentActivityDisplayMode,
    workspacePorts: foundation.workspacePorts,
    settings: foundation.settings
  })

  const dismissAndRun = useCallback(
    (handler: ((event: React.MouseEvent) => void) | undefined) => (event: React.MouseEvent) => {
      detailsHoverControl.closeHover()
      handler?.(event)
    },
    [detailsHoverControl]
  )

  return (
    <HoverCardContent
      side="right"
      align="start"
      sideOffset={8}
      className="w-80 max-h-[30rem] overflow-y-auto p-3 text-xs scrollbar-sleek"
      {...{ [WORKTREE_NATIVE_CONTEXT_MENU_ATTR]: '' }}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <SelectedTextCopyMenu className="space-y-3">
        <ActivityThreadHoverCardSummary
          thread={thread}
          settings={foundation.settings}
          onJumpToWorkspace={
            onJumpToWorkspace ? dismissAndRun(() => onJumpToWorkspace(thread)) : undefined
          }
          canJumpToWorkspace={canJumpToWorkspace}
        />

        {/* Automation Provenance */}
        {secondary.metaAutomationProvenance && (
          <WorktreeCardAutomationDetailSection
            provenance={secondary.metaAutomationProvenance}
            onOpenAutomation={
              foundation.handleOpenAutomation
                ? dismissAndRun(foundation.handleOpenAutomation)
                : undefined
            }
            onOpenAutomationRun={
              foundation.handleOpenAutomationRun
                ? dismissAndRun(foundation.handleOpenAutomationRun)
                : undefined
            }
          />
        )}

        {/* CLI Provenance */}
        {secondary.metaCliProvenance && (
          <WorktreeCardCliDetailSection provenance={secondary.metaCliProvenance} />
        )}

        {/* Notes / Comment */}
        {(secondary.hoverComment ?? '').trim().length > 0 && (
          <WorktreeCardDetailSection>
            <DetailHeader
              icon={<StickyNote className="size-3 text-muted-foreground" />}
              label={translate('auto.components.sidebar.WorktreeCardMeta.93cbea12c2', 'Notes')}
              actions={
                <MetadataActionIcon
                  label={translate(
                    'auto.components.sidebar.WorktreeCardMeta.c7fa72ead0',
                    'Edit notes'
                  )}
                  onClick={foundation.handleEditComment}
                >
                  <Pencil className="size-3" />
                </MetadataActionIcon>
              }
            />
            <WorktreeCardDetailSectionContent className="space-y-2">
              <CommentMarkdown
                content={secondary.hoverComment ?? ''}
                className="text-[11.5px] text-foreground break-words leading-normal [&_.comment-md-p]:block [&_.comment-md-p+.comment-md-p]:mt-1"
              />
            </WorktreeCardDetailSectionContent>
          </WorktreeCardDetailSection>
        )}

        {/* Ports */}
        {foundation.workspacePorts.length > 0 && (
          <WorktreeCardPortsDetails ports={foundation.workspacePorts} />
        )}
      </SelectedTextCopyMenu>
    </HoverCardContent>
  )
}
