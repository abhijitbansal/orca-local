import { describe, expect, it, afterEach, vi } from 'vitest'
import { shadowedKeybindingTitles } from './PluginKeybindingConsentPreview'

describe('plugin keybinding consent preview', () => {
  it('names built-in shortcuts shadowed by plugin chords and user overrides', () => {
    expect(shadowedKeybindingTitles('Mod+P', 'darwin')).toContain('Go to File')
    expect(
      shadowedKeybindingTitles('Mod+Alt+T', 'linux', { 'workspace.openBoard': ['Mod+Alt+T'] })
    ).toContain('Toggle Workspace Board')
  })
})

const { rejectAppStoreAccess } = vi.hoisted(() => ({
  rejectAppStoreAccess: vi.fn(() => {
    throw new Error('Pure helper tests must not access the app store')
  })
}))

vi.mock('@/store', () => ({
  useAppStore: Object.assign(rejectAppStoreAccess, {
    getState: rejectAppStoreAccess,
    getInitialState: rejectAppStoreAccess,
    setState: rejectAppStoreAccess,
    subscribe: rejectAppStoreAccess
  })
}))

afterEach(() => {
  expect(rejectAppStoreAccess).not.toHaveBeenCalled()
})
