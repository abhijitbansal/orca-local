import type { GlobalSettings } from '../../../shared/global-settings-types'
import { isRuntimeOwnedSshTargetId, parseExecutionHostId } from '../../../shared/execution-host'
import type { PublicKnownRuntimeEnvironment } from '../../../shared/runtime-environments'

type SshBrowserRoutingSettings = Pick<
  GlobalSettings,
  'browserSshWorkspaceRoutingEnabled' | 'browserSshWorkspaceRoutingDisabledTargetIds'
>

export type SshWorkspaceBrowserRouteEligibility = {
  targetId: string
  eligible: boolean
  expectedSshTargetGeneration?: number
}

export function resolveSshWorkspaceBrowserRouteEligibility(
  executionHostId: string | null | undefined,
  settings: SshBrowserRoutingSettings | null | undefined,
  _environments?: readonly Pick<PublicKnownRuntimeEnvironment, 'id'>[]
): SshWorkspaceBrowserRouteEligibility | null {
  const parsed = parseExecutionHostId(executionHostId)
  const targetId = parsed?.kind === 'ssh' ? parsed.targetId : undefined
  // Why: runtime-owned ephemeral SSH targets belong to the paired runtime's browser route.
  if (!targetId || isRuntimeOwnedSshTargetId(targetId)) {
    return null
  }
  return {
    targetId,
    eligible:
      settings?.browserSshWorkspaceRoutingEnabled !== false &&
      !settings?.browserSshWorkspaceRoutingDisabledTargetIds?.includes(targetId)
  }
}
