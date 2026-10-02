import { describe, expect, it } from 'vitest'
import {
  NOTIFICATIONS_REMOTE_PUSH_RUNTIME_CAPABILITY,
  REMOTE_SERVER_UPDATE_CAPABILITY,
  RUNTIME_CAPABILITIES
} from './protocol-version'

describe('host-advertised runtime capabilities', () => {
  it('does not advertise capabilities whose RPC methods were removed', () => {
    const advertised: readonly string[] = RUNTIME_CAPABILITIES
    expect(advertised).not.toContain(REMOTE_SERVER_UPDATE_CAPABILITY)
    expect(advertised).not.toContain(NOTIFICATIONS_REMOTE_PUSH_RUNTIME_CAPABILITY)
  })
})
