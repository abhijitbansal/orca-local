import { CircleX, FolderTree, List, Pin } from 'lucide-react'
import type React from 'react'
import type { Repo } from '../../../../../../shared/repo-types'
import type { Worktree } from '../../../../../../shared/worktree/types'
import { getWorktreeHostIdentity } from '../../../../../../shared/worktree/host-qualified-identity'
import {
  ConductorDoneIcon,
  ConductorProgressIcon,
  ConductorReviewIcon
} from '../../workspace-status-icons'
import { UNGROUPED_PROJECT_GROUP_KEY } from '../../../../../../shared/project-groups'
import type { AppState } from '../../../../store/types'
import { translate } from '@/i18n/i18n'

export type PRGroupKey = 'done' | 'in-review' | 'in-progress' | 'closed'

export const PR_GROUP_ORDER: PRGroupKey[] = ['done', 'in-review', 'in-progress', 'closed']

/** Section key for a PR lane. Shared so worktree and folder-workspace bucketing
 *  cannot drift onto different prefixes. */
export function getPRLaneKey(prGroup: PRGroupKey): string {
  return `pr:${prGroup}`
}

export const PR_GROUP_META: Record<
  PRGroupKey,
  {
    label: string
    icon: React.ComponentType<{ className?: string }>
    tone: string
  }
> = {
  done: {
    get label() {
      return translate('auto.components.sidebar.worktree.list.groups.5076efc3d2', 'Done')
    },
    icon: ConductorDoneIcon,
    tone: 'text-workspace-status-done'
  },
  'in-review': {
    get label() {
      return translate('auto.components.sidebar.worktree.list.groups.6798dc7c94', 'In review')
    },
    icon: ConductorReviewIcon,
    tone: 'text-workspace-status-review'
  },
  'in-progress': {
    get label() {
      return translate('auto.components.sidebar.worktree.list.groups.7c2f009786', 'In progress')
    },
    icon: ConductorProgressIcon,
    tone: 'text-workspace-status-progress'
  },
  closed: {
    get label() {
      return translate('auto.components.sidebar.worktree.list.groups.682ed5d551', 'Closed')
    },
    icon: CircleX,
    tone: 'text-zinc-600 dark:text-zinc-300'
  }
}

export const PROJECT_GROUP_META = {
  tone: 'text-foreground',
  icon: FolderTree
} as const

export function getProjectGroupHeaderKey(groupId: string | null): string {
  return groupId ? `project-group:${groupId}` : UNGROUPED_PROJECT_GROUP_KEY
}

export const PINNED_GROUP_KEY = 'pinned'

export const PINNED_GROUP_META = {
  get label() {
    return translate('auto.components.sidebar.worktree.list.groups.4aeefc5996', 'Pinned')
  },
  tone: 'text-foreground',
  icon: Pin
} as const

export const ALL_GROUP_KEY = 'all'

export const ALL_GROUP_META = {
  get label() {
    return translate('auto.components.sidebar.worktree.list.groups.0ed04075b8', 'All')
  },
  tone: 'text-foreground',
  icon: List
} as const

export const LINEAGE_GROUP_PREFIX = 'lineage:'

export function getLineageGroupKey(worktreeId: string): string {
  return `${LINEAGE_GROUP_PREFIX}${worktreeId}`
}

export function getWorktreeLineageGroupKey(worktree: Pick<Worktree, 'id' | 'hostId'>): string {
  return getLineageGroupKey(worktree.hostId ? getWorktreeHostIdentity(worktree) : worktree.id)
}

export function getPRGroupKey(
  _worktree: Worktree,
  _repoMap: Map<string, Repo>,
  _prCache: Record<string, unknown> | null,
  _settings?: AppState['settings']
): PRGroupKey {
  // Why: without a forge there is never a PR entry, which the original function mapped to 'in-progress'.
  return 'in-progress'
}

/**
 * Emit a "Pinned" header + its items into `result`.
 *
 * Why: the dedicated Pinned section is always present for pinned worktrees;
 * the display policy decides whether their natural group rows also render.
 */
