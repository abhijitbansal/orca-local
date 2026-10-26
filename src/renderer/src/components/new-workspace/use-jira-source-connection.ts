import type { JiraSite } from '../../../../shared/jira/jira-types'

export type JiraSourceConnection = {
  status: {
    connected: boolean
    sites?: JiraSite[]
    selectedSiteId?: string | null
    activeSiteId?: string | null
  } | null
  loaded: boolean
}

const NO_JIRA_CONNECTION: JiraSourceConnection = { status: null, loaded: true }

// Local-only stub: Jira is removed, so there is never a connection to read.
export function useJiraSourceConnection(_args: unknown): JiraSourceConnection {
  return NO_JIRA_CONNECTION
}
