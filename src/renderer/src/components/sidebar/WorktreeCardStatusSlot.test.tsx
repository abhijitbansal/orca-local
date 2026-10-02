import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorktreeCardStatusSlot } from './WorktreeCardStatusSlot'

const mocks = vi.hoisted(() => ({
  status: 'active',
  sleeping: false
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <span data-tooltip-root="">{children}</span>,
  TooltipContent: ({ children }: { children: ReactNode }) => (
    <span data-tooltip-content="">{children}</span>
  ),
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock('./use-worktree-activity-status', () => ({
  useWorktreeActivityStatus: () => mocks.status
}))

vi.mock('./use-worktree-sleep-state', () => ({
  useIsSleepingWorktree: () => mocks.sleeping
}))

describe('WorktreeCardStatusSlot', () => {
  beforeEach(() => {
    mocks.status = 'active'
    mocks.sleeping = false
  })

  it('lets the unread bell replace the visual status dot by default', () => {
    const markup = renderToStaticMarkup(
      <WorktreeCardStatusSlot
        worktreeId="wt-1"
        showStatus
        showUnreadAction
        isUnread
        unreadTooltip="Mark as read"
        onPointerDown={vi.fn()}
        onToggleUnread={vi.fn()}
      />
    )

    expect(markup).toContain('aria-label="Mark as read"')
    expect(markup).toContain('Mark as read')
    expect(markup).not.toContain('Active · Mark as read')
    expect(markup).not.toContain('bg-emerald-500')
    expect(markup).toContain('text-amber-500')
  })

  it('overlays an unread badge on the status dot when new card style is on', () => {
    const markup = renderToStaticMarkup(
      <WorktreeCardStatusSlot
        worktreeId="wt-1"
        showStatus
        showUnreadAction
        isUnread
        unreadTooltip="Mark as read"
        onPointerDown={vi.fn()}
        onToggleUnread={vi.fn()}
        newCardStyle
      />
    )

    expect(markup).not.toContain('aria-label="Mark as read"')
    expect(markup).not.toContain('Mark as read')
    expect(markup).toContain('Active · Unread')
    expect(markup).toContain('data-worktree-status-lane-unread=""')
    expect(markup).toContain('data-worktree-unread-alert=""')
    expect(markup).toContain('bg-amber-500')
    expect(markup).toContain('bg-emerald-500')
    expect(markup).not.toContain('lucide-bell')
    expect(markup).not.toContain('text-amber-500')
  })

  it('suppresses the new-card unread badge while unread status is working', () => {
    mocks.status = 'working'
    const markup = renderToStaticMarkup(
      <WorktreeCardStatusSlot
        worktreeId="wt-1"
        showStatus
        showUnreadAction
        isUnread
        unreadTooltip="Mark as read"
        onPointerDown={vi.fn()}
        onToggleUnread={vi.fn()}
        newCardStyle
      />
    )

    expect(markup).toContain('Working · Unread')
    expect(markup).toContain('border-yellow-500')
    expect(markup).not.toContain('data-worktree-status-lane-unread=""')
    expect(markup).not.toContain('data-worktree-unread-alert=""')
    expect(markup).not.toContain('aria-label="Mark as read"')
    expect(markup).not.toContain('lucide-bell')
    expect(markup).not.toContain('text-amber-500')
  })

  it('suppresses the new-card unread badge while unread status is permission', () => {
    mocks.status = 'permission'
    const markup = renderToStaticMarkup(
      <WorktreeCardStatusSlot
        worktreeId="wt-1"
        showStatus
        showUnreadAction
        isUnread
        unreadTooltip="Mark as read"
        onPointerDown={vi.fn()}
        onToggleUnread={vi.fn()}
        newCardStyle
      />
    )

    expect(markup).toContain('Needs permission · Unread')
    expect(markup).toContain('lucide-message-circle-question-mark')
    expect(markup).toContain('text-agent-question')
    expect(markup).not.toContain('data-worktree-status-lane-unread=""')
    expect(markup).not.toContain('data-worktree-unread-alert=""')
    expect(markup).not.toContain('aria-label="Mark as read"')
    expect(markup).not.toContain('lucide-bell')
  })

  it('keeps legacy unread working cards on the unread bell control', () => {
    mocks.status = 'working'
    const markup = renderToStaticMarkup(
      <WorktreeCardStatusSlot
        worktreeId="wt-1"
        showStatus
        showUnreadAction
        isUnread
        unreadTooltip="Mark as read"
        onPointerDown={vi.fn()}
        onToggleUnread={vi.fn()}
      />
    )

    expect(markup).toContain('aria-label="Mark as read"')
    expect(markup).toContain('Mark as read')
    expect(markup).toContain('Working')
    expect(markup).toContain('text-amber-500')
    expect(markup).not.toContain('border-yellow-500')
    expect(markup).not.toContain('data-worktree-unread-alert=""')
  })

  it('shows status in the unread toggle affordance', () => {
    const markup = renderToStaticMarkup(
      <WorktreeCardStatusSlot
        worktreeId="wt-1"
        showStatus
        showUnreadAction
        isUnread={false}
        unreadTooltip="Mark as unread"
        onPointerDown={vi.fn()}
        onToggleUnread={vi.fn()}
      />
    )

    expect(markup).toContain('Active · Mark as unread')
    expect(markup).toContain('bg-emerald-500')
    expect(markup.match(/data-tooltip-root/g)).toHaveLength(1)
  })

  it('keeps sleeping moon distinct from the awake green dot when new card style is on', () => {
    mocks.status = 'done'
    mocks.sleeping = true
    const markup = renderToStaticMarkup(
      <WorktreeCardStatusSlot
        worktreeId="wt-1"
        showStatus
        showUnreadAction={false}
        isUnread={false}
        unreadTooltip="Mark as unread"
        onPointerDown={vi.fn()}
        onToggleUnread={vi.fn()}
        newCardStyle
      />
    )

    expect(markup).toContain('Sleeping')
    expect(markup).toContain('lucide-moon')
    expect(markup).not.toContain('lucide-git-branch')
    expect(markup).not.toContain('bg-emerald-500')
    expect(markup).not.toContain('bg-neutral-500/40')
  })

  it('distinguishes awake branch from sleeping moon when new card style is on', () => {
    mocks.status = 'done'
    const awakeMarkup = renderToStaticMarkup(
      <WorktreeCardStatusSlot
        worktreeId="wt-1"
        showStatus
        showUnreadAction={false}
        isUnread={false}
        unreadTooltip="Mark as unread"
        onPointerDown={vi.fn()}
        onToggleUnread={vi.fn()}
        newCardStyle
        hasBranchIdentity
      />
    )
    expect(awakeMarkup).toContain('Branch')
    expect(awakeMarkup).toContain('lucide-git-branch')
    expect(awakeMarkup).not.toContain('lucide-moon')
    mocks.sleeping = true
    const sleepingMarkup = renderToStaticMarkup(
      <WorktreeCardStatusSlot
        worktreeId="wt-1"
        showStatus
        showUnreadAction={false}
        isUnread={false}
        unreadTooltip="Mark as unread"
        onPointerDown={vi.fn()}
        onToggleUnread={vi.fn()}
        newCardStyle
        hasBranchIdentity
      />
    )
    // Why: sleeping wins over the branch lane, even with an identity present.
    expect(sleepingMarkup).toContain('Sleeping')
    expect(sleepingMarkup).toContain('lucide-moon')
    expect(sleepingMarkup).not.toContain('lucide-git-branch')
  })

  it('shows the green awake dot for quiet done workspaces when new card style is on', () => {
    mocks.status = 'done'
    const markup = renderToStaticMarkup(
      <WorktreeCardStatusSlot
        worktreeId="wt-1"
        showStatus
        showUnreadAction={false}
        isUnread={false}
        unreadTooltip="Mark as unread"
        onPointerDown={vi.fn()}
        onToggleUnread={vi.fn()}
        newCardStyle
      />
    )

    expect(markup).toContain('Done')
    expect(markup).toContain('bg-emerald-500')
    expect(markup).not.toContain('lucide-git-branch')
    expect(markup).not.toContain('lucide-moon')
    expect(markup).toContain('data-tooltip-root')
  })

  it('overlays an unread badge on the sleeping moon in new card style', () => {
    mocks.status = 'done'
    mocks.sleeping = true
    const markup = renderToStaticMarkup(
      <WorktreeCardStatusSlot
        worktreeId="wt-1"
        showStatus
        showUnreadAction
        isUnread
        unreadTooltip="Mark as read"
        onPointerDown={vi.fn()}
        onToggleUnread={vi.fn()}
        newCardStyle
      />
    )

    expect(markup).toContain('Sleeping · Unread')
    expect(markup).toContain('data-worktree-status-lane-unread=""')
    expect(markup).toContain('data-worktree-unread-alert=""')
    expect(markup).not.toContain('Mark as read')
    expect(markup).not.toContain('group/unread')
    expect(markup).not.toContain('cursor-pointer')
    expect(markup).toContain('lucide-moon')
    expect(markup).toContain('bg-amber-500')
    expect(markup).not.toContain('lucide-bell')
    expect(markup).not.toContain('text-amber-500')
    expect(markup).not.toContain('bg-emerald-500')
    expect(markup).not.toContain('data-tooltip-root')
  })
})
