import type { UISlice, UISliceGet, UISliceSet } from './ui-slice-contract'
import { findPrevLiveNonTaskStackHistoryIndex } from '../worktree-nav-history'
import { hasFeatureInteraction } from '../../../../../shared/feature-interactions'

export function createUiTaskActions(set: UISliceSet, get: UISliceGet): Partial<UISlice> {
  return {
    activeView: 'terminal',
    previousViewBeforeTasks: 'terminal',
    previousViewBeforeSettings: 'terminal',
    previousViewBeforeActivity: 'terminal',
    previousViewBeforeAutomations: 'terminal',
    previousViewBeforeSpace: 'terminal',
    previousViewBeforeSkills: 'terminal',
    setActiveView: (view) => set({ activeView: view }),
    taskPageData: {},
    taskResumeState: undefined,
    taskListPosition: null,
    githubTaskDrawerWorkItem: null,
    newWorkspaceDraft: null,
    openTaskPage: (data = {}, options = {}) => {
      if (options.recordTasksInteraction !== false) {
        const wasTasksPreviouslyInteracted = hasFeatureInteraction(
          get().featureInteractions,
          'tasks'
        )
        set((state) => ({
          contextualTourNavigationInteractionSnapshot: {
            ...state.contextualTourNavigationInteractionSnapshot,
            tasks: wasTasksPreviouslyInteracted
          }
        }))
        get().recordFeatureInteraction?.('tasks')
      }
      if (data.openGitHubWorkItem) {
        get().recordFeatureInteraction?.('github-tasks')
      }
      if (data.openGitLabWorkItem) {
        get().recordFeatureInteraction?.('gitlab-tasks')
      }
      if (data.openLinearIssue) {
        get().recordFeatureInteraction?.('linear-tasks')
      }
      if (data.openJiraIssue) {
        get().recordFeatureInteraction?.('jira-tasks')
      }
      // Why: record a Tasks visit in shared back/forward history; all task-source variants collapse to one deduped 'tasks' entry.
      const detailEntry = data.openGitHubWorkItem
        ? ({
            kind: 'task-detail',
            source: 'github',
            workItem: data.openGitHubWorkItem,
            sourceContext: data.openGitHubSourceContext,
            initialTab: data.openGitHubInitialTab
          } as const)
        : data.openGitLabWorkItem
          ? ({
              kind: 'task-detail',
              source: 'gitlab',
              workItem: data.openGitLabWorkItem,
              sourceContext: data.openGitLabSourceContext
            } as const)
          : data.openLinearIssue
            ? ({
                kind: 'task-detail',
                source: 'linear',
                issue: data.openLinearIssue,
                sourceContext: data.openLinearSourceContext
              } as const)
            : data.openJiraIssue
              ? ({
                  kind: 'task-detail',
                  source: 'jira',
                  issue: data.openJiraIssue,
                  sourceContext: data.openJiraSourceContext
                } as const)
              : null
      const currentEntry = get().worktreeNavHistory[get().worktreeNavHistoryIndex]
      const currentIsTaskStack =
        currentEntry === 'tasks' ||
        (typeof currentEntry === 'object' && currentEntry.kind === 'task-detail')
      if (!detailEntry || !currentIsTaskStack) {
        get().recordViewVisit('tasks')
      }
      if (detailEntry) {
        get().recordViewVisit(detailEntry)
      }
      set((state) => ({
        activeView: 'tasks',
        previousViewBeforeTasks:
          state.activeView === 'tasks' ? state.previousViewBeforeTasks : state.activeView,
        taskPageData: data
      }))
    },
    setTaskResumeState: (updates) =>
      set((s) => {
        const next = { ...s.taskResumeState, ...updates }
        window.api.ui.set({ taskResumeState: next }).catch(console.error)
        return { taskResumeState: next }
      }),
    setTaskListPosition: (taskListPosition) => set({ taskListPosition }),
    setGithubTaskDrawerWorkItem: (item) => set({ githubTaskDrawerWorkItem: item }),
    closeTaskPage: () =>
      set((state) => {
        // Why: if parked on a 'tasks' entry, rewind the history index so Back/Forward aren't no-ops; keep 0 if it's the only entry.
        const currentEntry = state.worktreeNavHistory[state.worktreeNavHistoryIndex]
        let nextHistoryIndex = state.worktreeNavHistoryIndex
        if (
          currentEntry === 'tasks' ||
          (typeof currentEntry === 'object' && currentEntry.kind === 'task-detail')
        ) {
          const prev = findPrevLiveNonTaskStackHistoryIndex(state)
          if (prev !== null) {
            nextHistoryIndex = prev
          } else if (typeof currentEntry === 'object' && state.worktreeNavHistory[0] === 'tasks') {
            nextHistoryIndex = 0
          }
        }
        return {
          activeView: state.previousViewBeforeTasks,
          taskPageData: {},
          githubTaskDrawerWorkItem: null,
          worktreeNavHistoryIndex: nextHistoryIndex
        }
      })
  }
}
