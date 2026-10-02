import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const {
  applyAgentStatusHooksEnabledMock,
  constructorArgsMock,
  callMock,
  getCliStatusMock,
  testUserDataPathRef
} = vi.hoisted(() => ({
  applyAgentStatusHooksEnabledMock: vi.fn(async () => []),
  constructorArgsMock: vi.fn(),
  callMock: vi.fn(),
  getCliStatusMock: vi.fn(),
  testUserDataPathRef: { current: '' }
}))

// Why: `main` reaches RuntimeClient through `await import('./runtime-client.js')`
// now. Mocking the same specifier the eager import used proves the dynamic
// import still resolves to the module the 10 existing vi.mock suites target.
// Why: this suite runs the REAL `main()`, and `agent hooks off` below reaches the production
// handler, which calls removeManagedAgentHooks() against the developer's OWN ~/.claude and
// ~/.cursor — a green test run silently deleted every Orca-managed hook on the machine, so agent
// status stopped reporting until the next Orca restart (STA-5679).
vi.mock('../main/agent-hooks/managed-agent-hook-controls', () => ({
  applyAgentStatusHooksEnabled: applyAgentStatusHooksEnabledMock,
  getManagedAgentHookStatuses: vi.fn(() => [])
}))

vi.mock('./runtime-client', () => {
  class RuntimeClient {
    call = callMock
    getCliStatus = getCliStatusMock
    openOrca = vi.fn()

    constructor(...args: unknown[]) {
      constructorArgsMock(...args)
    }
  }
  return { RuntimeClient, getDefaultUserDataPath: () => testUserDataPathRef.current }
})

import { main } from './index'

describe('RuntimeClient module-graph deferral', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    testUserDataPathRef.current = mkdtempSync(join(tmpdir(), 'orca-runtime-deferral-userdata-'))
    applyAgentStatusHooksEnabledMock.mockClear()
    constructorArgsMock.mockClear()
    callMock.mockReset()
    getCliStatusMock.mockReset()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
    vi.unstubAllEnvs()
    rmSync(testUserDataPathRef.current, { recursive: true, force: true })
    process.exitCode = 0
  })

  it('constructs no client for --help', async () => {
    await main(['--help'], '/tmp/repo')
    expect(constructorArgsMock).not.toHaveBeenCalled()
  })

  it('constructs no client for an unknown flag', async () => {
    await main(['worktree', 'list', '--nope'], '/tmp/repo')
    expect(process.exitCode).toBe(1)
    expect(constructorArgsMock).not.toHaveBeenCalled()
  })

  // Why: `agent hooks on|off` are the only commands in these groups that touch ctx.client, and
  // they rewrite the real ~/.claude hook config. `constructs` is declared per case and asserted
  // so the zero rows prove the deferral itself: a local-only group must reach its handler without
  // building a client.
  const LOCAL_ONLY_GROUPS: [name: string, argv: string[], constructs: number][] = [
    ['agent', ['agent', 'hooks', 'off'], 1],
    ['serve', ['serve'], 0],
    ['agent-context', ['agent-context'], 0]
  ]

  it.each(LOCAL_ONLY_GROUPS)(
    'constructs exactly %s expected clients',
    async (_name, argv, constructs) => {
      getCliStatusMock.mockResolvedValue({
        result: { runtime: { reachable: false }, app: { running: false } }
      })

      await main(argv, '/tmp/repo')

      expect(constructorArgsMock.mock.calls.length, `${argv.join(' ')} client constructions`).toBe(
        constructs
      )
      if (argv.join(' ') === 'agent hooks off') {
        expect(
          applyAgentStatusHooksEnabledMock,
          `${argv.join(' ')} hook application`
        ).toHaveBeenCalledExactlyOnceWith(false, {
          agentCmdOverrides: {},
          disabledTuiAgents: []
        })
      } else {
        expect(
          applyAgentStatusHooksEnabledMock,
          `${argv.join(' ')} hook application`
        ).not.toHaveBeenCalled()
      }
    }
  )

  // Why: the getter is memoised; a dynamic import inside it would have made it
  // async and changed every handler signature.
  it('reuses one client instance across repeated ctx.client reads', async () => {
    callMock.mockResolvedValue({ result: { worktrees: [] } })

    await main(['worktree', 'list', '--json'], '/tmp/repo')

    expect(constructorArgsMock).toHaveBeenCalledTimes(1)
  })
})
