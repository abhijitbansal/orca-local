import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getServeUpdateHandoffPath,
  parseServeUpdateHandoffState
} from '../../shared/serve-update-handoff'
import {
  readServeUpdateHandoff,
  SERVE_REPLACEMENT_READY_TIMEOUT_MS
} from './serve-update-supervisor'

const { spawnMock, spawnSyncMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  spawnSyncMock: vi.fn()
}))

vi.mock('child_process', () => ({
  spawn: spawnMock,
  spawnSync: spawnSyncMock
}))

import { launchOrcaApp, serveOrcaApp } from './launch'

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter()
  kill = vi.fn()
  unref = vi.fn()
  pid = 4101
}

describe('serveOrcaApp', () => {
  const temporaryDirectories: string[] = []

  beforeEach(() => {
    spawnMock.mockReset()
    spawnSyncMock.mockReset()
    process.env.ORCA_APP_EXECUTABLE = '/Applications/Orca.app/Contents/MacOS/Orca'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.ORCA_APP_EXECUTABLE
    delete process.env.ORCA_APP_EXECUTABLE_NEEDS_APP_ROOT
    delete process.env.ORCA_USER_DATA_PATH
    return Promise.all(
      temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true }))
    )
  })

  it.runIf(process.platform === 'darwin')(
    'keeps the serve supervisor alive until the installed target version can take ownership',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'orca-serve-update-'))
      temporaryDirectories.push(root)
      const appPath = join(root, 'Orca.app')
      const executable = join(appPath, 'Contents', 'MacOS', 'Orca')
      const infoPlistPath = join(appPath, 'Contents', 'Info.plist')
      const userDataPath = join(root, 'user-data')
      await mkdir(join(appPath, 'Contents', 'MacOS'), { recursive: true })
      await mkdir(userDataPath, { recursive: true })
      await writeFile(
        infoPlistPath,
        '<plist><dict><key>CFBundleShortVersionString</key><string>1.0.51</string></dict></plist>'
      )
      process.env.ORCA_APP_EXECUTABLE = executable
      process.env.ORCA_USER_DATA_PATH = userDataPath

      const oldOwner = new FakeChildProcess()
      const replacementOwner = new FakeChildProcess()
      replacementOwner.pid = 4102
      spawnMock.mockReturnValueOnce(oldOwner).mockReturnValueOnce(replacementOwner)
      let supervisorExited = false
      const supervisor = serveOrcaApp({ json: true }).then((code) => {
        supervisorExited = true
        return code
      })
      const childEnv = spawnMock.mock.calls[0]?.[2]?.env as NodeJS.ProcessEnv | undefined
      const handoffPath = childEnv?.ORCA_SERVE_UPDATE_HANDOFF_PATH
      expect(handoffPath).toBeTruthy()
      await writeFile(
        handoffPath!,
        JSON.stringify({
          schemaVersion: 1,
          phase: 'install-requested',
          fromVersion: '1.0.51',
          targetVersion: '1.0.61',
          servingPid: oldOwner.pid
        })
      )

      oldOwner.emit('exit', 0, null)
      await Promise.resolve()

      expect(supervisorExited).toBe(false)
      expect(spawnMock).toHaveBeenCalledTimes(1)

      const updateAppPath = join(root, 'Update.app')
      await mkdir(join(updateAppPath, 'Contents'), { recursive: true })
      await writeFile(
        join(updateAppPath, 'Contents', 'Info.plist'),
        '<plist><dict><key>CFBundleShortVersionString</key><string>1.0.61</string></dict></plist>'
      )
      await rename(appPath, join(root, 'Previous.app'))
      await rename(updateAppPath, appPath)
      await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(2))
      replacementOwner.emit('message', {
        type: 'orca:serve-ready',
        version: '1.0.61',
        runtimeId: 'runtime-new'
      })

      expect(supervisorExited).toBe(false)
      await vi.waitFor(async () => expect(await readServeUpdateHandoff(handoffPath!)).toBeNull())
      replacementOwner.emit('exit', 0, null)
      await expect(supervisor).resolves.toBe(0)
    }
  )

  it.runIf(process.platform === 'darwin')(
    'records a replacement version mismatch without starting a retry loop',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'orca-serve-update-mismatch-'))
      temporaryDirectories.push(root)
      const appPath = join(root, 'Orca.app')
      const executable = join(appPath, 'Contents', 'MacOS', 'Orca')
      const userDataPath = join(root, 'user-data')
      await mkdir(join(appPath, 'Contents', 'MacOS'), { recursive: true })
      await mkdir(userDataPath, { recursive: true })
      await writeFile(
        join(appPath, 'Contents', 'Info.plist'),
        '<plist><dict><key>CFBundleShortVersionString</key><string>1.0.61</string></dict></plist>'
      )
      const handoffPath = getServeUpdateHandoffPath(userDataPath)
      await writeFile(
        handoffPath,
        JSON.stringify({
          schemaVersion: 1,
          phase: 'install-requested',
          fromVersion: '1.0.51',
          targetVersion: '1.0.61',
          servingPid: 4101
        })
      )
      process.env.ORCA_APP_EXECUTABLE = executable
      process.env.ORCA_USER_DATA_PATH = userDataPath
      const replacementOwner = new FakeChildProcess()
      replacementOwner.pid = 4102
      spawnMock.mockReturnValue(replacementOwner)
      vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

      const supervisor = serveOrcaApp({ json: true })
      await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledOnce())
      replacementOwner.emit('message', {
        type: 'orca:serve-ready',
        version: '1.0.51',
        runtimeId: 'runtime-old'
      })
      await vi.waitFor(() => expect(replacementOwner.kill).toHaveBeenCalledWith('SIGTERM'))
      replacementOwner.emit('exit', 0, null)

      await expect(supervisor).resolves.toBe(1)
      expect(spawnMock).toHaveBeenCalledOnce()
      expect(parseServeUpdateHandoffState(JSON.parse(await readFile(handoffPath, 'utf8')))).toEqual(
        expect.objectContaining({
          phase: 'failed',
          targetVersion: '1.0.61',
          reason: expect.stringContaining('reported version 1.0.51')
        })
      )
    }
  )

  it.runIf(process.platform === 'darwin')(
    'records replacement spawn failure before rejecting without a retry loop',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'orca-serve-update-spawn-failure-'))
      temporaryDirectories.push(root)
      const appPath = join(root, 'Orca.app')
      const executable = join(appPath, 'Contents', 'MacOS', 'Orca')
      const userDataPath = join(root, 'user-data')
      await mkdir(join(appPath, 'Contents', 'MacOS'), { recursive: true })
      await mkdir(userDataPath, { recursive: true })
      await writeFile(
        join(appPath, 'Contents', 'Info.plist'),
        '<plist><dict><key>CFBundleShortVersionString</key><string>1.0.61</string></dict></plist>'
      )
      const handoffPath = getServeUpdateHandoffPath(userDataPath)
      await writeFile(
        handoffPath,
        JSON.stringify({
          schemaVersion: 1,
          phase: 'install-requested',
          fromVersion: '1.0.51',
          targetVersion: '1.0.61',
          servingPid: 4101
        })
      )
      process.env.ORCA_APP_EXECUTABLE = executable
      process.env.ORCA_USER_DATA_PATH = userDataPath
      const replacementOwner = new FakeChildProcess()
      spawnMock.mockReturnValue(replacementOwner)
      vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

      const supervisor = serveOrcaApp({ json: true })
      await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledOnce())
      replacementOwner.emit('error', new Error('spawn ENOENT'))

      await expect(supervisor).rejects.toThrow('spawn ENOENT')
      expect(spawnMock).toHaveBeenCalledOnce()
      expect(parseServeUpdateHandoffState(JSON.parse(await readFile(handoffPath, 'utf8')))).toEqual(
        expect.objectContaining({
          phase: 'failed',
          targetVersion: '1.0.61',
          reason: expect.stringContaining('spawn ENOENT')
        })
      )
    }
  )

  it.runIf(process.platform === 'darwin')(
    'fails a replacement that never reports runtime readiness without retrying it',
    async () => {
      vi.useFakeTimers()
      const root = await mkdtemp(join(tmpdir(), 'orca-serve-update-no-readiness-'))
      temporaryDirectories.push(root)
      const appPath = join(root, 'Orca.app')
      const executable = join(appPath, 'Contents', 'MacOS', 'Orca')
      const userDataPath = join(root, 'user-data')
      await mkdir(join(appPath, 'Contents', 'MacOS'), { recursive: true })
      await mkdir(userDataPath, { recursive: true })
      await writeFile(
        join(appPath, 'Contents', 'Info.plist'),
        '<plist><dict><key>CFBundleShortVersionString</key><string>1.0.61</string></dict></plist>'
      )
      const handoffPath = getServeUpdateHandoffPath(userDataPath)
      await writeFile(
        handoffPath,
        JSON.stringify({
          schemaVersion: 1,
          phase: 'install-requested',
          fromVersion: '1.0.51',
          targetVersion: '1.0.61',
          servingPid: 4101
        })
      )
      process.env.ORCA_APP_EXECUTABLE = executable
      process.env.ORCA_USER_DATA_PATH = userDataPath
      const replacementOwner = new FakeChildProcess()
      spawnMock.mockReturnValue(replacementOwner)
      vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

      try {
        const supervisor = serveOrcaApp({ json: true })
        await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledOnce())

        await vi.advanceTimersByTimeAsync(SERVE_REPLACEMENT_READY_TIMEOUT_MS)
        expect(replacementOwner.kill).toHaveBeenCalledWith('SIGTERM')
        replacementOwner.emit('exit', 0, null)

        await expect(supervisor).resolves.toBe(1)
        expect(spawnMock).toHaveBeenCalledOnce()
        expect(
          parseServeUpdateHandoffState(JSON.parse(await readFile(handoffPath, 'utf8')))
        ).toEqual(
          expect.objectContaining({
            phase: 'failed',
            reason: expect.stringContaining('did not report serving version')
          })
        )
      } finally {
        vi.useRealTimers()
      }
    }
  )

  it('pins the Electron child cwd to the app root instead of the caller cwd', async () => {
    const child = {
      kill: vi.fn(),
      once: vi.fn(
        (event: string, handler: (code: number | null, signal: string | null) => void) => {
          if (event === 'exit') {
            queueMicrotask(() => handler(0, null))
          }
          return child
        }
      )
    }
    spawnMock.mockReturnValue(child)

    await expect(serveOrcaApp({ json: true })).resolves.toBe(0)

    expect(spawnMock).toHaveBeenCalledWith(
      '/Applications/Orca.app/Contents/MacOS/Orca',
      ['--serve', '--serve-json'],
      expect.objectContaining({
        cwd: resolve(__dirname, '../../..')
      })
    )
  })

  it('passes the app root before serve flags for dev Electron executables', async () => {
    process.env.ORCA_APP_EXECUTABLE = '/repo/node_modules/.bin/electron'
    process.env.ORCA_APP_EXECUTABLE_NEEDS_APP_ROOT = '1'
    const child = {
      kill: vi.fn(),
      once: vi.fn(
        (event: string, handler: (code: number | null, signal: string | null) => void) => {
          if (event === 'exit') {
            queueMicrotask(() => handler(0, null))
          }
          return child
        }
      )
    }
    spawnMock.mockReturnValue(child)

    await expect(serveOrcaApp({ json: true })).resolves.toBe(0)

    expect(spawnMock).toHaveBeenCalledWith(
      '/repo/node_modules/.bin/electron',
      [resolve(__dirname, '../../..'), '--serve', '--serve-json'],
      expect.objectContaining({
        cwd: resolve(__dirname, '../../..')
      })
    )
  })

  it.each([
    { probe: 'exits nonzero', result: { status: 1 }, expectedPrefix: ['--no-sandbox'] },
    { probe: 'succeeds', result: { status: 0 }, expectedPrefix: [] },
    {
      probe: 'times out',
      result: {
        status: null,
        error: Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' })
      },
      expectedPrefix: ['--no-sandbox']
    },
    {
      probe: 'cannot start',
      result: { status: null, error: Object.assign(new Error('missing'), { code: 'ENOENT' }) },
      expectedPrefix: ['--no-sandbox']
    }
  ])(
    'uses the extracted AppImage sandbox fallback when the userns probe $probe',
    async ({ result: userNamespaceResult, expectedPrefix }) => {
      const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')
      const getuidDescriptor = Object.getOwnPropertyDescriptor(process, 'getuid')
      const root = await mkdtemp(join(tmpdir(), 'orca-extracted-appimage-'))
      temporaryDirectories.push(root)
      const executable = join(root, 'orca-ide')
      await writeFile(join(root, 'AppRun'), '', { mode: 0o755 })
      process.env.ORCA_APP_EXECUTABLE = executable
      Object.defineProperty(process, 'platform', { value: 'linux' })
      Object.defineProperty(process, 'getuid', { configurable: true, value: () => 1000 })
      spawnSyncMock.mockReturnValue(userNamespaceResult)
      const child = new FakeChildProcess()
      spawnMock.mockReturnValue(child)

      try {
        const result = serveOrcaApp({ json: true })
        queueMicrotask(() => child.emit('exit', 0, null))
        await expect(result).resolves.toBe(0)
        expect(spawnSyncMock).toHaveBeenCalledWith(
          'unshare',
          ['-Ur', 'true'],
          expect.objectContaining({ stdio: 'ignore', timeout: 2_000 })
        )
        expect(spawnMock).toHaveBeenCalledWith(
          executable,
          [...expectedPrefix, '--serve', '--serve-json'],
          // Foreground serve must share POSIX job-control signals with its CLI supervisor.
          expect.objectContaining({ detached: false })
        )
      } finally {
        if (platformDescriptor) {
          Object.defineProperty(process, 'platform', platformDescriptor)
        }
        if (getuidDescriptor) {
          Object.defineProperty(process, 'getuid', getuidDescriptor)
        } else {
          Reflect.deleteProperty(process, 'getuid')
        }
      }
    }
  )

  it('uses a shell when a Windows npm command shim is the Electron executable', async () => {
    const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', { value: 'win32' })
    process.env.ORCA_APP_EXECUTABLE = 'C:\\repo\\node_modules\\.bin\\electron.cmd'
    const child = {
      kill: vi.fn(),
      once: vi.fn(
        (event: string, handler: (code: number | null, signal: string | null) => void) => {
          if (event === 'exit') {
            queueMicrotask(() => handler(0, null))
          }
          return child
        }
      )
    }
    spawnMock.mockReturnValue(child)

    try {
      await expect(serveOrcaApp({ json: true })).resolves.toBe(0)
      expect(spawnMock).toHaveBeenCalledWith(
        'C:\\repo\\node_modules\\.bin\\electron.cmd',
        ['--serve', '--serve-json'],
        expect.objectContaining({
          shell: true
        })
      )
    } finally {
      if (platformDescriptor) {
        Object.defineProperty(process, 'platform', platformDescriptor)
      }
    }
  })
})

