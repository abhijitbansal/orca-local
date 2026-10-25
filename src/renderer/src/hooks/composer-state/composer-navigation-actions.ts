import type { ComposerModel } from './composer-model'

type ComposerNavigationActionsInput = Pick<
  ComposerModel,
  | 'closeModal'
  | 'creating'
  | 'folderPathStatusBlocksCreate'
  | 'folderTargetRequiresConnection'
  | 'openSettingsPage'
  | 'openSettingsTarget'
  | 'selectedProjectGroup'
  | 'setActiveRuntimeEnvironmentPreference'
  | 'smartNameJiraSourceContext'
  | 'sourceIntentBlocksCreate'
>

import { useCallback } from 'react'

export function useComposerNavigationActions(input: ComposerNavigationActionsInput) {
  const {
    closeModal,
    creating,
    folderPathStatusBlocksCreate,
    folderTargetRequiresConnection,
    openSettingsPage,
    openSettingsTarget,
    selectedProjectGroup,
    sourceIntentBlocksCreate
  } = input

  const handleOpenAgentSettings = useCallback((): void => {
    openSettingsTarget({ pane: 'agents', repoId: null })
    openSettingsPage()
    closeModal()
  }, [closeModal, openSettingsPage, openSettingsTarget])

  // Local-only: Jira is removed, so there are no integration settings to open.
  const handleOpenJiraSettings = useCallback((): void => {}, [])

  const folderCreateDisabled =
    creating ||
    sourceIntentBlocksCreate ||
    !selectedProjectGroup?.parentPath ||
    folderPathStatusBlocksCreate ||
    folderTargetRequiresConnection

  return {
    handleOpenAgentSettings,
    handleOpenJiraSettings,
    folderCreateDisabled
  }
}
