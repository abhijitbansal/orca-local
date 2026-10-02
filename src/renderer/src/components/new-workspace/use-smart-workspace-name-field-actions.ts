import { useCallback } from 'react'
import type React from 'react'
import {
  applyWorkspaceEmojiSuggestion,
  type WorkspaceEmojiReplacement,
  type WorkspaceEmojiSuggestion
} from '@/lib/workspace-emoji-shortcodes'
import type { RowEntry } from './smart-workspace-name-field-model'
import type { useSmartWorkspaceNameFieldFoundation } from './use-smart-workspace-name-field-foundation'
import type { useSmartWorkspaceNameFieldPresentation } from './use-smart-workspace-name-field-presentation'

type Foundation = ReturnType<typeof useSmartWorkspaceNameFieldFoundation>
type Presentation = ReturnType<typeof useSmartWorkspaceNameFieldPresentation>

function scheduleEmojiInputFocus(
  frameRef: React.RefObject<number | null>,
  inputRef: React.RefObject<HTMLInputElement | null>,
  replacement: WorkspaceEmojiReplacement
): void {
  frameRef.current = requestAnimationFrame(() => {
    frameRef.current = null
    inputRef.current?.focus({ preventScroll: true })
    inputRef.current?.setSelectionRange(replacement.cursor, replacement.cursor)
  })
}

export function useSmartWorkspaceNameFieldActions(
  foundation: Foundation,
  presentation: Presentation
) {
  const {
    onBranchSelect,
    onGitHubItemSelect,
    onGitLabItemSelect,
    onLinearIssueSelect,
    onValueChange,
    setOpen,
    selectedSource,
    setEmojiCursor,
    cancelLocalInputFocusFrame,
    localInputFocusFrameRef,
    localInputRef,
    value
  } = foundation
  const { selectJiraAccount, activeEmojiShortcode } = presentation

  const handleSelect = useCallback(
    (row: RowEntry) => {
      if (row.kind === 'jira-account') {
        selectJiraAccount(row.site.id)
        return
      }
      // Why: held rows remain selectable while the live query leads debounce.
      if (row.kind === 'use-name' || row.kind === 'create-branch') {
        onValueChange(row.name)
      } else if (row.kind === 'github') {
        onGitHubItemSelect(row.item)
      } else if (row.kind === 'gitlab') {
        onGitLabItemSelect?.(row.item)
      } else if (row.kind === 'branch') {
        onBranchSelect(row.refName, row.localBranchName)
      } else if (row.kind === 'jira') {
        // Why: Jira issues can only be selected through an account-bound source context, which no longer exists.
        return
      } else {
        onLinearIssueSelect(row.issue)
      }
      setOpen(false)
    },
    [
      onBranchSelect,
      onGitHubItemSelect,
      onGitLabItemSelect,
      onLinearIssueSelect,
      onValueChange,
      setOpen,
      selectJiraAccount
    ]
  )
  const openSelectedSource = useCallback((): void => {
    if (selectedSource?.url) {
      void window.api.shell.openUrl(selectedSource.url)
    }
  }, [selectedSource?.url])
  const applyEmojiReplacement = useCallback(
    (replacement: WorkspaceEmojiReplacement): void => {
      onValueChange(replacement.value)
      setEmojiCursor(null)
      cancelLocalInputFocusFrame()
      scheduleEmojiInputFocus(localInputFocusFrameRef, localInputRef, replacement)
    },
    [
      cancelLocalInputFocusFrame,
      localInputFocusFrameRef,
      localInputRef,
      onValueChange,
      setEmojiCursor
    ]
  )
  const handleEmojiSelect = useCallback(
    (suggestion: WorkspaceEmojiSuggestion): void => {
      if (!activeEmojiShortcode) {
        return
      }
      applyEmojiReplacement(applyWorkspaceEmojiSuggestion(value, activeEmojiShortcode, suggestion))
    },
    [activeEmojiShortcode, applyEmojiReplacement, value]
  )
  return {
    handleSelect,
    openSelectedSource,
    applyEmojiReplacement,
    handleEmojiSelect
  }
}
