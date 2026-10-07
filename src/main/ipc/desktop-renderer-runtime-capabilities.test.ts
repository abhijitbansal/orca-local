/** The desktop renderer must pass the host gates of its own main process (`agent.launch` first). */

import { describe, expect, it } from 'vitest'
import { AGENT_LAUNCH_RUNTIME_CAPABILITY } from '../../shared/protocol-version'
import { supportsAgentLaunch } from '../runtime/rpc/methods/agent-launch'
import { DESKTOP_RENDERER_RUNTIME_CLIENT_CAPABILITIES } from './desktop-renderer-runtime-capabilities'

describe('desktop renderer runtime client capabilities', () => {
  it('passes the host gate that refuses agent.launch', () => {
    const renderer = {
      clientKind: 'runtime',
      clientCapabilities: DESKTOP_RENDERER_RUNTIME_CLIENT_CAPABILITIES
    } as const
    expect(supportsAgentLaunch(renderer)).toBe(true)
    // Negative control: the gate really discriminates, so the assertion above is not vacuous.
    expect(
      supportsAgentLaunch({
        clientKind: 'runtime',
        clientCapabilities: DESKTOP_RENDERER_RUNTIME_CLIENT_CAPABILITIES.filter(
          (capability) => capability !== AGENT_LAUNCH_RUNTIME_CAPABILITY
        )
      })
    ).toBe(false)
  })
})
