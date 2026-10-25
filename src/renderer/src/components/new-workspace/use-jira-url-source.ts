import type { JiraIssue, JiraSite } from '../../../../shared/jira/jira-types'
import type { TaskSourceContext } from '../../../../shared/task-source-context'

export type JiraUrlSourceState = {
  intent: boolean
  loading: boolean
  issue: JiraIssue | null
  boundSourceContext: TaskSourceContext | null
  accountChoices: JiraSite[]
  errorKind: 'disconnected' | 'site-not-connected' | 'read-failed' | 'update-runtime' | null
  selectAccount: (siteId: string) => void
  retry: () => void
}

const NO_JIRA_URL_SOURCE: JiraUrlSourceState = {
  intent: false,
  loading: false,
  issue: null,
  boundSourceContext: null,
  accountChoices: [],
  errorKind: null,
  selectAccount: () => {},
  retry: () => {}
}

// Local-only stub: Jira URLs are never resolved.
export function useJiraUrlSource(_args: unknown): JiraUrlSourceState {
  return NO_JIRA_URL_SOURCE
}

export function bindJiraIssueSourceContext(
  source: TaskSourceContext,
  _site: JiraSite,
  _issue: JiraIssue
): TaskSourceContext {
  return source
}
