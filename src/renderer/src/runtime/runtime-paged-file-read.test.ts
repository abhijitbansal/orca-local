import { describe, expect, it } from 'vitest'
import { writeRuntimeFile } from './runtime-file-mutation-client'
import {
  installRuntimeFileClientEnvironment,
  runtimeEnvironmentCall
} from './runtime-file-client-test-harness'

installRuntimeFileClientEnvironment()

const MB = 1024 * 1024
// Mirrors the host: files.read stops at 512 KiB, a files.readPreview reply at about 3 MB.

/** A paired host with today's single-reply caps and the chunk methods it already has. */

function htmlBytes(length: number): Buffer {
  const unit = '<p class="row">café — résumé 🚀</p>\n'
  const body = unit.repeat(Math.floor(length / Buffer.byteLength(unit)))
  return Buffer.from(body.padEnd(length - Buffer.byteLength(body) + body.length, 'x'))
}

describe('remote saves larger than one request frame', () => {
  const context = {
    target: { kind: 'environment' as const, environmentId: 'env-1' },
    worktreeId: 'wt-1',
    worktreePath: '/remote/repo'
  }

  it('refuses a save the host would answer by closing the connection', async () => {
    await expect(
      writeRuntimeFile(context, '/remote/repo/report.html', htmlBytes(2 * MB).toString('utf8'))
    ).rejects.toThrow('File is too large to save to a remote Orca server')
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  it('counts JSON escaping, not just characters', async () => {
    await expect(
      writeRuntimeFile(context, '/remote/repo/quotes.txt', '"'.repeat(400 * 1024))
    ).rejects.toThrow('File is too large to save to a remote Orca server')
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })
})
