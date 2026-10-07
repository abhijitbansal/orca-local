import { useTranslation } from 'react-i18next'
import {
  EMPTY_REPO_SEARCH_REPOS,
  type NormalizedSmartWorkspaceNameFieldProps,
  type SmartWorkspaceNameFieldProps
} from './smart-workspace-name-field-model'
import { getSmartWorkspaceNameFieldCopy } from './smart-workspace-name-field-copy'
import { useSmartWorkspaceNameFieldActions } from './use-smart-workspace-name-field-actions'
import { useSmartWorkspaceNameFieldFoundation } from './use-smart-workspace-name-field-foundation'
import { useSmartWorkspaceNameFieldPresentation } from './use-smart-workspace-name-field-presentation'
import { useSmartWorkspaceSecondarySearches } from './use-smart-workspace-secondary-searches'

export function useSmartWorkspaceNameFieldController({
  jiraSourceContext = null,
  disabled = false,
  textOnly = false,
  branchesEnabled = true,
  repoBackedSourcesDisabled = false,
  repoBackedSearchRepos = EMPTY_REPO_SEARCH_REPOS,
  allowCrossRepoProjectAdd = true,
  crossRepoSwitchTarget = 'project',
  ...props
}: SmartWorkspaceNameFieldProps) {
  // Why: translate()-based options must refresh on language changes without remounting.
  useTranslation()
  const normalizedProps: NormalizedSmartWorkspaceNameFieldProps = {
    ...props,
    jiraSourceContext,
    disabled,
    textOnly,
    branchesEnabled,
    repoBackedSourcesDisabled,
    repoBackedSearchRepos,
    allowCrossRepoProjectAdd,
    crossRepoSwitchTarget
  }
  const foundation = useSmartWorkspaceNameFieldFoundation(normalizedProps)
  useSmartWorkspaceSecondarySearches({ foundation })
  const presentation = useSmartWorkspaceNameFieldPresentation(foundation, {
    linearUrlIntent: null,
    linearUrlIntentOwnsInput: false,
    linearQuery: foundation.debouncedQuery
  })
  const actions = useSmartWorkspaceNameFieldActions(foundation, presentation)
  const copy = getSmartWorkspaceNameFieldCopy({
    repoBackedSourcesDisabled,
    linearAvailable: foundation.linearAvailable,
    branchesEnabled,
    crossRepoSwitchTarget,
    disabled,
    disabledPlaceholder: props.disabledPlaceholder,
    mode: foundation.mode
  })

  return {
    ...foundation,
    ...presentation,
    ...actions,
    ...copy,
    linearStatusId: foundation.linearStatusId
  }
}

export type SmartWorkspaceNameFieldController = ReturnType<
  typeof useSmartWorkspaceNameFieldController
>
