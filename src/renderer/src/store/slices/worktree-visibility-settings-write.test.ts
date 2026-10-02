import { expect, it, vi } from 'vitest'
import { createTestStore } from './store-test-helpers'

it('reclassifies worktrees after changing the host visibility default', async () => {
  vi.stubGlobal('window', {
    api: {
      settings: {
        set: vi.fn().mockResolvedValue({ worktreeVisibilityDefaults: { external: 'show' } })
      }
    }
  })
  const store = createTestStore()
  const fetchAllWorktrees = vi.fn().mockResolvedValue(undefined)
  store.setState({ fetchAllWorktrees })

  await store.getState().updateSettings({ worktreeVisibilityDefaults: { external: 'show' } })

  expect(fetchAllWorktrees).toHaveBeenCalledWith({ visibilityOwnerHostId: 'local' })
})
