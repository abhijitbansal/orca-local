import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkRuntimeHooks,
  inspectRuntimeSetupScriptImports,
  readRuntimeIssueCommand,
  writeRuntimeIssueCommand
} from './runtime-hooks-client'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from './runtime-compatibility-test-fixture'

const runtimeEnvironmentCall = vi.fn()
const runtimeEnvironmentTransportCall = vi.fn()
const hooksCheck = vi.fn()
const hooksInspectSetupScriptImports = vi.fn()
const hooksReadIssueCommand = vi.fn()
const hooksWriteIssueCommand = vi.fn()

beforeEach(() => {
  runtimeEnvironmentCall.mockReset()
  runtimeEnvironmentTransportCall.mockReset()
  hooksCheck.mockReset()
  hooksInspectSetupScriptImports.mockReset()
  hooksReadIssueCommand.mockReset()
  hooksWriteIssueCommand.mockReset()
  runtimeEnvironmentTransportCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
    return createCompatibleRuntimeStatusResponseIfNeeded(args) ?? runtimeEnvironmentCall(args)
  })
  vi.stubGlobal('window', {
    api: {
      runtimeEnvironments: { call: runtimeEnvironmentTransportCall },
      hooks: {
        check: hooksCheck,
        inspectSetupScriptImports: hooksInspectSetupScriptImports,
        readIssueCommand: hooksReadIssueCommand,
        writeIssueCommand: hooksWriteIssueCommand
      }
    }
  })
})

describe('runtime hooks client', () => {
  it('uses local hook IPC when no runtime environment is active', async () => {
    hooksCheck.mockResolvedValue({ hasHooks: false, hooks: null, mayNeedUpdate: false })
    hooksInspectSetupScriptImports.mockResolvedValue([])
    hooksReadIssueCommand.mockResolvedValue({
      localContent: null,
      sharedContent: null,
      effectiveContent: null,
      localFilePath: '',
      source: 'none'
    })

    await checkRuntimeHooks({ activeRuntimeEnvironmentId: null }, 'repo-1')
    await inspectRuntimeSetupScriptImports({ activeRuntimeEnvironmentId: null }, 'repo-1')
    await readRuntimeIssueCommand({ activeRuntimeEnvironmentId: null }, 'repo-1')
    await writeRuntimeIssueCommand({ activeRuntimeEnvironmentId: null }, 'repo-1', 'Fix it')

    expect(hooksCheck).toHaveBeenCalledWith({ repoId: 'repo-1' })
    expect(hooksInspectSetupScriptImports).toHaveBeenCalledWith({ repoId: 'repo-1' })
    expect(hooksReadIssueCommand).toHaveBeenCalledWith({ repoId: 'repo-1' })
    expect(hooksWriteIssueCommand).toHaveBeenCalledWith({ repoId: 'repo-1', content: 'Fix it' })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  it('forwards an explicit SSH host to local hook IPC', async () => {
    hooksCheck.mockResolvedValue({ hasHooks: false, hooks: null, mayNeedUpdate: false })
    hooksInspectSetupScriptImports.mockResolvedValue([])
    hooksReadIssueCommand.mockResolvedValue({
      localContent: null,
      sharedContent: null,
      effectiveContent: null,
      localFilePath: '',
      source: 'none'
    })

    await checkRuntimeHooks(
      { activeRuntimeEnvironmentId: 'focused-elsewhere' },
      'same-repo',
      'ssh:server'
    )
    await inspectRuntimeSetupScriptImports(
      { activeRuntimeEnvironmentId: 'focused-elsewhere' },
      'same-repo',
      'ssh:server'
    )
    await readRuntimeIssueCommand({ activeRuntimeEnvironmentId: null }, 'same-repo', 'ssh:server')
    await writeRuntimeIssueCommand(
      { activeRuntimeEnvironmentId: null },
      'same-repo',
      'Fix it',
      'ssh:server'
    )

    expect(hooksCheck).toHaveBeenCalledWith({ repoId: 'same-repo', hostId: 'ssh:server' })
    expect(hooksInspectSetupScriptImports).toHaveBeenCalledWith({
      repoId: 'same-repo',
      hostId: 'ssh:server'
    })
    expect(hooksReadIssueCommand).toHaveBeenCalledWith({
      repoId: 'same-repo',
      hostId: 'ssh:server'
    })
    expect(hooksWriteIssueCommand).toHaveBeenCalledWith({
      repoId: 'same-repo',
      content: 'Fix it',
      hostId: 'ssh:server'
    })
  })
})
