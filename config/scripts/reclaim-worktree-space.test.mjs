import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { reclaimWorktreeSpace } from './reclaim-worktree-space.mjs'

const roots = []
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await rm(root, { recursive: true, force: true })
  }
})
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'orca-storage-maintenance-'))
  roots.push(root)
  const execute = vi.fn(async () => ({ code: 0, timedOut: false }))
  return { commonDirectory: root, repoRoot: root, execute }
}

it('previews historical test caches, Electron cleanup, and Vite caches', async () => {
  const options = { ...(await fixture()), testsStopped: true }
  await reclaimWorktreeSpace(options)
  expect(options.execute).toHaveBeenCalledTimes(4)
  expect(options.execute.mock.calls.flatMap(([spec]) => spec.args)).not.toContain('--apply')
})

it('forwards apply and repository selection to all cleanup operations', async () => {
  const options = { ...(await fixture()), apply: true, testsStopped: true }
  await reclaimWorktreeSpace(options)
  expect(options.execute).toHaveBeenCalledTimes(4)
  for (const [spec] of options.execute.mock.calls) {
    expect(spec.args).toContain('--apply')
    expect(spec.args).toContain(options.repoRoot)
    expect(spec.terminationBarrier).toBe(true)
  }
  for (const [spec] of options.execute.mock.calls) {
    expect(spec.args).not.toContain('--tests-stopped')
  }
})

it('applies Electron, Vite and generated cleanup while retaining unacknowledged test caches', async () => {
  const options = { ...(await fixture()), apply: true }
  await reclaimWorktreeSpace(options)
  expect(options.execute).toHaveBeenCalledTimes(4)
  expect(options.execute.mock.calls.flatMap(([spec]) => spec.args).join(' ')).not.toContain(
    'reclaim-release-test-caches'
  )
})

it('includes generated cleanup and leaves historical test caches out of automatic invocations', async () => {
  const options = {
    ...(await fixture()),
    automatic: true,
    apply: true,
    testsStopped: true,
    excludeWorktree: '/dev-worktree'
  }
  await reclaimWorktreeSpace(options)
  expect(options.execute).toHaveBeenCalledTimes(4)
  expect(options.execute.mock.calls.flatMap(([spec]) => spec.args).join(' ')).not.toContain(
    'reclaim-release-test-caches'
  )
  expect(options.execute.mock.calls.flatMap(([spec]) => spec.args).join(' ')).toContain(
    'reclaim-worktree-generated-files'
  )
  for (const [spec] of options.execute.mock.calls) {
    expect(spec.args).toEqual(
      expect.arrayContaining(['--exclude-worktree', options.excludeWorktree])
    )
  }
})

it.each([
  ['releaseCacheMinAgeDays', '--release-cache-min-age-days'],
  ['generatedMinAgeDays', '--generated-min-age-days']
])('rejects invalid %s before starting cleanup', async (key, flag) => {
  const options = { ...(await fixture()), [key]: -1 }
  await expect(reclaimWorktreeSpace(options)).rejects.toThrow(flag)
  expect(options.execute).not.toHaveBeenCalled()
})

it('rejects competing sweeps and releases the lock after a failed operation', async () => {
  const options = { ...(await fixture()), apply: true, testsStopped: true }
  let release
  const blocked = new Promise((resolve) => {
    release = resolve
  })
  let entered
  const ready = new Promise((resolve) => {
    entered = resolve
  })
  options.execute.mockImplementation(async () => {
    entered()
    await blocked
    return { code: 1, timedOut: false }
  })
  const first = reclaimWorktreeSpace(options)
  const rejected = expect(first).rejects.toThrow('failed')
  await ready
  await expect(reclaimWorktreeSpace(options)).rejects.toThrow('already running')
  release()
  await rejected
  options.execute.mockResolvedValue({ code: 0, timedOut: false })
  await reclaimWorktreeSpace(options)
  expect(options.execute).toHaveBeenCalledTimes(5)
})

it('preserves the cleanup failure and reports a concurrent lock release failure separately', async () => {
  const options = await fixture()
  const failure = new Error('original cleanup failure')
  options.execute.mockRejectedValue(failure)
  const release = vi.fn().mockRejectedValue(new Error('lock release failure'))
  const report = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    await expect(
      reclaimWorktreeSpace({ ...options, acquireLock: async () => release })
    ).rejects.toBe(failure)
    expect(release).toHaveBeenCalledTimes(1)
    expect(report).toHaveBeenCalledWith('Failed to release cleanup lock: lock release failure')
  } finally {
    report.mockRestore()
  }
})

it('fails if cleanup succeeds but the repository lock cannot be released', async () => {
  const options = { ...(await fixture()), testsStopped: true }
  const failure = new Error('lock release failure')
  const release = vi.fn().mockRejectedValue(failure)
  await expect(reclaimWorktreeSpace({ ...options, acquireLock: async () => release })).rejects.toBe(
    failure
  )
  expect(options.execute).toHaveBeenCalledTimes(4)
})
