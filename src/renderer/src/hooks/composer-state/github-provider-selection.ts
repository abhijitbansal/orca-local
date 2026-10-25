import type { GitHubWorkItem } from '../../../../shared/github/work-item-types'

// Local-only stub: GitHub work items are removed, so there is nothing to select.
export function useGitHubProviderSelection(_input: unknown) {
  return { handleSmartGitHubItemSelect: (_item: GitHubWorkItem): void => {} }
}
