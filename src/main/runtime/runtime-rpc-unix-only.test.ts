import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { OrcaRuntimeService } from './orca-runtime'
import { OrcaRuntimeRpcServer } from './runtime-rpc'
import { readRuntimeMetadata } from './runtime-metadata'

describe('OrcaRuntimeRpcServer (local-only)', () => {
  const servers: OrcaRuntimeRpcServer[] = []
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.stop()))
  })

  it('publishes exactly one unix-socket or named-pipe transport and never a websocket', async () => {
    const userDataPath = mkdtempSync(join(tmpdir(), 'orca-local-only-rpc-'))
    const server = new OrcaRuntimeRpcServer({ runtime: new OrcaRuntimeService(), userDataPath })
    servers.push(server)
    await server.start()
    const metadata = readRuntimeMetadata(userDataPath)
    expect(metadata?.transports.map((transport) => transport.kind)).toEqual([
      process.platform === 'win32' ? 'named-pipe' : 'unix'
    ])
  })

  it('rejects the removed WebSocket options at the type level', () => {
    const options: ConstructorParameters<typeof OrcaRuntimeRpcServer>[0] = {
      runtime: new OrcaRuntimeService(),
      userDataPath: '/tmp/x',
      // @ts-expect-error enableWebSocket no longer exists on OrcaRuntimeRpcServerOptions
      enableWebSocket: true
    }
    expect(options.userDataPath).toBe('/tmp/x')
  })
})
