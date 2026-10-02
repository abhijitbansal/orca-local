// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorktreeCardDetailsHover } from './WorktreeCardMeta'

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn()
}))

const interactionMocks = vi.hoisted(() => ({
  hoverOpen: false,
  onHoverOpenChange: undefined as ((open: boolean) => void) | undefined,
  reviewMenuOpen: false,
  onReviewMenuOpenChange: undefined as ((open: boolean) => void) | undefined,
  onUnlinkSelect: undefined as (() => void) | undefined
}))

vi.mock('sonner', () => ({
  toast: toastMocks
}))

vi.mock('@/components/ui/hover-card', () => ({
  HoverCard: ({
    children,
    open,
    onOpenChange
  }: {
    children: ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }) => {
    interactionMocks.hoverOpen = open ?? false
    interactionMocks.onHoverOpenChange = onOpenChange
    return <div data-hover-open={open ? 'true' : 'false'}>{children}</div>
  },
  HoverCardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HoverCardTrigger: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children, open }: { children: ReactNode; open?: boolean }) => (
    <div data-tooltip-open={open === false ? 'false' : 'default'}>{children}</div>
  ),
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({
    children,
    open,
    onOpenChange
  }: {
    children: ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }) => {
    interactionMocks.reviewMenuOpen = open ?? false
    interactionMocks.onReviewMenuOpenChange = onOpenChange
    return <div data-review-menu-open={open ? 'true' : 'false'}>{children}</div>
  },
  DropdownMenuTrigger: ({ children }: { children: ReactNode; asChild?: boolean }) => (
    <>{children}</>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: { children: ReactNode; onSelect?: () => void }) => (
    <button type="button" onClick={() => onSelect?.()}>
      {children}
    </button>
  )
}))

describe('WorktreeCardDetailsHover interactions', () => {
  let container: HTMLDivElement
  let root: Root
  const writeClipboardText = vi.fn()

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    interactionMocks.hoverOpen = false
    interactionMocks.reviewMenuOpen = false
    interactionMocks.onHoverOpenChange = undefined
    interactionMocks.onReviewMenuOpenChange = undefined
    interactionMocks.onUnlinkSelect = undefined
    writeClipboardText.mockReset()
    toastMocks.success.mockReset()
    toastMocks.error.mockReset()
  })

  beforeEach(() => {
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        ui: {
          writeClipboardText
        }
      }
    })
    writeClipboardText.mockResolvedValue(undefined)
  })

  function renderEditableHover(onRenameWorkspaceTitle = vi.fn()): ReturnType<typeof vi.fn> {
    container = document.createElement('div')
    root = createRoot(container)
    act(() => {
      root.render(
        <WorktreeCardDetailsHover
          issue={null}
          linearIssue={null}
          review={null}
          comment={null}
          workspaceTitle="Editable hover title"
          onRenameWorkspaceTitle={onRenameWorkspaceTitle}
        >
          <span>Workspace card</span>
        </WorktreeCardDetailsHover>
      )
    })
    return onRenameWorkspaceTitle
  }

  it('keeps the hover mounted while the workspace title is being edited', () => {
    renderEditableHover()

    act(() => {
      interactionMocks.onHoverOpenChange?.(true)
    })
    const title = container.querySelector('[data-worktree-title-inline-rename]')

    act(() => {
      title?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
    })
    const input = container.querySelector('[data-worktree-title-rename-input]')

    expect(input).not.toBeNull()
    expect(input?.className).toContain('bg-input/40')
    expect(input?.className).toContain('rounded-sm')
    expect(input?.className).toContain('selection:bg-[Highlight]')
    expect(input?.className).toContain('focus-visible:ring-[1px]')

    act(() => {
      interactionMocks.onHoverOpenChange?.(false)
    })

    expect(container.querySelector('[data-hover-open]')?.getAttribute('data-hover-open')).toBe(
      'true'
    )

    act(() => {
      input?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      )
    })

    expect(container.querySelector('[data-hover-open]')?.getAttribute('data-hover-open')).toBe(
      'false'
    )
  })

  it('passes a linked issue URL to the embedded-browser action', () => {
    const onOpenIssueInBrowser = vi.fn()
    container = document.createElement('div')
    root = createRoot(container)
    act(() => {
      root.render(
        <WorktreeCardDetailsHover
          issue={{
            number: 5518,
            title: 'Agent monitor issue',
            state: 'open',
            url: 'https://github.com/acme/orca/issues/5518',
            labels: []
          }}
          linearIssue={null}
          review={null}
          comment={null}
          onOpenIssueInBrowser={onOpenIssueInBrowser}
        >
          <span>Linked issue</span>
        </WorktreeCardDetailsHover>
      )
    })

    act(() => {
      interactionMocks.onHoverOpenChange?.(true)
      interactionMocks.onReviewMenuOpenChange?.(true)
    })
    const browserButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Open in Orca browser')
    )

    act(() => {
      browserButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onOpenIssueInBrowser).toHaveBeenCalledWith('https://github.com/acme/orca/issues/5518')
  })
})
