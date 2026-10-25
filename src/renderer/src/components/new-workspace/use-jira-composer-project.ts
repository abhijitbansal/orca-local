import type { JiraProjectReference } from '../../../../shared/jira/jira-project-reference'

const NO_JIRA_PROJECTS: JiraProjectReference[] = []
const NO_JIRA_PROJECT_INVENTORY = { projects: NO_JIRA_PROJECTS, loading: false }
const NO_JIRA_PROJECT: JiraProjectReference | null = null

// Local-only stub: no Jira projects exist to pick.
export function useJiraComposerProject(_repo: unknown, _source: unknown, _enabled: boolean) {
  return {
    jiraProject: NO_JIRA_PROJECT,
    jiraProjectInventory: NO_JIRA_PROJECT_INVENTORY,
    setJiraProject: (_next: JiraProjectReference | null): void => {}
  }
}
