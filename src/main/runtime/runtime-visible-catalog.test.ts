import { describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../shared/repo-types'

const { visibleRepos } = vi.hoisted(() => ({
  visibleRepos:
    vi.fn<(store: { getRepos: () => Repo[]; getSshTargets: () => unknown[] }) => Repo[]>()
}))
vi.mock('../ssh/orcad-retained-source', () => ({
  visibleRepos,
  visibleProjectGroups: vi.fn(() => []),
  visibleFolderWorkspaces: vi.fn(() => [])
}))

const { runtimeHiddenHostIds, runtimeHiddenRepos, runtimeVisibleRepos } =
  await import('./runtime-visible-catalog')

const sshTarget = { id: 'target-1', label: 'dev', host: 'dev', port: 22, username: 'dev' }
const repo = (id: string, connectionId?: string): Repo => ({
  id,
  ...(connectionId ? { connectionId } : {}),
  path: `/src/${id}`,
  displayName: id,
  badgeColor: '#000',
  addedAt: 0
})
const storeWith = (repos: Repo[], withTargets: boolean) => ({
  getRepos: () => repos,
  ...(withTargets ? { getSshTargets: () => [sshTarget] } : {})
})

describe('runtime visible catalog', () => {
  it('treats a store with no SSH targets (headless orcad) as hiding nothing of its own', () => {
    visibleRepos.mockImplementation((store) => {
      expect(store.getSshTargets()).toEqual([])
      return store.getRepos()
    })
    const store = storeWith([repo('a')], false)
    expect(runtimeVisibleRepos(store)).toHaveLength(1)
    expect(runtimeHiddenRepos(store).size).toBe(0)
  })

  it('lists nothing without a store', () => {
    expect(runtimeVisibleRepos(null)).toEqual([])
    expect(runtimeHiddenRepos(null).size).toBe(0)
  })

  it('keeps a host that still has a visible row', () => {
    visibleRepos.mockImplementation((store) => store.getRepos().filter((r) => r.id !== 'a'))
    const store = storeWith([repo('a', 'target-2'), repo('b', 'target-2')], true)
    expect(runtimeHiddenHostIds(store).size).toBe(0)
  })
})
