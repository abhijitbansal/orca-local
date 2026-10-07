import { describe, expect, it } from 'vitest'
import {
  EMPTY_WORKTREE_PALETTE_CACHE_INPUTS,
  selectWorktreePaletteCacheInputs
} from './worktree-palette-cache-inputs'

describe('selectWorktreePaletteCacheInputs', () => {
  it('returns the shared empty inputs whether or not the palette is visible', () => {
    expect(selectWorktreePaletteCacheInputs({}, false)).toBe(EMPTY_WORKTREE_PALETTE_CACHE_INPUTS)
    expect(selectWorktreePaletteCacheInputs({}, true)).toBe(EMPTY_WORKTREE_PALETTE_CACHE_INPUTS)
    expect(EMPTY_WORKTREE_PALETTE_CACHE_INPUTS).toEqual({
      prCache: null,
      issueCache: null,
      hostedReviewCache: null
    })
  })
})
