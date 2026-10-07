import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handleMock, removeHandlerMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  removeHandlerMock: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: { handle: handleMock, removeHandler: removeHandlerMock }
}))

import type { Store } from '../persistence'
import {
  getActiveSshAiVaultHostInfo,
  getActiveSshAiVaultHostInfos,
  registerSshHandlers,
  requestActiveSshAiVaultSessionList,
  requestActiveSshAiVaultSessionTitles,
  requestActiveSshSessionSearch,
  resetSshHandlerStateForTests
} from './ssh'

describe('ipc/ssh (local-only stub)', () => {
  beforeEach(() => {
    handleMock.mockClear()
  })

  it('reports no active SSH AI-vault hosts', () => {
    expect(getActiveSshAiVaultHostInfo('t1')).toBeNull()
    expect(getActiveSshAiVaultHostInfos()).toEqual([])
  })

  it('rejects every relay request with the typed unsupported error', async () => {
    const expected = { code: 'unsupported_in_local_only_build' }
    await expect(requestActiveSshSessionSearch('t1', 'm', {})).rejects.toMatchObject(expected)
    await expect(
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the stub ignores its params.
      requestActiveSshAiVaultSessionList('t1', {} as never)
    ).rejects.toMatchObject(expected)
    await expect(
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the stub ignores its params.
      requestActiveSshAiVaultSessionTitles('t1', {} as never)
    ).rejects.toMatchObject(expected)
  })

  it('registers no ipc channels', async () => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the stub never touches the store.
    registerSshHandlers({} as Store, () => null)
    expect(handleMock).not.toHaveBeenCalled()
    await expect(resetSshHandlerStateForTests()).resolves.toBeUndefined()
  })
})