describe('launchOrcaApp', () => {
  beforeEach(() => {
    spawnMock.mockReset()
    spawnSyncMock.mockReset()
  })

  afterEach(() => {
    delete process.env.ORCA_OPEN_COMMAND
    delete process.env.ORCA_APP_EXECUTABLE
    delete process.env.ORCA_APP_EXECUTABLE_NEEDS_APP_ROOT
  })

  it('handles asynchronous detached spawn errors without throwing', async () => {
    process.env.ORCA_APP_EXECUTABLE = '/missing/Orca'
    const child = new FakeChildProcess()
    spawnMock.mockReturnValue(child)

    launchOrcaApp()
    child.emit('error', new Error('ENOENT'))
    await Promise.resolve()

    expect(child.unref).toHaveBeenCalled()
  })

  it('adds the extracted-AppImage sandbox fallback for open launches', async () => {
    const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')
    const getuidDescriptor = Object.getOwnPropertyDescriptor(process, 'getuid')
    const root = await mkdtemp(join(tmpdir(), 'orca-open-extracted-appimage-'))
    const executable = join(root, 'orca-ide')

    try {
      await writeFile(join(root, 'AppRun'), '')
      process.env.ORCA_APP_EXECUTABLE = executable
      process.env.ELECTRON_RUN_AS_NODE = '1'
      Object.defineProperty(process, 'platform', { configurable: true, value: 'linux' })
      Object.defineProperty(process, 'getuid', { configurable: true, value: () => 1000 })
      spawnSyncMock.mockReturnValue({ status: 1 })
      const child = new FakeChildProcess()
      spawnMock.mockReturnValue(child)

      launchOrcaApp()

      expect(spawnSyncMock).toHaveBeenCalledWith(
        'unshare',
        ['-Ur', 'true'],
        expect.objectContaining({ stdio: 'ignore', timeout: 2_000 })
      )
      expect(spawnMock).toHaveBeenCalledWith(
        executable,
        ['--no-sandbox'],
        expect.objectContaining({
          detached: true,
          stdio: 'ignore',
          env: expect.not.objectContaining({ ELECTRON_RUN_AS_NODE: '1' })
        })
      )
      expect(child.unref).toHaveBeenCalledOnce()
    } finally {
      await rm(root, { recursive: true, force: true })
      delete process.env.ELECTRON_RUN_AS_NODE
      if (platformDescriptor) {
        Object.defineProperty(process, 'platform', platformDescriptor)
      }
      if (getuidDescriptor) {
        Object.defineProperty(process, 'getuid', getuidDescriptor)
      } else {
        Reflect.deleteProperty(process, 'getuid')
      }
    }
  })
})
