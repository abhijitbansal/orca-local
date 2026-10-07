import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as RunnerModule from './runner'

const gitExecFileAsyncMock = vi.hoisted(() => vi.fn())

vi.mock('./runner', async () => {
  const actual = await vi.importActual<typeof RunnerModule>('./runner')
  return {
    ...actual,
    gitExecFileAsync: gitExecFileAsyncMock
  }
})

import {
  isBranchSafeHostedLogin,
  resolveLocalGitUsername,
  resolveLocalGitUsernameDetailed
} from './git-username'

function makeExecError(message: string): Error {
  return Object.assign(new Error(message), { stdout: '', stderr: '' })
}

describe('isBranchSafeHostedLogin', () => {
  it.each(['demo', 'demo-user', 'demo_user', 'demo.user', 'a', 'FOO.LOCK'])(
    'accepts %s',
    (login) => {
      expect(isBranchSafeHostedLogin(login)).toBe(true)
    }
  )

  it.each(['foo.', 'foo..bar', 'foo.lock', 'a.b.lock', '.foo', '-foo', 'foo bar'])(
    'rejects the git check-ref-format-invalid %s',
    (login) => {
      expect(isBranchSafeHostedLogin(login)).toBe(false)
    }
  )

  // Length is Orca's defensive bound, not a check-ref-format rule: a login is one
  // branch component, so a loose ref stores it as a single 255-byte-max filename.
  it('accepts long provider-agnostic logins up to the loose-ref filename cap', () => {
    expect(isBranchSafeHostedLogin('a'.repeat(255))).toBe(true)
  })

  it('rejects logins past the loose-ref filename cap', () => {
    expect(isBranchSafeHostedLogin('a'.repeat(256))).toBe(false)
  })
})

describe('resolveLocalGitUsername', () => {
  let gitConfig: Record<string, string>

  beforeEach(() => {
    vi.resetAllMocks()
    gitConfig = {}
    gitExecFileAsyncMock.mockImplementation(async (args: string[]) => {
      if (args[0] === 'config' && args[1] === '--get') {
        const value = gitConfig[args[2]]
        if (value !== undefined) {
          return { stdout: `${value}\n`, stderr: '' }
        }
        throw makeExecError(`missing config ${args[2]}`)
      }
      throw makeExecError(`unexpected git args: ${args.join(' ')}`)
    })
  })

  it('prefers explicit GitHub user config', async () => {
    gitConfig['github.user'] = 'config-demo'
    gitConfig['user.username'] = 'repo-demo'

    await expect(resolveLocalGitUsername('/repo')).resolves.toBe('config-demo')
  })

  it('uses explicit username config when github.user is unset', async () => {
    gitConfig['user.username'] = 'repo-demo'

    await expect(resolveLocalGitUsername('/repo')).resolves.toBe('repo-demo')
  })

  it('ignores config values git rejects as branch components', async () => {
    gitConfig['github.user'] = 'foo.lock'
    gitConfig['user.username'] = 'foo..bar'

    await expect(resolveLocalGitUsername('/repo')).resolves.toBe('')
  })

  it('does not derive a prefix from repo-local author identity', async () => {
    gitConfig['user.email'] = 'demo@example.com'
    gitConfig['user.name'] = 'Demo User'

    await expect(resolveLocalGitUsernameDetailed('/repo')).resolves.toEqual({
      username: '',
      authoritative: true
    })
    expect(gitExecFileAsyncMock.mock.calls.map(([args]) => args)).toEqual([
      ['config', '--get', 'github.user'],
      ['config', '--get', 'user.username']
    ])
  })
})
