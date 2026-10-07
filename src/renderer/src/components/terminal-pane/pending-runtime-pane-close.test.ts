import { expect, it } from 'vitest'
import { preparePendingRuntimeClose } from './pending-runtime-pane-close-test-fixture'

it('normal remount keeps the captured remote handle', async () => {
  const p = await preparePendingRuntimeClose()
  p.remote.detach?.()
  p.acceptCompatibility()
  await p.settle()
  expect(p.runtimeCall.mock.calls.map(([request]) => request.method)).not.toContain(
    'terminal.close'
  )
  expect(p.state.terminalLayoutsByTabId[p.tabId].ptyIdsByLeafId?.[p.leafId]).toBe(
    'remote:env-1@@term_original'
  )
})

it('protects a sibling legacy alias before issuing a compatibility request', async () => {
  const p = await preparePendingRuntimeClose()
  p.state.terminalLayoutsByTabId[p.tabId].ptyIdsByLeafId = {
    [p.leafId]: 'remote:env-1@@term_original',
    [p.siblingLeafId]: 'remote:term_original'
  }
  p.actions.executeClosePane(1)
  p.acceptCompatibility()
  await p.settle()
  expect(p.runtimeCall.mock.calls.map(([request]) => request.method)).toEqual([
    'terminal.resolvePane'
  ])
})

it.each(['ssh:host@@native-hint', 'remote:term_original', 'remote:env-2@@term_original'])(
  'refuses to infer close authority from %s',
  async (id) => {
    const p = await preparePendingRuntimeClose(id)
    p.actions.executeClosePane(1)
    p.acceptCompatibility()
    await p.settle()
    expect(p.runtimeCall.mock.calls.map(([request]) => request.method)).not.toContain(
      'terminal.close'
    )
    expect(window.api.pty.kill).not.toHaveBeenCalled()
  }
)
