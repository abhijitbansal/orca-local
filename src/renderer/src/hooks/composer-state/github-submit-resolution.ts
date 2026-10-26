import type { PendingSmartGitHubSubmitResolution } from './source-selection-decisions'

const NO_PENDING_SUBMIT: PendingSmartGitHubSubmitResolution = { kind: 'none' }

// Local-only stub: GitHub items are removed, so a submit never carries a pending resolution.
export function useGitHubSubmitResolution(_input: unknown) {
  return {
    resolvePendingSmartGitHubSubmit: async (): Promise<PendingSmartGitHubSubmitResolution> =>
      NO_PENDING_SUBMIT
  }
}
