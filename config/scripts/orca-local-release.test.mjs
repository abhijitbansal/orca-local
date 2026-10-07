import { describe, expect, it } from 'vitest'
import { formatReleaseNotes, nextReleaseTag } from './orca-local-release.mjs'

describe('nextReleaseTag', () => {
  it('starts at local.1 for a version with no release yet', () => {
    expect(nextReleaseTag('1.4.214', ['v1.4.213-local.3'])).toBe('v1.4.214-local.1')
  })

  it('increments past the highest existing build of the same version', () => {
    expect(
      nextReleaseTag('1.4.214', ['v1.4.214-local.1', 'v1.4.214-local.10', 'v1.4.214-local.2'])
    ).toBe('v1.4.214-local.11')
  })

  it('ignores tags that only share a prefix', () => {
    expect(nextReleaseTag('1.4.21', ['v1.4.214-local.5', 'v1.4.21-local.x'])).toBe(
      'v1.4.21-local.1'
    )
  })
})

describe('formatReleaseNotes', () => {
  const base = {
    tag: 'v1.4.214-local.2',
    repo: 'owner/orca-local',
    commit: 'abcdef1234567890'
  }

  it('lists the commits since the previous release with a compare link', () => {
    const notes = formatReleaseNotes({
      ...base,
      previousTag: 'v1.4.214-local.1',
      commits: [
        { sha: 'abc1234', subject: 'fix: keep tabs' },
        { sha: 'def5678', subject: 'feat: new pane' }
      ]
    })
    expect(notes).toContain('- fix: keep tabs (abc1234)')
    expect(notes).toContain('- feat: new pane (def5678)')
    expect(notes).toContain(
      'https://github.com/owner/orca-local/compare/v1.4.214-local.1...v1.4.214-local.2'
    )
  })

  it('names the download for each Mac and the build commit', () => {
    const notes = formatReleaseNotes({ ...base, previousTag: null, commits: [] })
    expect(notes).toContain('orca-local-macos-arm64.dmg')
    expect(notes).toContain('orca-local-macos-x64.dmg')
    expect(notes).toContain('abcdef1234567890')
    expect(notes).not.toContain('/compare/')
  })

  it('puts a custom summary above the change list', () => {
    const notes = formatReleaseNotes({
      ...base,
      previousTag: null,
      commits: [],
      summary: 'First release.'
    })
    expect(notes.indexOf('First release.')).toBeLessThan(notes.indexOf('## Download'))
  })
})
