import type { BrowserClientHostedPageInventory } from '../../shared/browser-client-host-protocol'

type BrowserClientPageAuthority = Pick<
  BrowserClientHostedPageInventory,
  | 'authorityRuntimeId'
  | 'authorityEpoch'
  | 'browserHostClientId'
  | 'browserHostGeneration'
  | 'pageHostGeneration'
>

export function sameBrowserClientPageAuthority(
  left: BrowserClientPageAuthority,
  right: BrowserClientPageAuthority
): boolean {
  return (
    left.authorityRuntimeId === right.authorityRuntimeId &&
    left.authorityEpoch === right.authorityEpoch &&
    left.browserHostClientId === right.browserHostClientId &&
    left.browserHostGeneration === right.browserHostGeneration &&
    left.pageHostGeneration === right.pageHostGeneration
  )
}
