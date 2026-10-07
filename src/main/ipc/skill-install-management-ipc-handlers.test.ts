import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handleMock } = vi.hoisted(() => ({ handleMock: vi.fn() }))

vi.mock('./skill-ipc-main-window', () => ({
  handleMainWindowSkillIpc: (channel: string, handler: unknown) => handleMock(channel, handler)
}))

vi.mock('../wsl', () => ({ listWslDistrosAsync: vi.fn(async () => []) }))

import { registerSkillInstallManagementIpcHandlers } from './skill-install-management-ipc-handlers'

type IpcHandler = (_event: unknown, value: unknown) => Promise<unknown>

describe('skill install management IPC', () => {
  const handlers = new Map<string, IpcHandler>()

  beforeEach(() => {
    handlers.clear()
    handleMock.mockReset()
    handleMock.mockImplementation((channel: string, handler: IpcHandler) => {
      handlers.set(channel, handler)
    })
  })

  it('lists the local managed installs when no environment is named', async () => {
    const listManagedSkillInstalls = vi.fn(async () => [])
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handler only calls listManagedSkillInstalls on this runtime stub.
    registerSkillInstallManagementIpcHandlers({ listManagedSkillInstalls } as never)

    await expect(handlers.get('skills:listManagedInstalls')!(null, undefined)).resolves.toEqual({
      status: 'ok',
      value: []
    })
  })

  it.each([
    ['skills:listManagedInstalls', 'remote-1'],
    ['skills:listWslDistros', 'remote-1'],
    [
      'skills:previewBundleInstall',
      {
        environmentId: 'remote-1',
        package: {
          packageId: 'package-1',
          versionId: 'version-1',
          bundleDigest: 'c'.repeat(64),
          archiveSha256: 'b'.repeat(64),
          compressedBytes: 100
        },
        selectedSkills: [{ id: 'skill-1', name: 'skill-1', digest: 'a'.repeat(64) }],
        destination: { scope: 'global' }
      }
    ]
  ])('fails closed on %s when an environment id is named', async (channel, value) => {
    const runtime = {
      listManagedSkillInstalls: vi.fn(),
      previewSharedSkillBundleInstallRequest: vi.fn()
    }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the handler must never reach this runtime stub for a remote environment.
    registerSkillInstallManagementIpcHandlers(runtime as never)

    await expect(handlers.get(channel)!(null, value)).rejects.toThrow(
      'skill-install-remote-unsupported'
    )
    expect(runtime.listManagedSkillInstalls).not.toHaveBeenCalled()
    expect(runtime.previewSharedSkillBundleInstallRequest).not.toHaveBeenCalled()
  })
})
