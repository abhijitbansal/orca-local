import type { RuntimeTransportMetadata } from '../../../shared/runtime-bootstrap'
import { watchRuntimeMetadataOwnership } from '../runtime-metadata-ownership-watch'
import type { RpcTransport } from '../rpc/transport'
import { UnixSocketTransport } from '../rpc/unix-socket-transport'
import { RuntimeRpcRequestAdmission } from './runtime-rpc-request-admission'
import {
  createRuntimeTransportMetadata,
  sweepOrphanedRuntimeSockets
} from './runtime-rpc-socket-metadata'

export class RuntimeRpcLifecycle extends RuntimeRpcRequestAdmission {
  async start(): Promise<void> {
    if (this.activeTransports.length > 0) {
      return
    }

    // Why: SIGKILL/OOM skip stop(), orphaning `o-<pid>-*.sock` files; sweep them. Skipped on Windows: named pipes leave no filesystem entries.
    if (this.platform !== 'win32') {
      sweepOrphanedRuntimeSockets(this.userDataPath, this.pid)
    }

    const transportMeta = createRuntimeTransportMetadata(
      this.userDataPath,
      this.pid,
      this.platform,
      this.runtime.getRuntimeId()
    )

    const socketTransport = new UnixSocketTransport({
      endpoint: transportMeta.endpoint,
      kind: transportMeta.kind as 'unix' | 'named-pipe',
      keepaliveIntervalMs: this.keepaliveIntervalMs
    })

    // Why: the `.catch` guarantees reply() always fires so a throw can't strand the client or leak the AbortController.
    socketTransport.onMessage((msg, reply, context) => {
      void this.handleMessage(msg, context)
        .then((response) => {
          reply(JSON.stringify(response))
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error)
          // Why: best-effort id recovery so the client can correlate the error frame to its pending request.
          let id = 'unknown'
          try {
            const parsed = JSON.parse(msg) as { id?: unknown }
            if (typeof parsed.id === 'string' && parsed.id.length > 0) {
              id = parsed.id
            }
          } catch {
            // ignore — fall through with id='unknown'
          }
          reply(JSON.stringify(this.buildError(id, 'internal_error', message)))
        })
    })

    await socketTransport.start()

    const activeTransports: RpcTransport[] = [socketTransport]
    const transportsMeta: RuntimeTransportMetadata[] = [transportMeta]

    // Why: set in-memory transport state before writing metadata so the bootstrap file has the real endpoint/token pair.
    this.activeTransports = activeTransports
    this.transports = transportsMeta

    try {
      this.writeMetadata()
    } catch (error) {
      // Why: a runtime that can't publish metadata is invisible to the CLI — close transports rather than run undiscoverable.
      this.activeTransports = []
      this.transports = []
      await Promise.all(activeTransports.map((t) => t.stop().catch(() => {}))).catch(() => {})
      throw error
    }

    this.metadataOwnershipWatch = watchRuntimeMetadataOwnership({
      userDataPath: this.userDataPath,
      ownedPid: this.pid,
      ownedRuntimeId: this.runtime.getRuntimeId(),
      pollIntervalMs: this.metadataOwnershipPollMs,
      republish: () => {
        // Why: never advertise endpoints we already tore down.
        if (this.activeTransports.length === 0) {
          return
        }
        this.writeMetadata()
      },
      onReclaim: (previous) => {
        console.warn(
          `[runtime] Reclaimed orca-runtime.json from a dead runtime (pid ${previous?.pid ?? 'none'}); republished pid ${this.pid}.`
        )
      }
    })
  }
}
