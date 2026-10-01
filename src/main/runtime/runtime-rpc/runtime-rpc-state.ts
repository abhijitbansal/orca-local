import { randomBytes } from 'node:crypto'
import type { RuntimeTransportMetadata } from '../../../shared/runtime-bootstrap'
import type { OrcaRuntimeService } from '../orca-runtime'
import { RpcDispatcher } from '../rpc/dispatcher'
import { ALL_RPC_METHODS } from '../rpc/methods'
import type { RpcTransport } from '../rpc/transport'
import type { RuntimeMetadataOwnershipWatch } from '../runtime-metadata-ownership-watch'
import { RUNTIME_METADATA_OWNERSHIP_POLL_MS } from '../runtime-metadata-ownership-watch'
import {
  ASK_LONG_POLL_SHARE,
  BROWSER_HOST_LONG_POLL_SHARE,
  KEEPALIVE_INTERVAL_MS,
  LONG_POLL_CAP,
  SPECIALIZED_LONG_POLL_SHARE
} from './runtime-rpc-long-poll'
import type { OrcaRuntimeRpcServerOptions } from './runtime-rpc-pairing-types'

export class RuntimeRpcState {
  protected readonly runtime: OrcaRuntimeService
  protected readonly dispatcher: RpcDispatcher
  protected readonly userDataPath: string
  protected readonly pid: number
  protected readonly platform: NodeJS.Platform
  protected readonly authToken = randomBytes(24).toString('hex')
  protected readonly keepaliveIntervalMs: number
  protected readonly longPollCap: number
  protected readonly metadataOwnershipPollMs: number
  protected readonly askLongPollCap: number
  protected readonly browserHostLongPollCap: number
  protected readonly browserHostLongPollCapPerDevice: number
  protected readonly specializedLongPollCap: number
  protected activeTransports: RpcTransport[] = []
  protected transports: RuntimeTransportMetadata[] = []
  protected metadataOwnershipWatch: RuntimeMetadataOwnershipWatch | null = null
  // Why: separate from server.maxConnections — count only long-running dispatches, not short RPCs. See §3.1 + §7 risk #2.
  protected activeLongPolls = 0
  // Why: subset of activeLongPolls held by orchestration.ask, fenced by askLongPollCap.
  protected activeAskLongPolls = 0
  protected activeBrowserHostLongPolls = 0
  protected readonly activeBrowserHostLongPollsByDevice = new Map<string, number>()

  constructor({
    runtime,
    userDataPath,
    pid = process.pid,
    platform = process.platform,
    keepaliveIntervalMs = KEEPALIVE_INTERVAL_MS,
    longPollCap = LONG_POLL_CAP,
    metadataOwnershipPollMs = RUNTIME_METADATA_OWNERSHIP_POLL_MS,
    methods
  }: OrcaRuntimeRpcServerOptions) {
    this.runtime = runtime
    this.dispatcher = new RpcDispatcher({ runtime, methods: methods ?? ALL_RPC_METHODS })
    this.userDataPath = userDataPath
    this.pid = pid
    this.platform = platform
    this.keepaliveIntervalMs = keepaliveIntervalMs
    this.longPollCap = longPollCap
    this.metadataOwnershipPollMs = metadataOwnershipPollMs
    // Why: derived, not configurable — the reservation must hold for whatever cap a caller picks.
    this.askLongPollCap = Math.max(1, Math.floor(longPollCap * ASK_LONG_POLL_SHARE))
    this.browserHostLongPollCap = Math.max(
      1,
      Math.floor(longPollCap * BROWSER_HOST_LONG_POLL_SHARE)
    )
    this.browserHostLongPollCapPerDevice = Math.max(1, Math.floor(this.browserHostLongPollCap / 2))
    this.specializedLongPollCap = Math.max(1, Math.floor(longPollCap * SPECIALIZED_LONG_POLL_SHARE))
    this.runtime.configureNotificationDismissalStore(userDataPath)
  }
}
