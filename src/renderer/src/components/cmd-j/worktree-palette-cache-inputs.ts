import type { IssueCacheEntry, PRCacheEntry } from '@/lib/worktree-palette-document'

export type WorktreePaletteCacheInputs = {
  prCache: Record<string, PRCacheEntry> | null
  issueCache: Record<string, IssueCacheEntry> | null
  hostedReviewCache: null
}

// Why: no forge data is cached any more, so the palette never has review or issue titles to match.
export const EMPTY_WORKTREE_PALETTE_CACHE_INPUTS: WorktreePaletteCacheInputs = Object.freeze({
  prCache: null,
  issueCache: null,
  hostedReviewCache: null
})

export function selectWorktreePaletteCacheInputs(
  _state: unknown,
  _active: boolean
): WorktreePaletteCacheInputs {
  return EMPTY_WORKTREE_PALETTE_CACHE_INPUTS
}
