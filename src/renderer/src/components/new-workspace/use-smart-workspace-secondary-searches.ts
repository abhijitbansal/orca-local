import { useEffect, useMemo } from 'react'
import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import { searchRuntimeRepoBaseRefDetails } from '@/runtime/runtime-repo-client'
import { RESULT_LIMIT } from './smart-workspace-name-field-model'
import { getBranchSearchRequest } from './smart-workspace-source-results'
import type { useSmartWorkspaceNameFieldFoundation } from './use-smart-workspace-name-field-foundation'

type Foundation = ReturnType<typeof useSmartWorkspaceNameFieldFoundation>

export function useSmartWorkspaceSecondarySearches({
  foundation
}: {
  foundation: Foundation
}): void {
  const {
    disabled,
    branchesEnabled,
    repoBackedSourcesDisabled,
    textOnly,
    mode,
    selectedRepo,
    debouncedQuery,
    setBranches,
    setBranchResultsSource,
    setBranchesLoading
  } = foundation
  const branchSearchRequest = useMemo(
    () =>
      getBranchSearchRequest({
        disabled,
        branchesEnabled: branchesEnabled && !repoBackedSourcesDisabled,
        textOnly,
        mode,
        selectedRepoId: selectedRepo?.id ?? null,
        query: debouncedQuery,
        limit: RESULT_LIMIT
      }),
    [
      branchesEnabled,
      debouncedQuery,
      disabled,
      mode,
      repoBackedSourcesDisabled,
      selectedRepo?.id,
      textOnly
    ]
  )

  useEffect(() => {
    if (!branchSearchRequest) {
      setBranches([])
      setBranchResultsSource(null)
      setBranchesLoading(false)
      return
    }
    let stale = false
    // Why: visibility retains prior rows while typing ahead of the debounced query.
    setBranchesLoading(true)
    void searchRuntimeRepoBaseRefDetails(
      selectedRepo ? getRepoExecutionHostId(selectedRepo) : LOCAL_EXECUTION_HOST_ID,
      branchSearchRequest.repoId,
      branchSearchRequest.query,
      branchSearchRequest.limit
    )
      .then((results) => {
        if (!stale) {
          setBranches(results)
          setBranchResultsSource({
            repoId: branchSearchRequest.repoId,
            query: branchSearchRequest.query
          })
        }
      })
      .catch(() => {
        if (!stale) {
          setBranches([])
          setBranchResultsSource(null)
        }
      })
      .finally(() => {
        if (!stale) {
          setBranchesLoading(false)
        }
      })
    return () => {
      stale = true
    }
  }, [branchSearchRequest, setBranches, setBranchResultsSource, setBranchesLoading])
}
