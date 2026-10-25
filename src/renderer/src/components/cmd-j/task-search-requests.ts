import type { ExecutionHostId } from '../../../../shared/execution-host'
import type { TaskProvider } from '../../../../shared/task-providers'
import type { Repo } from '../../../../shared/repo-types'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { PaletteFilterState } from './palette-filter'
import type { CmdJTaskSearchResult } from './task-search-results'

export type CmdJTaskSearchRequest = {
  id: string
  provider: TaskProvider
  hostLabel: string
  run: () => Promise<CmdJTaskSearchResult[]>
}

// Local-only: issue and PR providers are removed, so the palette has no remote task sources to search.
export function createCmdJTaskSearchRequests(_args: {
  query: string
  repos: readonly Repo[]
  settings: GlobalSettings | null
  accountBackedTaskSourceHostId: ExecutionHostId
  filter: PaletteFilterState
  hostLabels: ReadonlyMap<string, string>
  signal: AbortSignal
}): CmdJTaskSearchRequest[] {
  return []
}
