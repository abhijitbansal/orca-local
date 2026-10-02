import { useEffect } from 'react'
import { getMrStateFilters, getSmartWorkspaceNameModes } from './smart-workspace-localized-options'
import {
  SEARCH_DEBOUNCE_MS,
  type NormalizedSmartWorkspaceNameFieldProps
} from './smart-workspace-name-field-model'
import { useSmartWorkspaceFieldFocusControls } from './use-smart-workspace-field-focus-controls'
import type { useSmartWorkspaceNameFieldState } from './use-smart-workspace-name-field-state'

type FieldState = ReturnType<typeof useSmartWorkspaceNameFieldState>

export function useSmartWorkspaceFieldAvailability({
  props,
  state
}: {
  props: NormalizedSmartWorkspaceNameFieldProps
  state: FieldState
}) {
  const {
    disabled,
    textOnly,
    repoBackedSourcesDisabled,
    branchesEnabled,
    onActiveSourceModeChange,
    value
  } = props
  const {
    mode,
    setMode,
    setOpen,
    setGithubItems,
    setGitlabItems,
    setBranches,
    setGithubLoading,
    setGitlabLoading,
    setBranchesLoading,
    setBranchResultsSource,
    setLinearIssues,
    setJiraIssues,
    setLinearLoading,
    setJiraLoading,
    setCommandValue,
    setDebouncedQuery
  } = state

  useEffect(() => {
    onActiveSourceModeChange?.(mode)
  }, [mode, onActiveSourceModeChange])
  // Why: no forge or tracker integration remains, so only the name and branch sources are available.
  const gitlabSourceAvailable = false
  const linearAvailable = false
  const availableModes = getSmartWorkspaceNameModes().filter((item) => {
    if (textOnly) {
      return item.id === 'text'
    }
    if (
      item.id === 'github' ||
      item.id === 'gitlab' ||
      item.id === 'linear' ||
      item.id === 'jira'
    ) {
      return false
    }
    if (item.id === 'branches') {
      return branchesEnabled && !repoBackedSourcesDisabled
    }
    return true
  })
  const mrStateFilters = getMrStateFilters()

  useEffect(() => {
    if (availableModes.some((item) => item.id === mode)) {
      return
    }
    setMode(availableModes[0]?.id ?? 'text')
  }, [availableModes, mode, setMode])

  useEffect(() => {
    if (!repoBackedSourcesDisabled) {
      return
    }
    setGithubItems([])
    setGitlabItems([])
    setBranches([])
    setGithubLoading(false)
    setGitlabLoading(false)
    setBranchesLoading(false)
    setBranchResultsSource(null)
  }, [
    repoBackedSourcesDisabled,
    setBranches,
    setBranchesLoading,
    setBranchResultsSource,
    setGithubItems,
    setGithubLoading,
    setGitlabItems,
    setGitlabLoading
  ])

  const focusControls = useSmartWorkspaceFieldFocusControls({ props, state })

  useEffect(() => {
    if (textOnly) {
      if (mode !== 'text') {
        setMode('text')
      }
      setOpen(false)
      return
    }
    if (mode !== 'gitlab' && mode !== 'linear') {
      return
    }
    setMode('smart')
    setGitlabItems([])
    setLinearIssues([])
    setJiraIssues([])
    setGitlabLoading(false)
    setLinearLoading(false)
    setJiraLoading(false)
    setCommandValue('')
  }, [
    mode,
    setCommandValue,
    setGitlabItems,
    setGitlabLoading,
    setJiraIssues,
    setJiraLoading,
    setLinearIssues,
    setLinearLoading,
    setMode,
    setOpen,
    textOnly
  ])

  useEffect(() => {
    if (!disabled) {
      return
    }
    setOpen(false)
    setGithubItems([])
    setGitlabItems([])
    setBranches([])
    setBranchResultsSource(null)
    setLinearIssues([])
    setJiraIssues([])
    setGithubLoading(false)
    setGitlabLoading(false)
    setBranchesLoading(false)
    setLinearLoading(false)
    setJiraLoading(false)
    setCommandValue('')
  }, [
    disabled,
    setBranches,
    setBranchesLoading,
    setBranchResultsSource,
    setCommandValue,
    setGithubItems,
    setGithubLoading,
    setGitlabItems,
    setGitlabLoading,
    setJiraIssues,
    setJiraLoading,
    setLinearIssues,
    setLinearLoading,
    setOpen
  ])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(value), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [setDebouncedQuery, value])

  return {
    gitlabSourceAvailable,
    linearAvailable,
    availableModes,
    mrStateFilters,
    ...focusControls
  }
}
