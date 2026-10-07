import { describe, expect, it } from 'vitest'
import { gitOptionsForWorktree, gitReadOptionsForWorktree } from './git-runtime-options'

describe('git admission tier plumbing', () => {
  it('preserves tiers through both runtime option constructors', () => {
    expect(
      gitOptionsForWorktree('/repo', { wslDistro: 'Ubuntu', admissionTier: 'interactive' })
    ).toEqual({ cwd: '/repo', wslDistro: 'Ubuntu', admissionTier: 'interactive' })
    expect(
      gitReadOptionsForWorktree('/repo', { wslDistro: 'Ubuntu', admissionTier: 'background' })
    ).toEqual({
      cwd: '/repo',
      wslDistro: 'Ubuntu',
      admissionTier: 'background',
      preferWslDirectGit: true
    })
  })
})
