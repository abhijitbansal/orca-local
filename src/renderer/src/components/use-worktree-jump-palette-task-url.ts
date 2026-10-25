import { useRef } from 'react'
import type { WorktreePaletteRequestGuard } from '@/lib/worktree-palette-create-action'

export type CmdJLinearIssuePreview = never
export type CmdJGitHubWorkItemPreview = never

// Local-only: issue and PR URLs are never looked up, so the palette never previews a task link.
export function useWorktreeJumpPaletteTaskUrl({
  createLookupGuard
}: {
  visible: boolean
  createWorktreeName: string
  taskSourceUrl: null
  createLookupGuard: WorktreePaletteRequestGuard
}) {
  const linearLookupRef = useRef<unknown>(null)
  const githubLookupRef = useRef<unknown>(null)
  return {
    linearIssueUrlIntent: null,
    githubUrlLink: null,
    taskUrlCreatePreview: null,
    currentLinearIssuePreview: null,
    currentGitHubWorkItemPreview: null,
    linearLookupRef,
    githubLookupRef,
    showLinearLoadingFeedback: false,
    createLookupGuard
  }
}

export type WorktreeJumpPaletteTaskUrl = ReturnType<typeof useWorktreeJumpPaletteTaskUrl>
