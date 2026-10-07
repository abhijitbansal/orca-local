import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PluginKillList } from '../../shared/plugins/plugin-kill-list'
import { PluginKillListService } from './plugin-kill-list-service'
import { PluginKillListStore } from './plugin-kill-list-store'

const roots: string[] = []

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'orca-plugin-kill-list-'))
  roots.push(root)
  return root
}

function killList(date = '2026-07-12T20:00:00Z'): PluginKillList {
  return {
    version: 1,
    generatedAt: date,
    plugins: [{ pluginKey: 'community.unsafe', reason: 'Malware advisory' }]
  }
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('PluginKillListService', () => {
  it('loads cached revocations from the local store', async () => {
    const root = await tempRoot()
    await new PluginKillListStore(root).write(killList())
    const service = new PluginKillListService({ pluginsDataDir: root })

    await service.initialize()

    expect(service.reason('community.unsafe')).toBe('Malware advisory')
    expect(service.find('community.unsafe')).toMatchObject({ reason: 'Malware advisory' })
    expect(service.reason('community.safe')).toBeNull()
  })

  it('starts with no revocations after a corrupt cache', async () => {
    const store = new PluginKillListStore(await tempRoot())
    vi.spyOn(store, 'read').mockRejectedValue(new Error('invalid JSON'))
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const service = new PluginKillListService({ pluginsDataDir: await tempRoot(), store })

    await expect(service.initialize()).resolves.toBeUndefined()
    expect(service.snapshot()).toBeNull()
    expect(warning).toHaveBeenCalledWith(
      '[plugins] ignoring invalid cached plugin safety list:',
      expect.any(Error)
    )
  })
})
