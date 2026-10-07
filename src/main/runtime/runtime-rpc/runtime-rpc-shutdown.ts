import { RuntimeRpcLifecycle } from './runtime-rpc-lifecycle'

export class RuntimeRpcShutdown extends RuntimeRpcLifecycle {
  /** Why: test-only seam — runs one ownership check instead of waiting out the poll interval. */
  checkRuntimeMetadataOwnership(): Promise<void> {
    return this.metadataOwnershipWatch?.check() ?? Promise.resolve()
  }

  async stop(): Promise<void> {
    const transports = this.activeTransports
    this.activeTransports = []
    this.transports = []
    this.metadataOwnershipWatch?.stop()
    this.metadataOwnershipWatch = null
    const stopResults = await Promise.allSettled(
      transports.map(async (transport) => transport.stop())
    )
    const failedStop = stopResults.find((result) => result.status === 'rejected')
    if (failedStop?.status === 'rejected') {
      throw failedStop.reason
    }
    // Why: leave the metadata file on shutdown — shared userData may host another live runtime whose bootstrap file we'd erase.
  }
}
