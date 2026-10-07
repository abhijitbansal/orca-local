import { describe, expect, it } from 'vitest'
import { shadowedKeybindingTitles } from './PluginKeybindingConsentPreview'

describe('plugin keybinding consent preview', () => {
  it('names built-in shortcuts shadowed by plugin chords and user overrides', () => {
    expect(shadowedKeybindingTitles('Mod+P', 'darwin')).toContain('Go to File')
    expect(
      shadowedKeybindingTitles('Mod+Alt+T', 'linux', { 'workspace.openBoard': ['Mod+Alt+T'] })
    ).toContain('Toggle Workspace Board')
  })
})
