import type { GitLabWorkItem } from '../../../../shared/gitlab-types'

// Local-only stub: GitLab work items are removed, so there is nothing to select.
export function useGitLabProviderSelection(_input: unknown) {
  return { handleSmartGitLabItemSelect: (_item: GitLabWorkItem): void => {} }
}
