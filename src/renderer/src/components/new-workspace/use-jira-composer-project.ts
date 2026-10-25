import type { JiraProjectReference } from '../../../../shared/jira/jira-project-reference'

const NO_JIRA_PROJECT_INVENTORY = { projects: [] as JiraProjectReference[], loading: false }

// Local-only stub: no Jira projects exist to pick.
export function useJiraComposerProject(_repo: unknown, _source: unknown, _enabled: boolean) {
  return {
    jiraProject: null as JiraProjectReference | null,
    jiraProjectInventory: NO_JIRA_PROJECT_INVENTORY,
    setJiraProject: (_next: JiraProjectReference | null): void => {}
  }
}
