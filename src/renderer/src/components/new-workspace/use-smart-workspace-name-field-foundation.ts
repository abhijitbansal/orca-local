import React, { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { getRepoOwnerRoutedSettings } from '@/lib/repo-runtime-owner'
import { buildTaskSourceContextFromRepo } from '../../../../shared/task-source-context'
import {
  NO_JIRA_URL_SOURCE,
  type NormalizedSmartWorkspaceNameFieldProps,
  type RepoBackedSearchTarget
} from './smart-workspace-name-field-model'
import { useSmartWorkspaceFieldAvailability } from './use-smart-workspace-field-availability'
import { useSmartWorkspaceNameFieldState } from './use-smart-workspace-name-field-state'

export function useSmartWorkspaceNameFieldFoundation(
  props: NormalizedSmartWorkspaceNameFieldProps
) {
  const {
    repos,
    repoId,
    githubSourceContext: githubSourceContextOverride,
    repoBackedSearchRepos,
    textOnly,
    value
  } = props
  const { addRepo, settings } = useAppStore(
    useShallow((s) => ({
      addRepo: s.addRepo,
      settings: s.settings
    }))
  )
  const selectedRepo = useMemo(
    () => repos.find((repo) => repo.id === repoId) ?? null,
    [repoId, repos]
  )
  const selectedRepoOwnerSettings = useMemo(
    () => getRepoOwnerRoutedSettings(settings, selectedRepo),
    [selectedRepo, settings]
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
      selectedRepo
        ? buildTaskSourceContextFromRepo({
            provider: 'gitlab',
            projectId: selectedRepo.id,
            repo: selectedRepo
          })
        : null,
    [selectedRepo]
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
  const state = useSmartWorkspaceNameFieldState(textOnly, value)
  const jiraStatusId = React.useId()
  const linearStatusId = React.useId()
  const availability = useSmartWorkspaceFieldAvailability({ props, state })

  return {
    ...props,
    ...state,
    ...availability,
    addRepo,
    selectedRepo,
    selectedRepoOwnerSettings,
    githubSourceContext,
    repoBackedSearchTargets,
    jiraSource: NO_JIRA_URL_SOURCE,
    jiraStatusId,
    linearStatusId
  }
}
