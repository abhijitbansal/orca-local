import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TerminalStreamOpcode,
  decodeTerminalStreamFrame,
  decodeTerminalStreamJson
} from '../../../../shared/terminal-stream-protocol'
import {
  createRemoteRuntimeTransportMocks,
  type MultiplexSubscriptionCallbacks
} from './remote-runtime-pty-transport-test-harness'

let subscriptionCallbacks: MultiplexSubscriptionCallbacks = null
let resolvedPaneHandle = 'terminal-1'

const {
  runtimeSubscribe,
  subscriptionSendBinary,
  emitMultiplexReady,
  latestSubscribePayload,
  emitOutput,
  emitSnapshot,
  latestFrameForOpcode,
  subscribeFrameCount,
  resetRemoteRuntimeTransport
} = createRemoteRuntimeTransportMocks({
  getCallbacks: () => subscriptionCallbacks,
  setCallbacks: (callbacks) => {
    subscriptionCallbacks = callbacks
  },
  getResolvedPaneHandle: () => resolvedPaneHandle,
  setResolvedPaneHandle: (handle) => {
    resolvedPaneHandle = handle
  }
})

describe('createRemoteRuntimePtyTransport', () => {
  beforeEach(() => {
    resetRemoteRuntimeTransport()
  })

  it('unsubscribes a remote terminal subscription that resolves after destroy', async () => {
    let resolveSubscribe: (value: {
      unsubscribe: () => void
      sendBinary: typeof subscriptionSendBinary
    }) => void = () => {}
    const unsubscribe = vi.fn()
    runtimeSubscribe.mockImplementation(
      (_args: unknown, callbacks: typeof subscriptionCallbacks) => {
        subscriptionCallbacks = callbacks
        return new Promise<{ unsubscribe: () => void; sendBinary: typeof subscriptionSendBinary }>(
          (resolve) => {
            resolveSubscribe = (value) => {
              resolve(value)
              queueMicrotask(emitMultiplexReady)
            }
          }
        )
      }
    )
    const { createRemoteRuntimePtyTransport } = await import('./remote-runtime-pty-transport')
    const transport = createRemoteRuntimePtyTransport('env-1', {
      worktreeId: 'wt-1',
      tabId: 'tab-1',
      leafId: 'pane:1'
    })

    const connect = transport.connect({ url: '', callbacks: {} })
    await vi.waitFor(() => {
      expect(runtimeSubscribe).toHaveBeenCalled()
    })
    transport.destroy?.()
    resolveSubscribe({ unsubscribe, sendBinary: subscriptionSendBinary })
    await connect

    expect(unsubscribe).toHaveBeenCalled()
    expect(transport.getPtyId()).toBeNull()
  })

  it('delivers cleaned remote data before deferred title, bell, and OSC 9999 handlers', async () => {
    const { createRemoteRuntimePtyTransport } = await import('./remote-runtime-pty-transport')
    const onData = vi.fn()
    const onTitleChange = vi.fn()
    const onBell = vi.fn()
    const onAgentStatus = vi.fn()
    const transport = createRemoteRuntimePtyTransport('env-1', {
      worktreeId: 'wt-1',
      onTitleChange,
      onBell,
      onAgentStatus
    })

    await transport.connect({ url: '', callbacks: { onData } })
    await vi.waitFor(() => expect(subscriptionSendBinary).toHaveBeenCalled())
    const { streamId } = latestSubscribePayload()
    emitOutput(
      streamId,
      'before\x1b]9999;{"state":"working","prompt":"ship it","agentType":"codex"}\x07after\x1b]0;. Claude working\x07\x07'
    )

    expect(onData).toHaveBeenCalledWith(
      'beforeafter\x1b]0;. Claude working\x07\x07',
      expect.objectContaining({ seq: 1 })
    )
    await vi.waitFor(() =>
      expect(onAgentStatus).toHaveBeenCalledWith({
        state: 'working',
        prompt: 'ship it',
        agentType: 'codex'
      })
    )
    expect(onTitleChange).toHaveBeenCalledWith('. Claude working', '. Claude working')
    expect(onBell).toHaveBeenCalledTimes(1)
  })

  it('processes binary remote data chunks through the terminal parser', async () => {
    const { createRemoteRuntimePtyTransport } = await import('./remote-runtime-pty-transport')
    const onData = vi.fn()
    const onTitleChange = vi.fn()
    const onBell = vi.fn()
    const onAgentStatus = vi.fn()
    const transport = createRemoteRuntimePtyTransport('env-1', {
      worktreeId: 'wt-1',
      onTitleChange,
      onBell,
      onAgentStatus
    })

    await transport.connect({ url: '', callbacks: { onData } })
    await vi.waitFor(() => expect(subscriptionSendBinary).toHaveBeenCalled())
    const { streamId } = latestSubscribePayload()
    emitOutput(
      streamId,
      'before\x1b]9999;{"state":"working","prompt":"ship it","agentType":"codex"}\x07after'
    )

    expect(onData).toHaveBeenCalledWith('beforeafter', expect.objectContaining({ seq: 1 }))
    await vi.waitFor(() =>
      expect(onAgentStatus).toHaveBeenCalledWith({
        state: 'working',
        prompt: 'ship it',
        agentType: 'codex'
      })
    )
  })

  it('resubscribes without surfacing a PTY error when the remote runtime subscription closes', async () => {
    const { createRemoteRuntimePtyTransport } = await import('./remote-runtime-pty-transport')
    const onExit = vi.fn()
    const onDisconnect = vi.fn()
    const onPtyExit = vi.fn()
    const onError = vi.fn()
    const transport = createRemoteRuntimePtyTransport('env-1', {
      worktreeId: 'wt-1',
      tabId: 'tab-1',
      leafId: 'pane:1',
      onPtyExit
    })

    await transport.connect({ url: '', callbacks: { onExit, onDisconnect, onError } })
    await vi.waitFor(() => expect(subscriptionSendBinary).toHaveBeenCalled())
    subscriptionCallbacks?.onClose?.()

    expect(onExit).not.toHaveBeenCalled()
    expect(onDisconnect).not.toHaveBeenCalled()
    expect(onPtyExit).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(runtimeSubscribe).toHaveBeenCalledTimes(2))
  })

  it('reapplies negotiated output pause across reconnect and resumes exact snapshot plus live data', async () => {
    const { createRemoteRuntimePtyTransport } = await import('./remote-runtime-pty-transport')
    const onReplayData = vi.fn()
    const onData = vi.fn()
    const onOutputPauseChanged = vi.fn()
    const transport = createRemoteRuntimePtyTransport('env-1', {
      worktreeId: 'wt-1',
      tabId: 'tab-1',
      leafId: 'pane:1'
    })

    await transport.connect({
      url: '',
      callbacks: { onData, onReplayData, onOutputPauseChanged }
    })
    await vi.waitFor(() => expect(subscriptionSendBinary).toHaveBeenCalled())
    expect(transport.setOutputPaused?.(true)).toBe(false)
    const firstStreamId = latestSubscribePayload().streamId
    emitSnapshot(firstStreamId, 'INITIAL_SNAPSHOT')
    subscriptionCallbacks?.onResponse({
      ok: true,
      result: {
        type: 'subscribed',
        streamId: firstStreamId,
        capabilities: { outputPause: 1 }
      }
    })
    await vi.waitFor(() =>
      expect(
        decodeTerminalStreamJson<{ paused?: boolean }>(
          latestFrameForOpcode(TerminalStreamOpcode.SetOutputPaused)!.payload
        )
      ).toEqual({ paused: true })
    )

    subscriptionCallbacks?.onClose?.()
    await vi.waitFor(() => expect(runtimeSubscribe).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(subscribeFrameCount()).toBe(2))
    const reconnectStreamId = latestSubscribePayload().streamId
    emitSnapshot(reconnectStreamId, 'RECONNECT_SNAPSHOT')
    subscriptionCallbacks?.onResponse({
      ok: true,
      result: {
        type: 'subscribed',
        streamId: reconnectStreamId,
        capabilities: { outputPause: 1 }
      }
    })
    await vi.waitFor(() =>
      expect(
        subscriptionSendBinary.mock.calls
          .map((call) => decodeTerminalStreamFrame(call[0]))
          .filter((frame) => frame?.opcode === TerminalStreamOpcode.SetOutputPaused)
          .map((frame) => decodeTerminalStreamJson<{ paused?: boolean }>(frame!.payload))
      ).toEqual([{ paused: true }, { paused: true }])
    )

    expect(transport.setOutputPaused?.(false)).toBe(true)
    emitOutput(reconnectStreamId, 'LIVE_AFTER_RECONNECT')
    expect(onReplayData.mock.calls.map((call) => call[0])).toEqual([
      'INITIAL_SNAPSHOT',
      'RECONNECT_SNAPSHOT'
    ])
    expect(onData.mock.calls.map((call) => call[0])).toEqual(['LIVE_AFTER_RECONNECT'])
    expect(onOutputPauseChanged).toHaveBeenLastCalledWith(false, true)
    transport.destroy?.()
  })

  it('re-arms the retained-buffer restore when a recovery subscribe replays no snapshot', async () => {
    const { createRemoteRuntimePtyTransport } = await import('./remote-runtime-pty-transport')
    const onReplayData = vi.fn()
    const onStreamRecovered = vi.fn()
    const onConnect = vi.fn()
    const transport = createRemoteRuntimePtyTransport('env-1', {
      worktreeId: 'wt-1',
      tabId: 'tab-1',
      leafId: 'pane:1'
    })

    await transport.connect({
      url: '',
      callbacks: { onReplayData, onStreamRecovered, onConnect }
    })
    await vi.waitFor(() => expect(subscriptionSendBinary).toHaveBeenCalled())
    const firstStreamId = latestSubscribePayload().streamId
    emitSnapshot(firstStreamId, 'INITIAL_SNAPSHOT')
    subscriptionCallbacks?.onResponse({
      ok: true,
      result: {
        type: 'subscribed',
        streamId: firstStreamId,
        capabilities: { outputPause: 1 }
      }
    })
    await vi.waitFor(() => expect(onConnect).toHaveBeenCalledTimes(1))
    // The first subscribe already carries the host snapshot; re-arming there would cost
    // every pane a redundant restore request on open.
    expect(onStreamRecovered).not.toHaveBeenCalled()

    subscriptionCallbacks?.onClose?.()
    await vi.waitFor(() => expect(runtimeSubscribe).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(subscribeFrameCount()).toBe(2))
    const reconnectStreamId = latestSubscribePayload().streamId
    // An exited-but-preserved pane has nothing to push and will never emit live bytes,
    // so without the re-arm the pane stays blank until a visibility flip.
    emitSnapshot(reconnectStreamId, '')
    subscriptionCallbacks?.onResponse({
      ok: true,
      result: {
        type: 'subscribed',
        streamId: reconnectStreamId,
        capabilities: { outputPause: 1 }
      }
    })

    await vi.waitFor(() => expect(onStreamRecovered).toHaveBeenCalledTimes(1))
    expect(onReplayData.mock.calls.map((call) => call[0])).toEqual(['INITIAL_SNAPSHOT'])

    subscriptionCallbacks?.onClose?.()
    await vi.waitFor(() => expect(runtimeSubscribe).toHaveBeenCalledTimes(3))
    await vi.waitFor(() => expect(subscribeFrameCount()).toBe(3))
    const populatedReconnectStreamId = latestSubscribePayload().streamId
    emitSnapshot(populatedReconnectStreamId, 'RECOVERY_SNAPSHOT')
    subscriptionCallbacks?.onResponse({
      ok: true,
      result: {
        type: 'subscribed',
        streamId: populatedReconnectStreamId,
        capabilities: { outputPause: 1 }
      }
    })

    await vi.waitFor(() => expect(onConnect).toHaveBeenCalledTimes(3))
    expect(onStreamRecovered).toHaveBeenCalledTimes(1)
    expect(onReplayData.mock.calls.map((call) => call[0])).toEqual([
      'INITIAL_SNAPSHOT',
      'RECOVERY_SNAPSHOT'
    ])
    transport.destroy?.()
  })

  it('backs off before retrying a capacity-rejected terminal stream', async () => {
    vi.useFakeTimers()
    try {
      const { createRemoteRuntimePtyTransport } = await import('./remote-runtime-pty-transport')
      const transport = createRemoteRuntimePtyTransport('env-1', {
        worktreeId: 'wt-1',
        tabId: 'tab-1',
        leafId: 'pane:1'
      })

      await transport.connect({ url: '', callbacks: {} })
      await vi.waitFor(() => expect(subscriptionSendBinary).toHaveBeenCalled())
      const { streamId } = latestSubscribePayload()
      subscriptionCallbacks?.onResponse({
        ok: true,
        result: {
          type: 'error',
          streamId,
          message: 'terminal_stream_limit_exceeded'
        }
      })
      subscriptionCallbacks?.onResponse({
        ok: true,
        result: { type: 'end', streamId }
      })

      expect(transport.getRecoveryState?.().phase).toBe('backoff')
      expect(runtimeSubscribe).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(249)
      expect(runtimeSubscribe).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      await vi.waitFor(() => expect(runtimeSubscribe).toHaveBeenCalledTimes(2))
      transport.destroy?.()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps retrying when the first post-partition terminal reattach fails', async () => {
    let subscribeAttempt = 0
    const recoveryPhases: string[] = []
    const transportCallbacks: NonNullable<typeof subscriptionCallbacks>[] = []
    runtimeSubscribe.mockImplementation(
      async (_args: unknown, callbacks: NonNullable<typeof subscriptionCallbacks>) => {
        subscribeAttempt += 1
        transportCallbacks.push(callbacks)
        subscriptionCallbacks = callbacks
        if (subscribeAttempt === 2) {
          throw new Error('Could not connect to the remote Orca runtime.')
        }
        queueMicrotask(emitMultiplexReady)
        return { unsubscribe: vi.fn(), sendBinary: subscriptionSendBinary }
      }
    )
    const { createRemoteRuntimePtyTransport } = await import('./remote-runtime-pty-transport')
    const onError = vi.fn()
    const transport = createRemoteRuntimePtyTransport('env-1', {
      worktreeId: 'wt-1',
      tabId: 'tab-1',
      leafId: 'pane:1'
    })

    await transport.connect({
      url: '',
      callbacks: {
        onError,
        onRecoveryStateChange: (state) => recoveryPhases.push(state.phase)
      }
    })
    transportCallbacks[0].onError?.({
      code: 'remote_runtime_unavailable',
      message: 'Remote Orca runtime stopped responding; the stream connection was reset.'
    })

    await vi.waitFor(() => expect(runtimeSubscribe).toHaveBeenCalledTimes(3))
    expect(onError).not.toHaveBeenCalled()
    expect(recoveryPhases).toContain('backoff')
    transport.destroy?.()
  })

  it('surfaces fatal transport errors once without retrying or double-unsubscribing', async () => {
    const unsubscribe = vi.fn()
    runtimeSubscribe.mockImplementation(
      async (_args: unknown, callbacks: NonNullable<typeof subscriptionCallbacks>) => {
        subscriptionCallbacks = callbacks
        queueMicrotask(emitMultiplexReady)
        return { unsubscribe, sendBinary: subscriptionSendBinary }
      }
    )
    const { createRemoteRuntimePtyTransport } = await import('./remote-runtime-pty-transport')
    const onError = vi.fn()
    const transport = createRemoteRuntimePtyTransport('env-1', { worktreeId: 'wt-1' })
    await transport.connect({ url: '', callbacks: { onError } })

    subscriptionCallbacks?.onError?.({
      code: 'unauthorized',
      message: 'Remote Orca runtime rejected the pairing token.'
    })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(runtimeSubscribe).toHaveBeenCalledTimes(1)
    expect(transport.isConnected()).toBe(false)
    transport.destroy?.()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('releases pending claimed input when reconnect subscription fails', async () => {
    const { createRemoteRuntimePtyTransport } = await import('./remote-runtime-pty-transport')
    const onError = vi.fn()
    const transport = createRemoteRuntimePtyTransport('env-1', {
      worktreeId: 'wt-1',
      tabId: 'tab-1',
      leafId: 'pane:1'
    })
    await transport.connect({ url: '', callbacks: { onError } })
    let rejectReconnect = (_error: Error): void => {}
    runtimeSubscribe.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectReconnect = reject
        })
    )

    subscriptionCallbacks?.onClose?.()
    await vi.waitFor(() => expect(runtimeSubscribe).toHaveBeenCalledTimes(2))
    expect(transport.claimViewport?.(101, 33)).toBe(true)
    const accepted = transport.sendInputAccepted?.('\x03', 'driving')
    await Promise.resolve()
    rejectReconnect(new Error('reconnect failed'))

    await expect(accepted).resolves.toBe(false)
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith('reconnect failed'))
  })

  it('releases pending claimed input when the remote terminal ends', async () => {
    const { createRemoteRuntimePtyTransport } = await import('./remote-runtime-pty-transport')
    const transport = createRemoteRuntimePtyTransport('env-1', {
      worktreeId: 'wt-1',
      tabId: 'tab-1',
      leafId: 'pane:1'
    })
    await transport.connect({ url: '', callbacks: {} })
    const { streamId } = latestSubscribePayload()

    expect(transport.claimViewport?.(101, 33)).toBe(true)
    const accepted = transport.sendInputAccepted?.('x', 'driving')
    subscriptionCallbacks?.onResponse({
      ok: true,
      result: { type: 'end', streamId }
    })

    await expect(accepted).resolves.toBe(false)
  })

  it('retries when a replacement transport closes before its stream installs', async () => {
    const transportCallbacks: NonNullable<typeof subscriptionCallbacks>[] = []
    runtimeSubscribe.mockImplementation(
      async (_args: unknown, callbacks: NonNullable<typeof subscriptionCallbacks>) => {
        transportCallbacks.push(callbacks)
        subscriptionCallbacks = callbacks
        return { unsubscribe: vi.fn(), sendBinary: subscriptionSendBinary }
      }
    )
    const { createRemoteRuntimePtyTransport } = await import('./remote-runtime-pty-transport')
    const transport = createRemoteRuntimePtyTransport('env-1', {
      worktreeId: 'wt-1',
      tabId: 'tab-1',
      leafId: 'pane:1'
    })
    const connected = transport.connect({ url: '', callbacks: {} })
    await vi.waitFor(() => expect(transportCallbacks).toHaveLength(1))
    transportCallbacks[0].onResponse({ ok: true, result: { type: 'ready' } })
    await connected

    transportCallbacks[0].onClose?.()
    await vi.waitFor(() => expect(transportCallbacks).toHaveLength(2))
    transportCallbacks[1].onResponse({ ok: true, result: { type: 'ready' } })
    transportCallbacks[1].onClose?.()

    await vi.waitFor(() => expect(transportCallbacks).toHaveLength(3))
    transport.destroy?.()
  })
})
