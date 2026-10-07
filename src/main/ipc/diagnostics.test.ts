import { writeFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollectedBundle } from '../observability/bundle'
import type * as NodeFs from 'node:fs'

const handlers = new Map<string, (_event: unknown, ...args: unknown[]) => unknown>()

const {
  handleMock,
  mkdirSyncMock,
  writeFileSyncMock,
  openPathMock,
  collectDiagnosticBundleMock,
  getDiagnosticsStatusMock
} = vi.hoisted(() => ({
  handleMock: vi.fn(),
  mkdirSyncMock: vi.fn(),
  writeFileSyncMock: vi.fn(),
  openPathMock: vi.fn(),
  collectDiagnosticBundleMock: vi.fn(),
  getDiagnosticsStatusMock: vi.fn()
}))

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof NodeFs>('node:fs')
  return {
    ...actual,
    mkdirSync: mkdirSyncMock,
    writeFileSync: writeFileSyncMock
  }
})

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp', getVersion: () => '1.2.3-test' },
  ipcMain: { handle: handleMock },
  shell: { openPath: openPathMock }
}))

vi.mock('../observability', () => ({
  collectDiagnosticBundle: collectDiagnosticBundleMock,
  getDiagnosticsStatus: getDiagnosticsStatusMock
}))

import { registerDiagnosticsHandlers } from './diagnostics'

function captureHandlers(): void {
  handlers.clear()
  for (const call of handleMock.mock.calls) {
    const [channel, handler] = call as [
      string,
      typeof handlers extends Map<string, infer V> ? V : never
    ]
    handlers.set(channel, handler)
  }
}

function makeBundle(overrides: Partial<CollectedBundle> = {}): CollectedBundle {
  return {
    bundleSubmissionId: 'abcdefghijklmnopqrstuv',
    payload: '{"type":"bundle-header"}\n',
    bytes: 25,
    spanCount: 0,
    ...overrides
  }
}

describe('diagnostics IPC handlers', () => {
  beforeEach(() => {
    handleMock.mockReset()
    mkdirSyncMock.mockReset()
    writeFileSyncMock.mockReset()
    openPathMock.mockReset()
    openPathMock.mockResolvedValue('')
    collectDiagnosticBundleMock.mockReset()
    getDiagnosticsStatusMock.mockReset()
    getDiagnosticsStatusMock.mockReturnValue({
      localFileEnabled: true,
      bundleEnabled: true,
      traceFilePath: '/tmp/main.trace.ndjson',
      traceFamilySize: 0
    })
    collectDiagnosticBundleMock.mockReturnValue(makeBundle())
    registerDiagnosticsHandlers()
    captureHandlers()
  })

  it('opens the retained bundle preview file through main', async () => {
    const bundle = makeBundle({ bundleSubmissionId: 'bundleabcdefghijklmnop' })
    collectDiagnosticBundleMock.mockReturnValue(bundle)
    const collect = handlers.get('diagnostics:collectBundle')!
    const openPreview = handlers.get('diagnostics:openBundlePreview')!

    await collect({}, 30)
    await openPreview({}, bundle.bundleSubmissionId)

    expect(openPathMock).toHaveBeenCalledWith(
      expect.stringContaining(`${bundle.bundleSubmissionId}.ndjson`)
    )
  })

  it('marks a retained preview opened only through openBundlePreview', async () => {
    const bundle = makeBundle({ bundleSubmissionId: 'bundleabcdefghijklmnop' })
    collectDiagnosticBundleMock.mockReturnValue(bundle)
    const collect = handlers.get('diagnostics:collectBundle')!
    const openPreview = handlers.get('diagnostics:openBundlePreview')!
    const discard = handlers.get('diagnostics:discardBundlePreview')!

    await collect({}, 30)
    await expect(openPreview({}, bundle.bundleSubmissionId)).resolves.toBeUndefined()
    await discard({}, bundle.bundleSubmissionId)
    await expect(openPreview({}, bundle.bundleSubmissionId)).rejects.toThrow(/expired/)
  })

  it('discards retained bundle previews on request', async () => {
    const bundle = makeBundle({ bundleSubmissionId: 'bundleabcdefghijklmnop' })
    collectDiagnosticBundleMock.mockReturnValue(bundle)
    const collect = handlers.get('diagnostics:collectBundle')!
    const discard = handlers.get('diagnostics:discardBundlePreview')!
    const openPreview = handlers.get('diagnostics:openBundlePreview')!

    await collect({}, 30)
    await discard({}, bundle.bundleSubmissionId)

    await expect(openPreview({}, bundle.bundleSubmissionId)).rejects.toThrow(/expired/)
  })

  it('expires retained bundle previews without another diagnostics call', async () => {
    vi.useFakeTimers()
    try {
      const bundle = makeBundle({ bundleSubmissionId: 'bundleabcdefghijklmnop' })
      collectDiagnosticBundleMock.mockReturnValue(bundle)
      const collect = handlers.get('diagnostics:collectBundle')!
      const openPreview = handlers.get('diagnostics:openBundlePreview')!

      await collect({}, 30)
      await vi.advanceTimersByTimeAsync(15 * 60 * 1000 + 1)

      await expect(openPreview({}, bundle.bundleSubmissionId)).rejects.toThrow(/expired/)
    } finally {
      vi.useRealTimers()
    }
  })

  it('writes retained preview files with private permissions', async () => {
    const bundle = makeBundle({ bundleSubmissionId: 'bundleabcdefghijklmnop' })
    collectDiagnosticBundleMock.mockReturnValue(bundle)
    const collect = handlers.get('diagnostics:collectBundle')!

    await collect({}, 30)

    expect(mkdirSyncMock).toHaveBeenCalledWith(expect.any(String), {
      mode: 0o700,
      recursive: true
    })
    expect(writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining(`${bundle.bundleSubmissionId}.ndjson`),
      bundle.payload,
      { encoding: 'utf8', mode: 0o600 }
    )
  })

  it('returns only bundle metadata from collection', async () => {
    const bundle = makeBundle({
      bundleSubmissionId: 'bundleabcdefghijklmnop',
      payload: '{"type":"bundle-header"}\n{"safe":true}\n',
      bytes: 37,
      spanCount: 1
    })
    collectDiagnosticBundleMock.mockReturnValue(bundle)
    const collect = handlers.get('diagnostics:collectBundle')!

    expect(collect({}, 30)).toEqual({
      bundleSubmissionId: bundle.bundleSubmissionId,
      bytes: bundle.bytes,
      spanCount: bundle.spanCount
    })
  })

  it('does not expose retained bundle payloads through collection IPC', async () => {
    const bundle = makeBundle({
      bundleSubmissionId: 'bundleabcdefghijklmnop',
      payload: '{"secret":"retained in main"}\n'
    })
    collectDiagnosticBundleMock.mockReturnValue(bundle)
    const collect = handlers.get('diagnostics:collectBundle')!

    const preview = await collect({}, 30)
    expect(JSON.stringify(preview)).not.toContain('retained in main')
  })

  it('allows crash-report lookbacks beyond 24 hours while bounding abuse', async () => {
    const collect = handlers.get('diagnostics:collectBundle')!
    await collect({}, 3 * 24 * 60)
    expect(collectDiagnosticBundleMock).toHaveBeenCalledWith(
      expect.objectContaining({ lookbackMinutes: 3 * 24 * 60 })
    )
  })
})
