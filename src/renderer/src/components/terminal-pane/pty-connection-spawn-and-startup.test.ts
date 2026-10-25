import { describe } from 'vitest'
import { registerPtyConnectionPendingSpawnTests } from './pty-connection-pending-spawn.spec'
import { registerPtyConnectionSplitSpawnTests } from './pty-connection-split-spawn.spec'
import { registerPtyConnectionStartupCommandDeliveryTests } from './pty-connection-startup-command-delivery.spec'
import { registerPtyConnectionStartupDraftDeliveryTests } from './pty-connection-startup-draft-delivery.spec'
import { registerPtyConnectionDeliberateSleepGuardTests } from './pty-connection-deliberate-sleep-guard.spec'

describe('pty-connection-pending-spawn', registerPtyConnectionPendingSpawnTests)
describe('pty-connection-split-spawn', registerPtyConnectionSplitSpawnTests)
describe(
  'pty-connection-startup-command-delivery',
  registerPtyConnectionStartupCommandDeliveryTests
)
describe('pty-connection-startup-draft-delivery', registerPtyConnectionStartupDraftDeliveryTests)
describe('pty-connection-deliberate-sleep-guard', registerPtyConnectionDeliberateSleepGuardTests)
