import { describe, expect, it } from 'vitest'
import { writeRuntimeFile } from './runtime-file-mutation-client'
import {
  FILE_MUTATION_OWNERSHIP_RUNTIME_CAPABILITY,
  MIN_COMPATIBLE_RUNTIME_CLIENT_VERSION,
  RUNTIME_PROTOCOL_VERSION
} from '../../../shared/protocol-version'
import {
  FILE_WRITE_DISK_PRECONDITION_RUNTIME_CAPABILITY,
  FILE_WRITE_IDENTICAL_RUNTIME_CAPABILITY
} from '../../../shared/file-write-disk-precondition'
import { getDiskBaselineSignature } from '../../../shared/disk-baseline-signature'
import {
  fsWriteFile,
  installRuntimeFileClientEnvironment,
  runtimeEnvironmentCall,
  runtimeEnvironmentTransportCall,
  type RuntimeRpcRequest
} from './runtime-file-client-test-harness'

installRuntimeFileClientEnvironment()

const remoteContext = {
  target: { kind: 'environment' as const, environmentId: 'env-1' },
  worktreeId: 'wt-1',
  worktreePath: '/remote/repo'
}
const precondition = { expectedSignature: getDiskBaselineSignature('original') }
const ENOENT_MESSAGE = "ENOENT: no such file or directory, stat '/remote/repo/file.ts'"

function rpcOk(result: unknown) {
  return { id: 'rpc', ok: true, result, _meta: { runtimeId: 'remote-runtime' } }
}

function serveHost(options: {
  enforcesPrecondition: boolean
  identicalNoop?: boolean
  diskContent?: string
  readError?: string
  readErrorCode?: string
  onRead?: () => void
  onStatus?: () => void
}): void {
  runtimeEnvironmentTransportCall.mockImplementation((args: RuntimeRpcRequest) => {
    if (args.method === 'status.get') {
      options.onStatus?.()
      return Promise.resolve(
        rpcOk({
          runtimeId: 'remote-runtime',
          runtimeProtocolVersion: RUNTIME_PROTOCOL_VERSION,
          minCompatibleRuntimeClientVersion: MIN_COMPATIBLE_RUNTIME_CLIENT_VERSION,
          capabilities: [
            FILE_MUTATION_OWNERSHIP_RUNTIME_CAPABILITY,
            ...(options.enforcesPrecondition
              ? [
                  FILE_WRITE_DISK_PRECONDITION_RUNTIME_CAPABILITY,
                  ...(options.identicalNoop === false
                    ? []
                    : [FILE_WRITE_IDENTICAL_RUNTIME_CAPABILITY])
                ]
              : [])
          ]
        })
      )
    }
    if (args.method === 'files.read') {
      options.onRead?.()
      return Promise.resolve(
        options.diskContent === undefined
          ? {
              id: 'rpc',
              ok: false,
              error: {
                code: options.readErrorCode ?? 'runtime_error',
                message: options.readError ?? ENOENT_MESSAGE
              }
            }
          : rpcOk({ content: options.diskContent, truncated: false, byteLength: 0 })
      )
    }
    return runtimeEnvironmentCall(args)
  })
}

describe('writeRuntimeFile disk precondition', () => {
  it('sends the precondition to a local writer and returns its refusal', async () => {
    fsWriteFile.mockResolvedValue({ ok: false, diskConflict: 'changed' })

    const result = await writeRuntimeFile(
      { target: { kind: 'local' }, worktreeId: 'wt-1', worktreePath: '/repo' },
      '/repo/file.ts',
      'edited',
      undefined,
      precondition
    )

    expect(result).toEqual({ ok: false, diskConflict: 'changed' })
    expect(fsWriteFile).toHaveBeenCalledWith(
      expect.objectContaining({ diskPrecondition: precondition })
    )
  })

  it('cannot write through an older server reached after a supporting server was probed', async () => {
    // The shared socket reconnected to an older server between the capability verdict and the send.
    serveHost({ enforcesPrecondition: true })
    const unguardedWrites: RuntimeRpcRequest[] = []
    runtimeEnvironmentCall.mockImplementation((args: RuntimeRpcRequest) => {
      if (args.method === 'files.write') {
        unguardedWrites.push(args)
        return Promise.resolve(rpcOk({ ok: true }))
      }
      return Promise.resolve({
        id: 'rpc',
        ok: false,
        error: { code: 'method_not_found', message: `Unknown method: ${args.method}` },
        _meta: { runtimeId: 'remote-runtime' }
      })
    })

    await expect(
      writeRuntimeFile(remoteContext, '/remote/repo/file.ts', 'edited', undefined, precondition)
    ).rejects.toThrow()
    expect(unguardedWrites).toHaveLength(0)
  })
})
