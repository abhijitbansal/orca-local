import React, { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { getLocalPreflightContext, localPreflightContextKey } from '@/lib/local-preflight-context'
import { buildTaskSourceContextFromRepo } from '../../../../shared/task-source-context'
import type {
  NormalizedWorkItemSourceSearchProps,
  RepoBackedSearchTarget
} from './smart-workspace-name-field-model'
import { useJiraSourceConnection } from './use-jira-source-connection'
import { useJiraUrlSource } from './use-jira-url-source'
import { useLinearSourceConnection } from './use-linear-source-connection'
import { useSmartWorkspaceFieldAvailability } from './use-smart-workspace-field-availability'
import { useWorkItemSourceState } from './use-work-item-source-state'
import { useJiraComposerProject } from './use-jira-composer-project'

export function useWorkItemSourceFoundation(props: NormalizedWorkItemSourceSearchProps) {
  const {
    repos,
    repoId,
    githubSourceContext: githubSourceContextOverride,
    repoBackedSearchRepos,
    textOnly,
    value,
    disabled,
    jiraSourceContext,
    sourceSelected
  } = props
  const {
    preflightStatusChecked,
    preflightStatusContextKey,
    expectedPreflightContextKey,
    refreshPreflightStatus
  } = useAppStore(
    useShallow((s) => ({
      preflightStatusChecked: s.preflightStatusChecked,
      preflightStatusContextKey: s.preflightStatusContextKey,
      expectedPreflightContextKey: localPreflightContextKey(getLocalPreflightContext(s)),
      refreshPreflightStatus: s.refreshPreflightStatus
    }))
  )
  // Local-only: provider stores are removed, so provider lookups are inert.
  const checkLinearConnection = async (): Promise<void> => {}
  const fetchWorkItems = async (): Promise<never[]> => []
  const fetchWorkItemsAcrossRepos = async (): Promise<never[]> => []
  const fetchLinearIssue = async (): Promise<null> => null
  const getCachedWorkItems = (): null => null
  const defaultLinearStatus = { connected: false, viewer: null }
  const defaultLinearStatusChecked = true
  const listLinearIssues = async (): Promise<never[]> => []
  const searchJiraIssues = async (): Promise<never[]> => []
  const searchLinearIssues = async (): Promise<never[]> => []
  const selectedRepo = useMemo(
    () =>
      props.selectedRepo !== undefined
        ? props.selectedRepo
        : (repos.find((repo) => repo.id === repoId) ?? null),
    [props.selectedRepo, repoId, repos]
  )
  const githubSourceContext = useMemo(() => {
    if (githubSourceContextOverride?.provider === 'github') {
      return githubSourceContextOverride
    }
    return selectedRepo
      ? buildTaskSourceContextFromRepo({
          provider: 'github',
          projectId: selectedRepo.id,
          repo: selectedRepo
        })
      : null
  }, [githubSourceContextOverride, selectedRepo])
  const gitlabSourceContext = useMemo(
    () =>
      props.gitlabSourceContext?.provider === 'gitlab'
        ? props.gitlabSourceContext
        : selectedRepo
          ? buildTaskSourceContextFromRepo({
              provider: 'gitlab',
              projectId: selectedRepo.id,
              repo: selectedRepo
            })
          : null,
    [props.gitlabSourceContext, selectedRepo]
  )
  const repoBackedSearchTargets = useMemo<RepoBackedSearchTarget[]>(
    () =>
      (repoBackedSearchRepos.length > 0
        ? repoBackedSearchRepos
        : selectedRepo
          ? [selectedRepo]
          : []
      ).map((repo) => ({
        repo,
        githubSourceContext:
          repo.id === selectedRepo?.id && githubSourceContext?.provider === 'github'
            ? githubSourceContext
            : buildTaskSourceContextFromRepo({
                provider: 'github',
                projectId: repo.id,
                repo
              }),
        gitlabSourceContext:
          repo.id === selectedRepo?.id && gitlabSourceContext?.provider === 'gitlab'
            ? gitlabSourceContext
            : buildTaskSourceContextFromRepo({
                provider: 'gitlab',
                projectId: repo.id,
                repo
              })
      })),
    [githubSourceContext, gitlabSourceContext, repoBackedSearchRepos, selectedRepo]
  )
  const linearSourceContext = useMemo(
    () =>
      props.linearSourceContext?.provider === 'linear'
        ? props.linearSourceContext
        : selectedRepo
          ? buildTaskSourceContextFromRepo({
              provider: 'linear',
              projectId: selectedRepo.id,
              repo: selectedRepo
            })
          : null,
    [props.linearSourceContext, selectedRepo]
  )
  const state = useWorkItemSourceState(textOnly, value)
  // Why: Linear's status must come from the host the search runs on, not the focused one (#32924).
  const hasLinearSearchSource = linearSourceContext !== null
  const linearConnection = useLinearSourceConnection({
    enabled: hasLinearSearchSource && !disabled && !textOnly,
    sourceContext: linearSourceContext
  })
  const linearStatus = hasLinearSearchSource
    ? (linearConnection.status ?? { connected: false, viewer: null })
    : defaultLinearStatus
  const linearStatusChecked = hasLinearSearchSource
    ? linearConnection.loaded
    : defaultLinearStatusChecked
  const jiraConnection = useJiraSourceConnection({
    enabled: !disabled && !textOnly && jiraSourceContext !== null,
    sourceContext: jiraSourceContext
  })
  const jiraConnectionStatus = jiraConnection.status
  const jiraSource = useJiraUrlSource({
    value,
    enabled:
      !disabled &&
      !textOnly &&
      (state.mode === 'smart' || state.mode === 'jira') &&
      !sourceSelected,
    sourceContext: jiraSourceContext,
    connection: jiraConnection
  })
  const jiraSourceConnected = jiraConnectionStatus?.connected === true
  const jiraProject = useJiraComposerProject(
    selectedRepo,
    jiraSourceContext,
    !disabled && !textOnly && state.mode === 'jira'
  )
  const showJiraSiteContext =
    state.mode === 'jira' && jiraConnectionStatus?.selectedSiteId === 'all'
  const jiraStatusId = React.useId()
  const linearStatusId = React.useId()
  const availability = useSmartWorkspaceFieldAvailability({
    props,
    state,
    repoBackedSearchTargets,
    preflightStatus: null,
    preflightStatusChecked,
    preflightStatusContextKey,
    expectedPreflightContextKey,
    refreshPreflightStatus,
    linearStatus,
    // A host-scoped source loads independently instead of refreshing the focused runtime's store.
    linearStatusChecked: hasLinearSearchSource || linearStatusChecked,
    linearStatusPending: hasLinearSearchSource && !linearConnection.loaded,
    checkLinearConnection,
    jiraSourceConnected
  })

  return {
    ...props,
    ...state,
    ...availability,
    fetchWorkItems,
    fetchWorkItemsAcrossRepos,
    fetchLinearIssue,
    getCachedWorkItems,
    linearStatus,
    linearStatusChecked,
    linearWorkspaceIdOverride: undefined,
    listLinearIssues,
    searchJiraIssues,
    searchLinearIssues,
    selectedRepo,
    githubSourceContext,
    gitlabSourceContext,
    repoBackedSearchTargets,
    linearSourceContext,
    jiraConnectionStatus,
    jiraSource,
    jiraSourceConnected,
    ...jiraProject,
    showJiraSiteContext,
    jiraStatusId,
    linearStatusId
  }
}
