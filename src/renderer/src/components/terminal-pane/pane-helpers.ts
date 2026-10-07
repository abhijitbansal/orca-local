import type { PaneManager } from '@/lib/pane-manager/pane-manager'
import { focusPanePreservingOverlays } from '@/lib/pane-manager/pane-overlay-focus'

export function fitPanes(manager: PaneManager): void {
  manager.fitAllPanes()
}

export function focusActivePane(manager: PaneManager): void {
  // Why: tab rename focuses the input on the next frame. A queued terminal
  // layout focus can land in between mount and focus, blurring rename closed.
  if (typeof document !== 'undefined' && document.querySelector('[data-tab-rename-input="true"]')) {
    return
  }
  const activeElement = typeof document === 'undefined' ? null : document.activeElement
  if (shouldPreserveEditableFocus(activeElement)) {
    return
  }
  const panes = manager.getPanes()
  const activePane = manager.getActivePane() ?? panes[0]
  if (activePane) {
    focusPanePreservingOverlays(activePane)
  }
}

export function fitAndFocusPanes(manager: PaneManager): void {
  fitPanes(manager)
  focusActivePane(manager)
}

export function isWindowsUserAgent(
  userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent
): boolean {
  return userAgent.includes('Windows')
}

export function isMacUserAgent(
  userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent
): boolean {
  return userAgent.includes('Mac')
}

export function isLinuxUserAgent(
  userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent
): boolean {
  return !isMacUserAgent(userAgent) && !isWindowsUserAgent(userAgent) && userAgent.includes('Linux')
}

export function shouldPreserveEditableFocus(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) {
    return false
  }
  if (element.classList.contains('xterm-helper-textarea') || element.closest('.xterm')) {
    return false
  }
  // Why: deferred fit/focus work can run after inline rename or settings
  // fields take focus. Layout maintenance must not blur user edits closed.
  return (
    element.isContentEditable ||
    element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.tagName === 'SELECT'
  )
}

// Backticks, `$(`/`${`/`$[` expansions, bash history `!word`, and `"` plus
// PowerShell's curly double quotes (which also close a "..." string).
const WINDOWS_DOUBLE_QUOTE_LIVE_RE = /[`"\u201C\u201D\u201E]|\$[({[]|![^\s=(]/

// Why: escape rules are a property of the *target* shell receiving the path,
// not the client OS. A Windows client dropping onto a Linux SSH worktree must
// produce POSIX-quoted output; passing a userAgent string here coupled escape
// rules to the client and silently misquoted cross-platform SSH drops.
// Returns null when no quoting keeps the path literal in the target shell.
export function shellEscapePath(path: string, targetShell: 'posix' | 'windows'): string | null {
  if (targetShell === 'windows') {
    if (/^[a-zA-Z0-9_./@:\\-]+$/.test(path)) {
      return path
    }
    // Why: the pane may run cmd, PowerShell or Git Bash, and only cmd keeps all of
    // these literal inside double quotes; the others run them as code (CWE-78).
    return WINDOWS_DOUBLE_QUOTE_LIVE_RE.test(path) ? null : `"${path}"`
  }

  if (/^[a-zA-Z0-9_./@:-]+$/.test(path)) {
    return path
  }

  return `'${path.replace(/'/g, "'\\''")}'`
}
